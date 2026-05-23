let lbSort = 'coins';
let lbData = [];

function showScreen(id) {
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  const el = document.getElementById('screen-' + id);
  if (el) el.classList.add('active');
}

function showConfirm(text, onYes) {
  const overlay = document.getElementById('confirm-overlay');
  document.getElementById('confirm-text').textContent = text;
  overlay.classList.remove('hidden');
  const yes = document.getElementById('confirm-yes');
  const no  = document.getElementById('confirm-no');
  const cleanup = () => overlay.classList.add('hidden');
  yes.onclick = () => { cleanup(); onYes(); };
  no.onclick  = cleanup;
}

function logout() {
  showConfirm('Выйти из аккаунта?', () => {
    localStorage.removeItem('ck_token');
    showScreen('auth');
  });
}

function setupAuth() {
  document.querySelectorAll('.atab').forEach(tab => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('.atab').forEach(t => t.classList.remove('active'));
      document.querySelectorAll('.atab-body').forEach(b => b.classList.remove('active'));
      tab.classList.add('active');
      document.getElementById('tab-' + tab.dataset.tab).classList.add('active');
    });
  });

  document.getElementById('btn-reg').addEventListener('click', async () => {
    const u   = document.getElementById('r-user').value.trim();
    const p   = document.getElementById('r-pass').value;
    const p2  = document.getElementById('r-pass2').value;
    const err = document.getElementById('r-err');
    const ok  = document.getElementById('r-ok');
    err.textContent = ''; ok.textContent = '';
    if (!u || !p)  { err.textContent = 'Заполни все поля'; return; }
    if (p !== p2)  { err.textContent = 'Пароли не совпадают'; return; }
    const res = await apiRegister(u, p);
    if (res.error) { err.textContent = res.error; return; }
    ok.textContent = '✅ Аккаунт создан! Теперь войди.';
    ['r-user','r-pass','r-pass2'].forEach(id => document.getElementById(id).value = '');
    setTimeout(() => document.querySelector('.atab[data-tab="login"]').click(), 1200);
  });

  document.getElementById('btn-login').addEventListener('click', async () => {
    const u   = document.getElementById('l-user').value.trim();
    const p   = document.getElementById('l-pass').value;
    const err = document.getElementById('l-err');
    err.textContent = '';
    if (!u || !p) { err.textContent = 'Заполни все поля'; return; }
    const res = await apiLogin(u, p);
    if (res.error) { err.textContent = res.error; return; }
    localStorage.setItem('ck_token', res.token);
    await loadBadgeMeta();
    loadState(res.user);
    renderUpgrades();
    showScreen('game');
  });

  document.getElementById('l-pass').addEventListener('keydown', e => {
    if (e.key === 'Enter') document.getElementById('btn-login').click();
  });
  document.getElementById('r-pass2').addEventListener('keydown', e => {
    if (e.key === 'Enter') document.getElementById('btn-reg').click();
  });
}

function setupGame() {
  const coinBtn = document.getElementById('coin-btn');
  coinBtn.addEventListener('click', onCoinClick);

  document.getElementById('nav-lb').addEventListener('click', openLeaderboard);
  document.getElementById('nav-profile').addEventListener('click', () => openProfile(G.username));
  document.getElementById('nav-skins').addEventListener('click', openSkins);
  document.getElementById('nav-settings').addEventListener('click', openSettings);
  document.getElementById('nav-logout').addEventListener('click', logout);
  document.getElementById('btn-logout2').addEventListener('click', logout);

  const adminBtn = document.getElementById('nav-admin');
  if (adminBtn) adminBtn.addEventListener('click', openAdminPanel);

  document.querySelectorAll('.close-btn').forEach(btn => {
    btn.addEventListener('click', () => showScreen(btn.dataset.back || 'game'));
  });

  document.querySelectorAll('.filter-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      lbSort = btn.dataset.sort;
      renderLb();
    });
  });

  document.querySelectorAll('.theme-pill').forEach(btn => {
    btn.addEventListener('click', async () => {
      setTheme(btn.dataset.theme);
      await apiTheme(btn.dataset.theme);
    });
  });
}

