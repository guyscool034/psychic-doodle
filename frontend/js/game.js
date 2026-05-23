const UPGRADES = [
  { id: 'dbl', name: '👆 Двойной клик',  desc: '+1 монета за клик',   baseCost: 50,     mult: 1.5, bonus: 1   },
  { id: 'tri', name: '✌️ Тройной удар',   desc: '+2 монеты за клик',   baseCost: 200,    mult: 1.6, bonus: 2   },
  { id: 'lck', name: '🍀 Удача',          desc: '+5 монет за клик',    baseCost: 1000,   mult: 1.7, bonus: 5   },
  { id: 'ult', name: '⚡ Ультра-клик',    desc: '+10 монет за клик',   baseCost: 5000,   mult: 1.8, bonus: 10  },
  { id: 'meg', name: '💥 МЕГА-клик',      desc: '+25 монет за клик',   baseCost: 20000,  mult: 2.0, bonus: 25  },
  { id: 'god', name: '👑 Богатство',      desc: '+100 монет за клик',  baseCost: 100000, mult: 2.2, bonus: 100 },
];

const G = {
  coins: 0, totalClicks: 0, cpc: 1,
  upgrades: {}, skin: 'default', theme: 'dark',
  username: '', is_admin: false, badges: [],
  rank: 'Новичок',
  pendingCoins: 0, pendingClicks: 0, syncTimer: null,
};

const SKIN_EMOJI = { default:'🪙', fire:'🔥', ice:'❄️', star:'⭐', diamond:'💎', skull:'💀', rainbow:'🌈' };

function upgCost(upg) {
  return Math.floor(upg.baseCost * Math.pow(upg.mult, G.upgrades[upg.id] || 0));
}

function recalcCpc() {
  let c = 1;
  UPGRADES.forEach(u => { c += (G.upgrades[u.id] || 0) * u.bonus; });
  G.cpc = c;
  const el = document.getElementById('cpc');
  if (el) el.textContent = c.toLocaleString();
}

function doClick() {
  G.coins      += G.cpc;
  G.totalClicks += 1;
  G.pendingCoins  += G.cpc;
  G.pendingClicks += 1;
  updateCoins();
  document.getElementById('hdr-clicks').textContent = G.totalClicks.toLocaleString();
  spawnParticle('+' + G.cpc);
  scheduleSync();
  refreshUpgrades();
}

function scheduleSync() {
  if (G.syncTimer) return;
  G.syncTimer = setTimeout(async () => {
    const amount = G.pendingCoins;
    G.pendingCoins  = 0;
    G.pendingClicks = 0;
    G.syncTimer = null;
    if (amount > 0) {
      const r = await apiClick(amount);
      if (r.error) {
        G.coins = Math.max(0, G.coins - amount);
        updateCoins();
      } else {
        // Sync server state
        G.coins       = r.coins;
        G.totalClicks = r.total_clicks;
        if (r.rank) { G.rank = r.rank; updateRankDisplay(); }
        if (r.newBadges && r.newBadges.length) {
          r.newBadges.forEach(b => {
            if (!G.badges.includes(b)) G.badges.push(b);
            showBadgeNotif(b);
          });
        }
        updateCoins();
        document.getElementById('hdr-clicks').textContent = G.totalClicks.toLocaleString();
      }
    }
  }, 1500);
}

async function buyUpgrade(upg) {
  const cost = upgCost(upg);
  if (G.coins < cost) return;

  // Optimistic update
  G.coins -= cost;
  G.upgrades[upg.id] = (G.upgrades[upg.id] || 0) + 1;
  updateCoins();
  recalcCpc();
  renderUpgrades();

  const res = await apiBuyUpgrade(upg.id);
  if (res.error) {
    // Rollback
    G.coins += cost;
    G.upgrades[upg.id] = Math.max(0, (G.upgrades[upg.id] || 1) - 1);
    updateCoins();
    recalcCpc();
    renderUpgrades();
    showToast('❌ ' + res.error);
    return;
  }
  // Sync with server
  G.coins    = res.coins;
  G.upgrades = res.upgrades;
  recalcCpc();
  renderUpgrades();
  updateCoins();

  if (res.newBadges && res.newBadges.length) {
    res.newBadges.forEach(b => {
      if (!G.badges.includes(b)) G.badges.push(b);
      showBadgeNotif(b);
    });
  }
}

