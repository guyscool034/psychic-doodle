function showScreen(id) {
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  document.getElementById('screen-' + id).classList.add('active');
}

async function loadLeaderboard() {
  const data = await apiLeaderboard();
  const el = document.getElementById('leaderboard-list');
  if (!el) return;
  if (data.error || !data.length) {
    el.innerHTML = '<p style="color:var(--text2)">Пока никого нет</p>';
    return;
  }
  el.innerHTML = '';
  data.forEach((u, i) => {
    const div = document.createElement('div');
    const rankClass = i === 0 ? 'top-1' : i === 1 ? 'top-2' : i === 2 ? 'top-3' : '';
    div.className = 'lb-entry ' + rankClass;
    div.innerHTML = `
      <span class="lb-rank">${i + 1}</span>
      <span class="lb-name">${escHtml(u.username)}</span>
      <span class="lb-clicks">${u.total_clicks.toLocaleString()} кл.</span>
      <span class="lb-coins">🪙 ${u.coins.toLocaleString()}</span>
    `;
    el.appendChild(div);
  });
}

async function loadSkins() {
  const data = await apiSkins();
  if (data.error) return;
  document.getElementById('skins-coin-count').textContent = Math.floor(gameState.coins).toLocaleString();
  const el = document.getElementById('skins-list');
  if (!el) return;
  el.innerHTML = '';
  data.skins.forEach(skin => {
    const owned = data.owned.includes(skin.id);
    const active = gameState.activeSkin === skin.id;
    const card = document.createElement('div');
    card.className = 'skin-card' + (owned ? ' owned' : '') + (active ? ' active' : '');
    let statusText = '';
    if (active) statusText = '✅ Надет';
    else if (owned) statusText = 'Надеть';
    else statusText = '🛒 Купить';

    card.innerHTML = `
      <span class="skin-emoji">${skin.emoji}</span>
      <div class="skin-name">${skin.name}</div>
      <div class="skin-desc">${skin.description}</div>
      <div class="skin-price">${skin.price === 0 ? 'Бесплатно' : '🪙 ' + skin.price.toLocaleString()}</div>
      <div class="skin-status">${statusText}</div>
    `;
    card.addEventListener('click', () => handleSkinClick(skin, owned, active));
    el.appendChild(card);
  });
}

async function handleSkinClick(skin, owned, active) {
  if (active) return;
  if (owned) {
    const res = await apiEquipSkin(skin.id);
    if (!res.error) {
      applySkin(skin.id);
      loadSkins();
    }
    return;
  }
  if (gameState.coins < skin.price) {
    alert('Недостаточно монет! Нужно ещё ' + (skin.price - Math.floor(gameState.coins)).toLocaleString());
    return;
  }
  if (!confirm(`Купить "${skin.name}" за ${skin.price.toLocaleString()} монет?`)) return;
  const res = await apiBuySkin(skin.id);
  if (res.error) { alert(res.error); return; }
  gameState.coins -= skin.price;
  updateCoinDisplay();
  await apiEquipSkin(skin.id);
  applySkin(skin.id);
  loadSkins();
}

function escHtml(str) {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function setupAuthUI() {
  document.querySelectorAll('.tab').forEach(tab => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
      document.querySelectorAll('.tab-content').forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      document.getElementById('tab-' + tab.dataset.tab).classList.add('active');
    });
  });

  document.getElementById('btn-register').addEventListener('click', async () => {
    const u = document.getElementById('reg-username').value.trim();
    const p = document.getElementById('reg-password').value;
    const errEl = document.getElementById('reg-error');
    const okEl = document.getElementById('reg-success');
    errEl.textContent = '';
    okEl.textContent = '';
    const res = await apiRegister(u, p);
    if (res.error) { errEl.textContent = res.error; return; }
    okEl.textContent = 'Аккаунт создан! Теперь войди.';
    document.querySelector('.tab[data-tab="login"]').click();
  });

  document.getElementById('btn-login').addEventListener('click', async () => {
    const u = document.getElementById('login-username').value.trim();
    const p = document.getElementById('login-password').value;
    const errEl = document.getElementById('login-error');
    errEl.textContent = '';
    const res = await apiLogin(u, p);
    if (res.error) { errEl.textContent = res.error; return; }
    localStorage.setItem('token', res.token);
    loadGameState(res.user);
    renderUpgrades();
    showScreen('game');
  });

  document.getElementById('login-password').addEventListener('keydown', e => {
    if (e.key === 'Enter') document.getElementById('btn-login').click();
  });
}

function setupGameUI() {
  document.getElementById('big-coin').addEventListener('click', () => {
    doClick();
    const btn = document.getElementById('big-coin');
    btn.classList.remove('clicked');
    void btn.offsetWidth;
    btn.classList.add('clicked');
  });

  document.getElementById('btn-logout').addEventListener('click', () => {
    localStorage.removeItem('token');
    showScreen('auth');
  });

  document.getElementById('btn-nav-leaderboard').addEventListener('click', async () => {
    await loadLeaderboard();
    showScreen('leaderboard');
  });

  document.getElementById('btn-nav-skins').addEventListener('click', async () => {
    await loadSkins();
    showScreen('skins');
  });

  document.getElementById('btn-nav-settings').addEventListener('click', () => {
    document.getElementById('settings-username').textContent = 'Игрок: ' + gameState.username;
    showScreen('settings');
  });

  document.getElementById('btn-back-lb').addEventListener('click', () => showScreen('game'));
  document.getElementById('btn-back-skins').addEventListener('click', () => showScreen('game'));
  document.getElementById('btn-back-settings').addEventListener('click', () => showScreen('game'));

  document.querySelectorAll('.theme-btn').forEach(btn => {
    btn.addEventListener('click', async () => {
      const theme = btn.dataset.theme;
      applyThemeClass(theme);
      await apiSetTheme(theme);
    });
  });
}