// ─── LEADERBOARD ─────────────────────────────────────────────
async function openLeaderboard() {
  showScreen('lb');
  document.getElementById('lb-list').innerHTML = '<div class="loading-msg">Загрузка...</div>';
  lbData = await apiLb();
  if (lbData.error) {
    document.getElementById('lb-list').innerHTML = '<div class="error-msg">Ошибка загрузки</div>';
    return;
  }
  renderLb();
}

function renderLb() {
  const sorted = [...lbData].sort((a, b) =>
    lbSort === 'coins' ? b.coins - a.coins : b.total_clicks - a.total_clicks
  );
  const el = document.getElementById('lb-list');
  if (!sorted.length) { el.innerHTML = '<div class="loading-msg">Пока никого нет</div>'; return; }
  el.innerHTML = '';
  sorted.forEach((u, i) => {
    const rankEmoji = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : (i + 1);
    const rankClass = i < 3 ? 'r' + (i + 1) : '';
    const isMe = u.username === G.username;
    const mainVal = lbSort === 'coins' ? `🪙 ${u.coins.toLocaleString()}` : `👆 ${u.total_clicks.toLocaleString()}`;
    const subVal  = lbSort === 'coins' ? `${u.total_clicks.toLocaleString()} кликов` : `${u.coins.toLocaleString()} монет`;
    const skinEmoji = SKIN_EMOJI[u.active_skin] || '🪙';

    const row = document.createElement('div');
    row.className = 'lb-row' + (isMe ? ' me' : '');
    row.innerHTML = `
      <div class="lb-rank ${rankClass}">${rankEmoji}</div>
      <div class="lb-skin">${skinEmoji}</div>
      <div class="lb-name">
        ${esc(u.username)}
        <span class="lb-badge-rank">${esc(u.rank || '')}</span>
        ${isMe ? '<span class="lb-me-tag">(ты)</span>' : ''}
      </div>
      <div class="lb-val">${mainVal}<div class="lb-sub">${subVal}</div></div>
    `;
    row.style.cursor = 'pointer';
    row.addEventListener('click', () => openProfile(u.username));
    el.appendChild(row);
  });
}

// ─── PROFILE ─────────────────────────────────────────────────
async function openProfile(username) {
  showScreen('profile');
  document.getElementById('profile-body').innerHTML = '<div class="loading-msg">Загрузка...</div>';
  const data = await apiProfile(username);
  if (data.error) {
    document.getElementById('profile-body').innerHTML = `<div class="error-msg">${esc(data.error)}</div>`;
    return;
  }

  const createdDate = new Date(data.created_at * 1000).toLocaleDateString('ru-RU', { day:'numeric', month:'long', year:'numeric' });
  const lastDate    = new Date(data.last_seen  * 1000).toLocaleDateString('ru-RU', { day:'numeric', month:'long', year:'numeric' });
  const skinEmoji   = SKIN_EMOJI[data.active_skin] || '🪙';
  const ageDays     = Math.floor((Date.now() / 1000 - data.created_at) / 86400);

  const allBadges = data.all_badges || [];
  const badgesHTML = allBadges.map(b => {
    const owned = data.badges.includes(b.id);
    return `<div class="badge-item ${owned ? 'owned' : 'locked'}" title="${esc(b.desc)}">
      <span class="badge-emoji">${b.emoji}</span>
      <span class="badge-name">${esc(b.name)}</span>
    </div>`;
  }).join('');

  document.getElementById('profile-body').innerHTML = `
    <div class="profile-header">
      <div class="profile-avatar">${skinEmoji}</div>
      <div class="profile-info">
        <div class="profile-username">${esc(data.username)}</div>
        <div class="profile-rank-badge">${esc(data.rank)}</div>
      </div>
    </div>
    <div class="profile-stats">
      <div class="pstat"><div class="pstat-val">🪙 ${data.coins.toLocaleString()}</div><div class="pstat-label">Монет</div></div>
      <div class="pstat"><div class="pstat-val">👆 ${data.total_clicks.toLocaleString()}</div><div class="pstat-label">Кликов</div></div>
      <div class="pstat"><div class="pstat-val">📅 ${ageDays}</div><div class="pstat-label">Дней с нами</div></div>
    </div>
    <div class="profile-dates">
      <div>📆 Зарегистрирован: <strong>${createdDate}</strong></div>
      <div>🕐 Последний вход: <strong>${lastDate}</strong></div>
    </div>
    <div class="profile-badges-title">Значки</div>
    <div class="profile-badges">${badgesHTML}</div>
  `;
}

