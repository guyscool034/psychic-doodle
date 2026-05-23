const express = require('express');
const cors    = require('cors');
const bcrypt  = require('bcryptjs');
const jwt     = require('jsonwebtoken');
const sqlite3 = require('sqlite3').verbose();
const path    = require('path');
const rateLimit = require('express-rate-limit');

const app  = express();
const PORT = process.env.PORT || 3000;
const JWT_SECRET   = process.env.JWT_SECRET   || 'CHANGE_THIS_SECRET_IN_PRODUCTION';
const ADMIN_SECRET = process.env.ADMIN_SECRET || 'ADMIN_SUPER_PASSWORD_CHANGE_ME';
const MAX_ACCOUNTS_PER_IP = 3;

// ─── Middleware ───────────────────────────────────────────────
app.use(cors());
app.use(express.json({ limit: '10kb' }));
app.use(express.static(path.join(__dirname, '../frontend')));

// Rate limiting
const registerLimiter = rateLimit({ windowMs: 60 * 60 * 1000, max: 10, message: { error: 'Слишком много попыток регистрации' } });
const loginLimiter    = rateLimit({ windowMs: 15 * 60 * 1000, max: 20, message: { error: 'Слишком много попыток входа' } });
const clickLimiter    = rateLimit({ windowMs: 1000, max: 30, message: { error: 'Слишком быстро' } });

// ─── DB Setup ─────────────────────────────────────────────────
const db = new sqlite3.Database(path.join(__dirname, 'game.db'));

db.serialize(() => {
  db.run(`CREATE TABLE IF NOT EXISTS users (
    id           INTEGER PRIMARY KEY AUTOINCREMENT,
    username     TEXT UNIQUE NOT NULL,
    password     TEXT NOT NULL,
    coins        REAL    DEFAULT 0,
    total_clicks INTEGER DEFAULT 0,
    active_skin  TEXT    DEFAULT 'default',
    owned_skins  TEXT    DEFAULT '["default"]',
    theme        TEXT    DEFAULT 'dark',
    upgrades     TEXT    DEFAULT '{}',
    badges       TEXT    DEFAULT '[]',
    rank         TEXT    DEFAULT 'Новичок',
    is_admin     INTEGER DEFAULT 0,
    created_at   INTEGER DEFAULT (strftime('%s','now')),
    last_seen    INTEGER DEFAULT (strftime('%s','now'))
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS ip_accounts (
    ip   TEXT NOT NULL,
    user_id INTEGER NOT NULL,
    PRIMARY KEY (ip, user_id)
  )`);
});

// ─── Helpers ──────────────────────────────────────────────────
const dbGet = (sql, p) => new Promise((res, rej) => db.get(sql,  p, (e,r) => e ? rej(e) : res(r)));
const dbRun = (sql, p) => new Promise((res, rej) => db.run(sql,  p, function(e){ e ? rej(e) : res(this); }));
const dbAll = (sql, p) => new Promise((res, rej) => db.all(sql,  p, (e,r) => e ? rej(e) : res(r)));

function getIp(req) {
  return (req.headers['x-forwarded-for'] || req.socket.remoteAddress || '').split(',')[0].trim();
}