function updateCoins() {
  const el = document.getElementById('coins-num');
  if (el) el.textContent = Math.floor(G.coins).toLocaleString();
}

function updateRankDisplay() {
  const el = document.getElementById('hdr-rank');
  if (el) el.textContent = G.rank;
}

function loadState(data) {
  G.coins       = data.coins       || 0;
  G.totalClicks = data.total_clicks || 0;
  G.skin        = data.active_skin  || 'default';
  G.theme       = data.theme        || 'dark';
  G.username    = data.username;
  G.upgrades    = data.upgrades     || {};
  G.badges      = data.badges       || [];
  G.rank        = data.rank         || 'Новичок';
  G.is_admin    = data.is_admin     || false;

  recalcCpc();
  updateCoins();
  updateRankDisplay();
  document.getElementById('hdr-clicks').textContent = G.totalClicks.toLocaleString();
  document.getElementById('hdr-name').textContent   = data.username;
  setSkin(G.skin);
  setTheme(G.theme);

  // Show admin button if needed
  const adminBtn = document.getElementById('nav-admin');
  if (adminBtn) adminBtn.style.display = G.is_admin ? 'flex' : 'none';

  setTimeout(renderMyBadges, 50);
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
  el.style.setProperty('--dx', (Math.random() - 0.5) * 100 + 'px');
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
    const cost     = upgCost(upg);
    const count    = G.upgrades[upg.id] || 0;
    const can      = G.coins >= cost;
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
    card.addEventListener('click', () => { if (G.coins >= upgCost(upg)) buyUpgrade(upg); });
    list.appendChild(card);
  });
}

function refreshUpgrades() {
  document.querySelectorAll('.upgrade-card').forEach((card, i) => {
    const upg = UPGRADES[i]; if (!upg) return;
    const cost = upgCost(upg);
    const can  = G.coins >= cost;
    card.classList.toggle('locked', !can);
    const fill = card.querySelector('.upg-bar-fill');
    if (fill) fill.style.width = (Math.min(1, G.coins / cost) * 100).toFixed(1) + '%';
  });
}

function showToast(msg, duration = 3000) {
  const t = document.createElement('div');
  t.className = 'toast';
  t.textContent = msg;
  document.body.appendChild(t);
  requestAnimationFrame(() => t.classList.add('show'));
  setTimeout(() => { t.classList.remove('show'); setTimeout(() => t.remove(), 400); }, duration);
}

const BADGE_META = {};
async function loadBadgeMeta() {
  if (Object.keys(BADGE_META).length) return;
  const list = await apiBadges();
  if (Array.isArray(list)) list.forEach(b => { BADGE_META[b.id] = b; });
}

function showBadgeNotif(badgeId) {
  const b = BADGE_META[badgeId];
  if (!b) return;
  showToast(`🏅 Новый значок: ${b.emoji} ${b.name}`, 4000);
}

function esc(s) {
  return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

// Render badges in right panel
function renderMyBadges() {
  const el = document.getElementById('my-badges');
  if (!el) return;
  const earned = G.badges;
  if (!earned.length) {
    el.innerHTML = '<div class="no-badges">Пока нет значков 🏅<br><small>Кликай, чтобы получить!</small></div>';
    return;
  }
  el.innerHTML = earned.map(id => {
    const b = BADGE_META[id] || { emoji: '🏅', name: id };
    return `<div class="my-badge-row"><span class="b-emoji">${b.emoji}</span><span>${b.name}</span></div>`;
  }).join('');
}