// ─── SKINS ───────────────────────────────────────────────────
async function openSkins() {
  showScreen('skins');
  document.getElementById('skins-grid').innerHTML = '<div class="loading-msg" style="grid-column:1/-1">Загрузка...</div>';
  const data = await apiSkins();
  if (data.error) return;
  document.getElementById('shop-coins').textContent = Math.floor(G.coins).toLocaleString();
  const grid = document.getElementById('skins-grid');
  grid.innerHTML = '';
  data.skins.forEach(skin => {
    const owned    = data.owned.includes(skin.id);
    const equipped = G.skin === skin.id;
    const canBuy   = G.coins >= skin.price;
    const card = document.createElement('div');
    card.className = 'skin-card' + (equipped ? ' equipped' : owned ? ' owned' : !canBuy && skin.price > 0 ? ' cant-buy' : '');
    let badge = equipped
      ? '<span class="skin-badge eq-badge">✅ Надет</span>'
      : owned
        ? '<span class="skin-badge owned-badge">✔ Куплен</span>'
        : `<span class="skin-badge">${skin.price === 0 ? 'Бесплатно' : '🔒'}</span>`;
    card.innerHTML = `
      <span class="skin-emoji">${skin.emoji}</span>
      <div class="skin-name">${esc(skin.name)}</div>
      <div class="skin-price">${skin.price === 0 ? 'Бесплатно' : '🪙 ' + skin.price.toLocaleString()}</div>
      ${badge}
    `;
    if (!equipped) {
      if (owned) {
        card.addEventListener('click', async () => {
          await apiEquip(skin.id); setSkin(skin.id); openSkins();
        });
      } else if (canBuy || skin.price === 0) {
        card.addEventListener('click', () => {
          showConfirm(`Купить "${skin.name}" за ${skin.price.toLocaleString()} монет?`, async () => {
            if (skin.price > 0) {
              const res = await apiBuySkin(skin.id);
              if (res.error) { showToast('❌ ' + res.error); return; }
              G.coins = res.coins;
              updateCoins();
              if (res.newBadges) res.newBadges.forEach(b => showBadgeNotif(b));
            }
            await apiEquip(skin.id); setSkin(skin.id); openSkins();
          });
        });
      }
    }
    grid.appendChild(card);
  });
}

// ─── SETTINGS ────────────────────────────────────────────────
function openSettings() {
  showScreen('settings');
  document.getElementById('settings-info').innerHTML = `
    <strong>${esc(G.username)}</strong><br>
    Монет: ${Math.floor(G.coins).toLocaleString()}<br>
    Кликов: ${G.totalClicks.toLocaleString()}<br>
    Монет за клик: ${G.cpc.toLocaleString()}<br>
    Ранг: ${esc(G.rank)}
  `;
  const profileBtn = document.getElementById('btn-my-profile');
  if (profileBtn) profileBtn.onclick = () => openProfile(G.username);
}

// ─── ADMIN PANEL ─────────────────────────────────────────────
let adminPage = 1;
let adminQuery = '';

async function openAdminPanel() {
  if (!G.is_admin) return;
  showScreen('admin');
  await adminLoadUsers();
  adminLoadIpTable();
}