function sanitize(s) {
  return String(s).replace(/[<>"'`]/g, '');
}

const RANKS = [
  { name: 'Легенда',   min: 1_000_000 },
  { name: 'Мастер',    min: 100_000   },
  { name: 'Ветеран',   min: 25_000    },
  { name: 'Опытный',   min: 5_000     },
  { name: 'Игрок',     min: 500       },
  { name: 'Новичок',   min: 0         },
];

function calcRank(coins) {
  for (const r of RANKS) if (coins >= r.min) return r.name;
  return 'Новичок';
}

const ALL_BADGES = [
  { id: 'first_click',   name: 'Первый клик',     emoji: '👆', desc: 'Сделал первый клик' },
  { id: 'clicks_100',    name: '100 кликов',       emoji: '💯', desc: '100 кликов' },
  { id: 'clicks_1k',     name: '1К кликов',        emoji: '🔥', desc: '1 000 кликов' },
  { id: 'clicks_10k',    name: '10К кликов',       emoji: '⚡', desc: '10 000 кликов' },
  { id: 'clicks_100k',   name: '100К кликов',      emoji: '🌩️', desc: '100 000 кликов' },
  { id: 'coins_1k',      name: 'Тысячник',         emoji: '🪙', desc: '1 000 монет' },
  { id: 'coins_10k',     name: 'Богатей',          emoji: '💰', desc: '10 000 монет' },
  { id: 'coins_100k',    name: 'Миллионер',        emoji: '💎', desc: '100 000 монет' },
  { id: 'week_account',  name: 'Неделя с нами',    emoji: '📅', desc: 'Аккаунту 7 дней' },
  { id: 'month_account', name: 'Месяц с нами',     emoji: '🗓️', desc: 'Аккаунту 30 дней' },
  { id: 'year_account',  name: 'Годовой игрок',    emoji: '🏅', desc: 'Аккаунту 1 год' },
  { id: 'all_skins',     name: 'Коллекционер',     emoji: '🎨', desc: 'Куплены все скины' },
  { id: 'max_upgrade',   name: 'Прокачанный',      emoji: '⬆️', desc: 'Куплено 5+ любых улучшений' },
];

function checkBadges(user) {
  const badges  = JSON.parse(user.badges || '[]');
  const clicks  = user.total_clicks;
  const coins   = user.coins;
  const ageDays = (Date.now() / 1000 - user.created_at) / 86400;
  const upgrades = JSON.parse(user.upgrades || '{}');
  const totalUpgrades = Object.values(upgrades).reduce((a, b) => a + b, 0);
  const owned   = JSON.parse(user.owned_skins || '["default"]');

  const SKINS_IDS = require('./skins.json').map(s => s.id);

  const earned = [];
  if (clicks >= 1)       earned.push('first_click');
  if (clicks >= 100)     earned.push('clicks_100');
  if (clicks >= 1000)    earned.push('clicks_1k');
  if (clicks >= 10000)   earned.push('clicks_10k');
  if (clicks >= 100000)  earned.push('clicks_100k');
  if (coins  >= 1000)    earned.push('coins_1k');
  if (coins  >= 10000)   earned.push('coins_10k');
  if (coins  >= 100000)  earned.push('coins_100k');
  if (ageDays >= 7)      earned.push('week_account');
  if (ageDays >= 30)     earned.push('month_account');
  if (ageDays >= 365)    earned.push('year_account');
  if (SKINS_IDS.every(id => owned.includes(id))) earned.push('all_skins');
  if (totalUpgrades >= 5) earned.push('max_upgrade');

  const newBadges = earned.filter(b => !badges.includes(b));
  const merged    = [...new Set([...badges, ...earned])];
  return { merged, newBadges };
}

function publicUser(user) {
  const { merged } = checkBadges(user);
  return {
    username:     user.username,
    coins:        user.coins,
    total_clicks: user.total_clicks,
    active_skin:  user.active_skin,
    owned_skins:  JSON.parse(user.owned_skins),
    theme:        user.theme,
    upgrades:     JSON.parse(user.upgrades || '{}'),
    badges:       merged,
    rank:         calcRank(user.coins),
    is_admin:     !!user.is_admin,
    created_at:   user.created_at,
    last_seen:    user.last_seen,
  };
}

// ─── Auth middleware ──────────────────────────────────────────
function auth(req, res, next) {
  const token = req.headers['authorization'];
  if (!token) return res.status(401).json({ error: 'Нет токена' });
  try { req.user = jwt.verify(token, JWT_SECRET); next(); }
  catch { res.status(401).json({ error: 'Токен недействителен' }); }
}

function adminAuth(req, res, next) {
  const token = req.headers['authorization'];
  if (!token) return res.status(401).json({ error: 'Нет токена' });
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    if (!decoded.is_admin) return res.status(403).json({ error: 'Нет доступа' });
    req.user = decoded;
    next();
  } catch { res.status(401).json({ error: 'Токен недействителен' }); }
}

// ─── Routes ───────────────────────────────────────────────────

// REGISTER
app.post('/api/register', registerLimiter, async (req, res) => {
  const { username, password } = req.body || {};
  const ip = getIp(req);

  if (!username || !password) return res.status(400).json({ error: 'Заполни все поля' });
  if (username.length < 3 || username.length > 20) return res.status(400).json({ error: 'Ник: 3–20 символов' });
  if (password.length < 4) return res.status(400).json({ error: 'Пароль: минимум 4 символа' });
  if (!/^[a-zA-Z0-9_а-яёА-ЯЁ]+$/.test(username)) return res.status(400).json({ error: 'Только буквы, цифры и _' });

  // Anti-multiaccounting
  const ipCount = await dbGet('SELECT COUNT(*) as cnt FROM ip_accounts WHERE ip = ?', [ip]);
  if (ipCount && ipCount.cnt >= MAX_ACCOUNTS_PER_IP) {
    return res.status(403).json({ error: `С одного IP можно создать не более ${MAX_ACCOUNTS_PER_IP} аккаунтов` });
  }

  const hash = bcrypt.hashSync(password, 12);
  try {
    const result = await dbRun(
      'INSERT INTO users (username, password) VALUES (?, ?)',
      [sanitize(username), hash]
    );
    await dbRun('INSERT OR IGNORE INTO ip_accounts (ip, user_id) VALUES (?, ?)', [ip, result.lastID]);
    res.json({ ok: true });
  } catch {
    res.status(400).json({ error: 'Ник уже занят' });
  }
});

// LOGIN
app.post('/api/login', loginLimiter, async (req, res) => {
  const { username, password } = req.body || {};
  if (!username || !password) return res.status(400).json({ error: 'Заполни все поля' });

  const user = await dbGet('SELECT * FROM users WHERE username = ?', [username]);
  if (!user || !bcrypt.compareSync(password, user.password)) {
    return res.status(401).json({ error: 'Неверный ник или пароль' });
  }

  await dbRun('UPDATE users SET last_seen = strftime(\'%s\',\'now\') WHERE id = ?', [user.id]);

  const token = jwt.sign(
    { id: user.id, username: user.username, is_admin: !!user.is_admin },
    JWT_SECRET,
    { expiresIn: '7d' }
  );
  res.json({ token, user: publicUser(user) });
});

// ME
app.get('/api/me', auth, async (req, res) => {
  const user = await dbGet('SELECT * FROM users WHERE id = ?', [req.user.id]);
  if (!user) return res.status(404).json({ error: 'Не найден' });
  await dbRun('UPDATE users SET last_seen = strftime(\'%s\',\'now\') WHERE id = ?', [user.id]);

  // Save new badges if any
  const { merged } = checkBadges(user);
  await dbRun('UPDATE users SET badges = ?, rank = ? WHERE id = ?',
    [JSON.stringify(merged), calcRank(user.coins), user.id]);

  res.json(publicUser(user));
});

// CLICK — защита от накрутки
app.post('/api/click', auth, clickLimiter, async (req, res) => {
  let { amount } = req.body || {};
  amount = parseInt(amount, 10);

  // Максимум: cpc не превысит ~238 (все апгрейды максимально). Лимит 500 с запасом.
  if (!Number.isInteger(amount) || amount < -500000 || amount > 500) {
    return res.status(400).json({ error: 'Некорректное количество' });
  }

  const user = await dbGet('SELECT * FROM users WHERE id = ?', [req.user.id]);

  // Validate cpc on server side
  if (amount > 0) {
    const upgrades = JSON.parse(user.upgrades || '{}');
    const UPGRADES = [
      { id:'dbl', bonus:1 }, { id:'tri', bonus:2 }, { id:'lck', bonus:5 },
      { id:'ult', bonus:10 }, { id:'meg', bonus:25 }, { id:'god', bonus:100 },
    ];
    let maxCpc = 1;
    UPGRADES.forEach(u => { maxCpc += (upgrades[u.id] || 0) * u.bonus; });
    if (amount > maxCpc) {
      return res.status(400).json({ error: 'Некорректный клик' });
    }
  }

  // Не уходим в минус
  if (amount < 0 && user.coins + amount < 0) {
    return res.status(400).json({ error: 'Недостаточно монет' });
  }

  const newCoins  = user.coins + amount;
  const newClicks = user.total_clicks + (amount > 0 ? 1 : 0);
  const rank      = calcRank(newCoins);

  await dbRun(
    'UPDATE users SET coins = ?, total_clicks = ?, rank = ?, last_seen = strftime(\'%s\',\'now\') WHERE id = ?',
    [newCoins, newClicks, rank, req.user.id]
  );

  // Check new badges
  const updatedUser = await dbGet('SELECT * FROM users WHERE id = ?', [req.user.id]);
  const { merged, newBadges } = checkBadges(updatedUser);
  if (newBadges.length) {
    await dbRun('UPDATE users SET badges = ? WHERE id = ?', [JSON.stringify(merged), req.user.id]);
  }

  res.json({ coins: newCoins, total_clicks: newClicks, rank, newBadges });
});

// BUY UPGRADE
app.post('/api/buy-upgrade', auth, async (req, res) => {
  const { upgradeId } = req.body || {};
  const UPGRADES = [
    { id: 'dbl', baseCost: 50,     mult: 1.5, bonus: 1   },
    { id: 'tri', baseCost: 200,    mult: 1.6, bonus: 2   },
    { id: 'lck', baseCost: 1000,   mult: 1.7, bonus: 5   },
    { id: 'ult', baseCost: 5000,   mult: 1.8, bonus: 10  },
    { id: 'meg', baseCost: 20000,  mult: 2.0, bonus: 25  },
    { id: 'god', baseCost: 100000, mult: 2.2, bonus: 100 },
  ];
  const upg = UPGRADES.find(u => u.id === upgradeId);
  if (!upg) return res.status(404).json({ error: 'Апгрейд не найден' });

  const user     = await dbGet('SELECT * FROM users WHERE id = ?', [req.user.id]);
  const upgrades = JSON.parse(user.upgrades || '{}');
  const level    = upgrades[upg.id] || 0;
  const cost     = Math.floor(upg.baseCost * Math.pow(upg.mult, level));

  if (user.coins < cost) return res.status(400).json({ error: 'Недостаточно монет' });

  upgrades[upg.id] = level + 1;
  const newCoins = user.coins - cost;

  await dbRun(
    'UPDATE users SET coins = ?, upgrades = ? WHERE id = ?',
    [newCoins, JSON.stringify(upgrades), req.user.id]
  );

  const updatedUser = await dbGet('SELECT * FROM users WHERE id = ?', [req.user.id]);
  const { merged, newBadges } = checkBadges(updatedUser);
  if (newBadges.length) await dbRun('UPDATE users SET badges = ? WHERE id = ?', [JSON.stringify(merged), req.user.id]);

  res.json({ ok: true, coins: newCoins, upgrades, newBadges });
});

const SKINS = require('./skins.json');

app.get('/api/skins', auth, async (req, res) => {
  const user  = await dbGet('SELECT owned_skins, coins FROM users WHERE id = ?', [req.user.id]);
  const owned = JSON.parse(user.owned_skins);
  res.json({ skins: SKINS, owned, coins: user.coins });
});

app.post('/api/buy-skin', auth, async (req, res) => {
  const { skinId } = req.body || {};
  const skin = SKINS.find(s => s.id === skinId);
  if (!skin) return res.status(404).json({ error: 'Скин не найден' });

  const user  = await dbGet('SELECT * FROM users WHERE id = ?', [req.user.id]);
  const owned = JSON.parse(user.owned_skins);
  if (owned.includes(skinId)) return res.status(400).json({ error: 'Уже куплен' });
  if (user.coins < skin.price) return res.status(400).json({ error: 'Недостаточно монет' });

  owned.push(skinId);
  const newCoins = user.coins - skin.price;
  await dbRun('UPDATE users SET coins = ?, owned_skins = ? WHERE id = ?',
    [newCoins, JSON.stringify(owned), req.user.id]);

  const updatedUser = await dbGet('SELECT * FROM users WHERE id = ?', [req.user.id]);
  const { merged, newBadges } = checkBadges(updatedUser);
  if (newBadges.length) await dbRun('UPDATE users SET badges = ? WHERE id = ?', [JSON.stringify(merged), req.user.id]);

  res.json({ ok: true, coins: newCoins, owned, newBadges });
});

app.post('/api/equip-skin', auth, async (req, res) => {
  const { skinId } = req.body || {};
  const user  = await dbGet('SELECT owned_skins FROM users WHERE id = ?', [req.user.id]);
  const owned = JSON.parse(user.owned_skins);
  if (!owned.includes(skinId)) return res.status(403).json({ error: 'Скин не куплен' });
  await dbRun('UPDATE users SET active_skin = ? WHERE id = ?', [skinId, req.user.id]);
  res.json({ ok: true });
});

app.post('/api/theme', auth, async (req, res) => {
  const { theme } = req.body || {};
  if (!['dark','light','green','purple','red'].includes(theme))
    return res.status(400).json({ error: 'Неизвестная тема' });
  await dbRun('UPDATE users SET theme = ? WHERE id = ?', [theme, req.user.id]);
  res.json({ ok: true });
});

app.get('/api/leaderboard', async (req, res) => {
  const rows = await dbAll(
    'SELECT username, coins, total_clicks, active_skin, badges, rank FROM users ORDER BY coins DESC LIMIT 50', []
  );
  res.json(rows.map(u => ({ ...u, badges: JSON.parse(u.badges || '[]') })));
});

// PUBLIC PROFILE
app.get('/api/profile/:username', async (req, res) => {
  const username = sanitize(req.params.username);
  const user = await dbGet('SELECT * FROM users WHERE username = ?', [username]);
  if (!user) return res.status(404).json({ error: 'Игрок не найден' });
  const { merged } = checkBadges(user);
  res.json({
    username:     user.username,
    coins:        user.coins,
    total_clicks: user.total_clicks,
    active_skin:  user.active_skin,
    badges:       merged,
    rank:         calcRank(user.coins),
    created_at:   user.created_at,
    last_seen:    user.last_seen,
    all_badges:   ALL_BADGES,
  });
});

// BADGES LIST
app.get('/api/badges', (req, res) => res.json(ALL_BADGES));

// ─── ADMIN ────────────────────────────────────────────────────

app.post('/api/admin/login', loginLimiter, async (req, res) => {
  const { username, password, adminSecret } = req.body || {};
  if (adminSecret !== ADMIN_SECRET) return res.status(403).json({ error: 'Неверный admin-секрет' });

  const user = await dbGet('SELECT * FROM users WHERE username = ?', [username]);
  if (!user || !bcrypt.compareSync(password, user.password))
    return res.status(401).json({ error: 'Неверный ник или пароль' });
  if (!user.is_admin) return res.status(403).json({ error: 'Нет прав администратора' });

  const token = jwt.sign({ id: user.id, username: user.username, is_admin: true }, JWT_SECRET, { expiresIn: '7d' });
  res.json({ token });
});

app.get('/api/admin/users', adminAuth, async (req, res) => {
  const page  = Math.max(1, parseInt(req.query.page) || 1);
  const limit = 20;
  const offset = (page - 1) * limit;
  const search = req.query.q ? `%${sanitize(req.query.q)}%` : '%';

  const users = await dbAll(
    `SELECT id, username, coins, total_clicks, rank, badges, is_admin, created_at, last_seen
     FROM users WHERE username LIKE ? ORDER BY coins DESC LIMIT ? OFFSET ?`,
    [search, limit, offset]
  );
  const total = await dbGet('SELECT COUNT(*) as cnt FROM users WHERE username LIKE ?', [search]);
  res.json({ users: users.map(u => ({ ...u, badges: JSON.parse(u.badges||'[]') })), total: total.cnt });
});

app.post('/api/admin/give', adminAuth, async (req, res) => {
  const { username, coins, clicks, rank, badge } = req.body || {};
  const user = await dbGet('SELECT * FROM users WHERE username = ?', [sanitize(username)]);
  if (!user) return res.status(404).json({ error: 'Игрок не найден' });

  const updates = [];
  if (Number.isFinite(coins))  updates.push(dbRun('UPDATE users SET coins  = coins  + ? WHERE id = ?', [coins,  user.id]));
  if (Number.isFinite(clicks)) updates.push(dbRun('UPDATE users SET total_clicks = total_clicks + ? WHERE id = ?', [clicks, user.id]));
  if (rank) updates.push(dbRun('UPDATE users SET rank = ? WHERE id = ?', [sanitize(rank), user.id]));
  if (badge) {
    const current = JSON.parse(user.badges || '[]');
    if (!current.includes(badge)) {
      current.push(badge);
      updates.push(dbRun('UPDATE users SET badges = ? WHERE id = ?', [JSON.stringify(current), user.id]));
    }
  }

  await Promise.all(updates);
  const updated = await dbGet('SELECT * FROM users WHERE id = ?', [user.id]);
  res.json({ ok: true, user: publicUser(updated) });
});

app.post('/api/admin/create', adminAuth, async (req, res) => {
  const { username, password } = req.body || {};
  if (!username || !password) return res.status(400).json({ error: 'Заполни поля' });
  if (username.length < 3 || username.length > 20) return res.status(400).json({ error: 'Ник: 3–20 символов' });
  if (!/^[a-zA-Z0-9_а-яёА-ЯЁ]+$/.test(username)) return res.status(400).json({ error: 'Недопустимые символы' });

  const hash = bcrypt.hashSync(password, 12);
  try {
    await dbRun('INSERT INTO users (username, password) VALUES (?, ?)', [sanitize(username), hash]);
    res.json({ ok: true });
  } catch { res.status(400).json({ error: 'Ник уже занят' }); }
});

app.post('/api/admin/ban', adminAuth, async (req, res) => {
  const { username } = req.body || {};
  const user = await dbGet('SELECT id, is_admin FROM users WHERE username = ?', [sanitize(username)]);
  if (!user) return res.status(404).json({ error: 'Не найден' });
  if (user.is_admin) return res.status(403).json({ error: 'Нельзя удалить администратора' });
  await dbRun('DELETE FROM users WHERE id = ?', [user.id]);
  await dbRun('DELETE FROM ip_accounts WHERE user_id = ?', [user.id]);
  res.json({ ok: true });
});

app.get('/api/admin/ip-accounts', adminAuth, async (req, res) => {
  const rows = await dbAll(
    `SELECT ia.ip, u.username, u.coins, u.created_at
     FROM ip_accounts ia JOIN users u ON ia.user_id = u.id
     ORDER BY ia.ip`, []
  );
  res.json(rows);
});

app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
