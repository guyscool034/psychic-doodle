const UPGRADES = [
  { id: 'dbl',   name: '👆 Двойной клик',   desc: '+1 монета за клик',   baseCost: 50,    mult: 1.5, bonus: 1  },
  { id: 'tri',   name: '✌️ Тройной удар',    desc: '+2 монеты за клик',   baseCost: 200,   mult: 1.6, bonus: 2  },
  { id: 'lck',   name: '🍀 Удача',           desc: '+5 монет за клик',    baseCost: 1000,  mult: 1.7, bonus: 5  },
  { id: 'ult',   name: '⚡ Ультра-клик',     desc: '+10 монет за клик',   baseCost: 5000,  mult: 1.8, bonus: 10 },
  { id: 'meg',   name: '💥 МЕГА-клик',       desc: '+25 монет за клик',   baseCost: 20000, mult: 2.0, bonus: 25 },
  { id: 'god',   name: '👑 Богатство',       desc: '+100 монет за клик',  baseCost: 100000,mult: 2.2, bonus: 100},
];

const G = {
  coins: 0,
  totalClicks: 0,
  cpc: 1,
  upgrades: {},
  skin: 'default',
  theme: 'dark',
  username: '',
  pending: 0,
  syncTimer: null,
};

const SKIN_EMOJI = {
  default:'🪙', fire:'🔥', ice:'❄️', star:'⭐', diamond:'💎', skull:'💀', rainbow:'🌈'
};

function upgCost(upg) {
  return Math.floor(upg.baseCost * Math.pow(upg.mult, G.upgrades[upg.id] || 0));
}

function recalcCpc() {
  let c = 1;
  UPGRADES.forEach(u => { c += (G.upgrades[u.id] || 0) * u.bonus; });
  G.cpc = c;
  document.getElementById('cpc').textContent = c.toLocaleString();
}

function doClick() {
  G.coins += G.cpc;
  G.totalClicks += 1;
  G.pending += G.cpc;
  updateCoins();
  document.getElementById('hdr-clicks').textContent = G.totalClicks.toLocaleString();
  spawnParticle('+' + G.cpc);
  scheduleSync();
  refreshUpgrades();
}

function scheduleSync() {
  if (G.syncTimer) return;
  G.syncTimer = setTimeout(async () => {
    const n = G.pending;
    G.pending = 0;
    G.syncTimer = null;
    if (n > 0) {
      const r = await apiClick(n);
      if (r.error) { G.coins = Math.max(0, G.coins - n); updateCoins(); }
    }
  }, 1500);
}

async function buyUpgrade(upg) {
  const cost = upgCost(upg);
  if (G.coins < cost) return;
  G.coins -= cost;
  G.upgrades[upg.id] = (G.upgrades[upg.id] || 0) + 1;
  updateCoins();
  recalcCpc();
  renderUpgrades();
  addActivity(`Куплено: ${upg.name}`);
  await apiClick(-cost);
}

function updateCoins() {
  const el = document.getElementById('coins-num');
  if (el) el.textContent = Math.floor(G.coins).toLocaleString();
}

function loadState(data) {
  G.coins       = data.coins || 0;
  G.totalClicks = data.total_clicks || 0;
  G.skin        = data.active_skin || 'default';
  G.theme       = data.theme || 'dark';
  G.username    = data.username;
  G.upgrades    = data.upgrades || {};
  recalcCpc();
  updateCoins();
  document.getElementById('hdr-clicks').textContent = G.totalClicks.toLocaleString();
  document.getElementById('hdr-name').textContent   = data.username;
  setSkin(G.skin);
  setTheme(G.theme);
}

function setSkin(id) {
  G.skin = id;
  const el = document.getElementById('coin-face');
  if (el) el.textContent = SKIN_EMOJI[id] || '🪙';
}

function setTheme(t) {
  G.theme = t;
  document.body.className = 'theme-' + t;
  document.querySelectorAll('.theme-pill').forEach(b => {
    b.classList.toggle('active', b.dataset.theme === t);
  });
}

function spawnParticle(text) {
  const el = document.createElement('div');
  el.className = 'particle';
  const dx = (Math.random() - 0.5) * 100;
  el.style.setProperty('--dx', dx + 'px');
  el.textContent = text;
  document.getElementById('particles').appendChild(el);
  setTimeout(() => el.remove(), 800);
}

function spawnRipple() {
  const area = document.querySelector('.coin-area');
  const r = document.createElement('div');
  r.className = 'ripple';
  area.appendChild(r);
  setTimeout(() => r.remove(), 500);
}

function renderUpgrades() {
  const list = document.getElementById('upgrades-list');
  if (!list) return;
  list.innerHTML = '';
  UPGRADES.forEach(upg => {
    const cost  = upgCost(upg);
    const count = G.upgrades[upg.id] || 0;
    const can   = G.coins >= cost;
    const progress = Math.min(1, G.coins / cost);

    const card = document.createElement('div');
    card.className = 'upgrade-card' + (can ? '' : ' locked');
    card.innerHTML = `
      <div class="upg-top">
        <span class="upg-name">${upg.name}</span>
        <span class="upg-count">x${count}</span>
      </div>
      <div class="upg-desc">${upg.desc}</div>
      <div class="upg-cost">🪙 ${cost.toLocaleString()}</div>
      <div class="upg-bar"><div class="upg-bar-fill" style="width:${(progress*100).toFixed(1)}%"></div></div>
    `;
    if (can) card.addEventListener('click', () => buyUpgrade(upg));
    list.appendChild(card);
  });
}

function refreshUpgrades() {
  document.querySelectorAll('.upgrade-card').forEach((card, i) => {
    const upg = UPGRADES[i];
    if (!upg) return;
    const can = G.coins >= upgCost(upg);
    card.classList.toggle('locked', !can);
    const fill = card.querySelector('.upg-bar-fill');
    if (fill) fill.style.width = (Math.min(1, G.coins / upgCost(upg)) * 100).toFixed(1) + '%';
    if (can && card.classList.contains('locked')) {
      card.classList.remove('locked');
      card.onclick = () => buyUpgrade(upg);
    }
  });
}

const activityLog = [];
function addActivity(text) {
  activityLog.unshift({ text, time: new Date() });
  if (activityLog.length > 20) activityLog.pop();
  renderActivity();
}

function renderActivity() {
  const el = document.getElementById('activity-log');
  if (!el) return;
  el.innerHTML = activityLog.map(a => {
    const mins = Math.floor((Date.now() - a.time) / 60000);
    const timeStr = mins < 1 ? 'только что' : mins + ' мин. назад';
    return `<div class="activity-item">${a.text}<br><small>${timeStr}</small></div>`;
  }).join('');
}
