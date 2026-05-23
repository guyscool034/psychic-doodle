let lbSort = 'coins';
let lbData = [];

function showScreen(id) {
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  document.getElementById('screen-' + id).classList.add('active');
}

function confirm(text, onYes) {
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
  confirm('Выйти из аккаунта?', () => {
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
    const u  = document.getElementById('r-user').value.trim();
    const p  = document.getElementById('r-pass').value;
    const p2 = document.getElementById('r-pass2').value;
    const err = document.getElementById('r-err');
    const ok  = document.getElementById('r-ok');
    err.textContent = '';
    ok.textContent  = '';
    if (!u || !p) { err.textContent = 'Заполни все поля'; return; }
    if (p !== p2) { err.textContent = 'Пароли не совпадают'; return; }
    const res = await apiRegister(u, p);
    if (res.error) { err.textContent = res.error; return; }
    ok.textContent = '✅ Аккаунт создан! Теперь войди.';
    document.getElementById('r-user').value = '';
    document.getElementById('r-pass').value = '';
    document.getElementById('r-pass2').value = '';
    setTimeout(() => document.querySelector('.atab[data-tab="login"]').click(), 1200);
  });

  document.getElementById('btn-login').addEventListener('click', async () => {
    const u = document.getElementById('l-user').value.trim();
    const p = document.getElementById('l-pass').value;
    const err = document.getElementById('l-err');
    err.textContent = '';
    if (!u || !p) { err.textContent = 'Заполни все поля'; return; }
    const res = await apiLogin(u, p);
    if (res.error) { err.textContent = res.error; return; }
    localStorage.setItem('ck_token', res.token);
    loadState(res.user);
    renderUpgrades();
    addActivity('Вход в игру 👋');
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
  coinBtn.addEventListener('click', () => {
    doClick();
    coinBtn.classList.remove('pop');
    void coinBtn.offsetWidth;
    coinBtn.classList.add('pop');
    spawnRipple();
  });

  document.getElementById('nav-lb').addEventListener('click', openLeaderboard);
  document.getElementById('nav-skins').addEventListener('click', openSkins);
  document.getElementById('nav-settings').addEventListener('click', openSettings);
  document.getElementById('nav-logout').addEventListener('click', logout);
  document.getElementById('btn-logout2').addEventListener('click', logout);

  document.querySelectorAll('.close-btn').forEach(btn => {
    btn.addEventListener('click', () => showScreen('game'));
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

async function openLeaderboard() {
  showScreen('lb');
  document.getElementById('lb-list').innerHTML = '<div style="color:var(--text2);text-align:center;padding:20px">Загрузка...</div>';
  lbData = await apiLb();
  if (lbData.error) {
    document.getElementById('lb-list').innerHTML = '<div style="color:var(--danger)">Ошибка загрузки</div>';
    return;
  }
  renderLb();
}

function renderLb() {
  const sorted = [...lbData].sort((a, b) =>
    lbSort === 'coins' ? b.coins - a.coins : b.total_clicks - a.total_clicks
  );
  const el = document.getElementById('lb-list');
  if (!sorted.length) { el.innerHTML = '<div style="color:var(--text2);text-align:center;padding:20px">Пока никого нет</div>'; return; }
  el.innerHTML = '';
  sorted.forEach((u, i) => {
    const row = document.createElement('div');
    const rankClass = i === 0 ? 'r1' : i === 1 ? 'r2' : i === 2 ? 'r3' : '';
    const rankEmoji = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : (i + 1);
    const isMe = u.username === G.username;
    row.className = 'lb-row' + (isMe ? ' me' : '');
    const mainVal  = lbSort === 'coins'
      ? `🪙 ${u.coins.toLocaleString()}`
      : `👆 ${u.total_clicks.toLocaleString()}`;
    const subVal   = lbSort === 'coins'
      ? `${u.total_clicks.toLocaleString()} кликов`
      : `${u.coins.toLocaleString()} монет`;
    const skinEmoji = { default:'🪙',fire:'🔥',ice:'❄️',star:'⭐',diamond:'💎',skull:'💀',rainbow:'🌈' };
    row.innerHTML = `
      <div class="lb-rank ${rankClass}">${rankEmoji}</div>
      <div class="lb-skin">${skinEmoji[u.active_skin] || '🪙'}</div>
      <div class="lb-name">${esc(u.username)}${isMe ? ' <span style="color:var(--gold);font-size:0.75rem">(ты)</span>' : ''}</div>
      <div class="lb-val">${mainVal}<div class="lb-sub">${subVal}</div></div>
    `;
    el.appendChild(row);
  });
}

async function openSkins() {
  showScreen('skins');
  document.getElementById('skins-grid').innerHTML = '<div style="color:var(--text2);text-align:center;padding:20px;grid-column:1/-1">Загрузка...</div>';
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
    let badge = '';
    if (equipped)    badge = '<span class="skin-badge eq-badge">✅ Надет</span>';
    else if (owned)  badge = '<span class="skin-badge owned-badge">✔ Куплен</span>';
    else             badge = `<span class="skin-badge">${skin.price === 0 ? 'Бесплатно' : '🔒'}</span>`;
    card.innerHTML = `
      <span class="skin-emoji">${skin.emoji}</span>
      <div class="skin-name">${skin.name}</div>
      <div class="skin-price">${skin.price === 0 ? 'Бесплатно' : '🪙 ' + skin.price.toLocaleString()}</div>
      ${badge}
    `;
    if (!equipped) {
      if (owned) {
        card.addEventListener('click', async () => {
          await apiEquip(skin.id);
          setSkin(skin.id);
          addActivity(`Надет скин: ${skin.emoji} ${skin.name}`);
          openSkins();
        });
      } else if (canBuy || skin.price === 0) {
        card.addEventListener('click', () => {
          confirm(`Купить "${skin.name}" за ${skin.price.toLocaleString()} монет?`, async () => {
            if (skin.price > 0) {
              const res = await apiBuySkin(skin.id);
              if (res.error) { alert(res.error); return; }
              G.coins -= skin.price;
              updateCoins();
            }
            await apiEquip(skin.id);
            setSkin(skin.id);
            addActivity(`Куплен скин: ${skin.emoji} ${skin.name}`);
            openSkins();
          });
        });
      }
    }
    grid.appendChild(card);
  });
}

function openSettings() {
  showScreen('settings');
  document.getElementById('settings-info').innerHTML = `
    <strong>${esc(G.username)}</strong><br>
    Монет: ${Math.floor(G.coins).toLocaleString()}<br>
    Кликов: ${G.totalClicks.toLocaleString()}<br>
    Монет за клик: ${G.cpc.toLocaleString()}
  `;
}

function esc(s) {
  return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}