async function adminLoadUsers() {
  const res = await adminGetUsers(adminPage, adminQuery);
  if (res.error) { showToast('Ошибка: ' + res.error); return; }
  const tbody = document.getElementById('admin-users-tbody');
  tbody.innerHTML = '';
  res.users.forEach(u => {
    const tr = document.createElement('tr');
    const badges = Array.isArray(u.badges) ? u.badges.length : 0;
    tr.innerHTML = `
      <td>${esc(u.username)}</td>
      <td>${Math.floor(u.coins).toLocaleString()}</td>
      <td>${u.total_clicks.toLocaleString()}</td>
      <td>${esc(u.rank||'')}</td>
      <td>${badges} значк.</td>
      <td>${u.is_admin ? '👑' : ''}</td>
      <td>
        <button class="adm-btn" onclick="adminQuickGive('${esc(u.username)}')">✏️</button>
        <button class="adm-btn danger" onclick="adminBanUser('${esc(u.username)}')">🚫</button>
      </td>
    `;
    tbody.appendChild(tr);
  });
  document.getElementById('admin-page-info').textContent = `Стр. ${adminPage} / ${Math.ceil(res.total / 20) || 1}`;
}

async function adminLoadIpTable() {
  const rows = await adminIpAccounts();
  if (!Array.isArray(rows)) return;
  const body = document.getElementById('admin-ip-tbody');
  body.innerHTML = '';

  // Group by IP
  const grouped = {};
  rows.forEach(r => {
    if (!grouped[r.ip]) grouped[r.ip] = [];
    grouped[r.ip].push(r);
  });
  Object.entries(grouped).forEach(([ip, users]) => {
    const flagColor = users.length >= 3 ? 'color:var(--danger)' : '';
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td style="${flagColor}">${esc(ip)}</td>
      <td>${users.map(u => esc(u.username)).join(', ')}</td>
      <td style="${flagColor}">${users.length}</td>
    `;
    body.appendChild(tr);
  });
}

function adminQuickGive(username) {
  document.getElementById('give-username').value = username;
  document.getElementById('admin-give-section').scrollIntoView({ behavior: 'smooth' });
}

async function adminBanUser(username) {
  showConfirm(`Удалить аккаунт "${username}"? Это необратимо!`, async () => {
    const res = await adminBan(username);
    if (res.error) { showToast('❌ ' + res.error); return; }
    showToast('✅ Аккаунт удалён');
    adminLoadUsers();
    adminLoadIpTable();
  });
}

function setupAdmin() {
  document.getElementById('admin-search').addEventListener('input', e => {
    adminQuery = e.target.value;
    adminPage  = 1;
    adminLoadUsers();
  });

  document.getElementById('admin-prev').addEventListener('click', () => {
    if (adminPage > 1) { adminPage--; adminLoadUsers(); }
  });
  document.getElementById('admin-next').addEventListener('click', () => {
    adminPage++; adminLoadUsers();
  });

  document.getElementById('admin-give-form').addEventListener('click', async () => {
    const username = document.getElementById('give-username').value.trim();
    const coins    = parseFloat(document.getElementById('give-coins').value)  || 0;
    const clicks   = parseInt(document.getElementById('give-clicks').value)   || 0;
    const rank     = document.getElementById('give-rank').value.trim();
    const badge    = document.getElementById('give-badge').value.trim();
    if (!username) { showToast('Укажи ник'); return; }
    const res = await adminGive({ username, coins: coins||undefined, clicks: clicks||undefined, rank: rank||undefined, badge: badge||undefined });
    if (res.error) { showToast('❌ ' + res.error); return; }
    showToast('✅ Выдано!');
    adminLoadUsers();
  });

  document.getElementById('admin-create-form').addEventListener('click', async () => {
    const u = document.getElementById('admin-new-user').value.trim();
    const p = document.getElementById('admin-new-pass').value;
    if (!u || !p) { showToast('Заполни поля'); return; }
    const res = await adminCreate(u, p);
    if (res.error) { showToast('❌ ' + res.error); return; }
    showToast('✅ Аккаунт создан');
    document.getElementById('admin-new-user').value = '';
    document.getElementById('admin-new-pass').value = '';
    adminLoadUsers();
  });

  document.getElementById('admin-reload-ip').addEventListener('click', adminLoadIpTable);
}
