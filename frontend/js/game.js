const UPGRADES = [
  { id: 'double', name: 'Двойной клик', desc: '+1 монета за клик', baseCost: 50, costMult: 1.5, bonus: 1 },
  { id: 'triple', name: 'Тройной удар', desc: '+2 монеты за клик', baseCost: 200, costMult: 1.6, bonus: 2 },
  { id: 'lucky', name: 'Удача', desc: '+5 монет за клик', baseCost: 1000, costMult: 1.7, bonus: 5 },
  { id: 'ultra', name: 'Ультра-клик', desc: '+10 монет за клик', baseCost: 5000, costMult: 1.8, bonus: 10 },
  { id: 'mega', name: 'МЕГА-клик', desc: '+25 монет за клик', baseCost: 20000, costMult: 2.0, bonus: 25 },
];

let gameState = {
  coins: 0,
  totalClicks: 0,
  coinsPerClick: 1,
  upgrades: {},
  activeSkin: 'default',
  theme: 'dark',
  username: ''
};

let pendingClicks = 0;
let syncTimer = null;

function getUpgradeCost(upg) {
  const count = gameState.upgrades[upg.id] || 0;
  return Math.floor(upg.baseCost * Math.pow(upg.costMult, count));
}

function recalcCoinsPerClick() {
  let cpc = 1;
  UPGRADES.forEach(upg => {
    const count = gameState.upgrades[upg.id] || 0;
    cpc += count * upg.bonus;
  });
  gameState.coinsPerClick = cpc;
  document.getElementById('coins-per-click').textContent = cpc;
}

function doClick() {
  const earned = gameState.coinsPerClick;
  gameState.coins += earned;
  gameState.totalClicks += 1;
  pendingClicks += earned;
  updateCoinDisplay();
  document.getElementById('total-clicks').textContent = gameState.totalClicks.toLocaleString();
  spawnParticle('+' + earned);
  scheduleSyncClicks();
  refreshUpgradeButtons();
}

function scheduleSyncClicks() {
  if (syncTimer) return;
  syncTimer = setTimeout(async () => {
    const amount = pendingClicks;
    pendingClicks = 0;
    syncTimer = null;
    if (amount > 0) {
      const res = await apiClick(amount);
      if (res.error) {
        gameState.coins -= amount;
        updateCoinDisplay();
      }
    }
  }, 1500);
}

async function buyUpgrade(upgId) {
  const upg = UPGRADES.find(u => u.id === upgId);
  if (!upg) return;
  const cost = getUpgradeCost(upg);
  if (gameState.coins < cost) return;
  gameState.coins -= cost;
  gameState.upgrades[upgId] = (gameState.upgrades[upgId] || 0) + 1;
  updateCoinDisplay();
  recalcCoinsPerClick();
  renderUpgrades();
  await apiClick(-cost);
}

function updateCoinDisplay() {
  const el = document.getElementById('coin-display');
  if (el) el.textContent = Math.floor(gameState.coins).toLocaleString();
}

function loadGameState(userData) {
  gameState.coins = userData.coins || 0;
  gameState.totalClicks = userData.total_clicks || 0;
  gameState.activeSkin = userData.active_skin || 'default';
  gameState.theme = userData.theme || 'dark';
  gameState.username = userData.username;
  gameState.upgrades = userData.upgrades || {};
  recalcCoinsPerClick();
  updateCoinDisplay();
  document.getElementById('total-clicks').textContent = gameState.totalClicks.toLocaleString();
  document.getElementById('header-username').textContent = userData.username;
  applySkin(gameState.activeSkin);
  applyThemeClass(gameState.theme);
}

function applySkin(skinId) {
  const skinEmojis = {
    default: '🪙', fire: '🔥', ice: '❄️', star: '⭐', diamond: '💎', skull: '💀', rainbow: '🌈'
  };
  const el = document.getElementById('coin-emoji');
  if (el) el.textContent = skinEmojis[skinId] || '🪙';
  gameState.activeSkin = skinId;
}

function applyThemeClass(theme) {
  document.body.className = 'theme-' + theme;
  gameState.theme = theme;
  document.querySelectorAll('.theme-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.theme === theme);
  });
}

function spawnParticle(text) {
  const container = document.getElementById('click-particles');
  if (!container) return;
  const el = document.createElement('div');
  el.className = 'particle';
  const tx = (Math.random() - 0.5) * 80;
  el.style.setProperty('--tx', tx + 'px');
  el.style.left = (Math.random() * 40 - 20) + 'px';
  el.textContent = text;
  container.appendChild(el);
  setTimeout(() => el.remove(), 900);
}

function renderUpgrades() {
  const list = document.getElementById('upgrades-list');
  if (!list) return;
  list.innerHTML = '';
  UPGRADES.forEach(upg => {
    const cost = getUpgradeCost(upg);
    const count = gameState.upgrades[upg.id] || 0;
    const canBuy = gameState.coins >= cost;
    const card = document.createElement('div');
    card.className = 'upgrade-card' + (canBuy ? '' : ' disabled');
    card.innerHTML = `
      <span class="upg-count">x${count}</span>
      <div class="upg-name">${upg.name}</div>
      <div class="upg-desc">${upg.desc}</div>
      <div class="upg-cost">🪙 ${cost.toLocaleString()}</div>
    `;
    if (canBuy) {
      card.addEventListener('click', () => buyUpgrade(upg.id));
    }
    list.appendChild(card);
  });
}

function refreshUpgradeButtons() {
  document.querySelectorAll('.upgrade-card').forEach((card, i) => {
    const upg = UPGRADES[i];
    if (!upg) return;
    const canBuy = gameState.coins >= getUpgradeCost(upg);
    card.classList.toggle('disabled', !canBuy);
  });
}
