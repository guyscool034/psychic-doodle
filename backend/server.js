const express = require('express');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const Database = require('better-sqlite3');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'supersecret_change_in_production';

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, '../frontend')));

const db = new Database('game.db');

db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL,
    coins INTEGER DEFAULT 0,
    total_clicks INTEGER DEFAULT 0,
    active_skin TEXT DEFAULT 'default',
    owned_skins TEXT DEFAULT '["default"]',
    theme TEXT DEFAULT 'dark',
    created_at INTEGER DEFAULT (strftime('%s','now'))
  );
`);

function auth(req, res, next) {
  const token = req.headers['authorization'];
  if (!token) return res.status(401).json({ error: 'Нет токена' });
  try {
    req.user = jwt.verify(token, JWT_SECRET);
    next();
  } catch {
    res.status(401).json({ error: 'Токен недействителен' });
  }
}

app.post('/api/register', (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) return res.status(400).json({ error: 'Заполни все поля' });
  if (username.length < 3 || username.length > 20) return res.status(400).json({ error: 'Ник: 3–20 символов' });
  if (password.length < 4) return res.status(400).json({ error: 'Пароль: минимум 4 символа' });
  if (!/^[a-zA-Z0-9_а-яёА-ЯЁ]+$/.test(username)) return res.status(400).json({ error: 'Недопустимые символы в нике' });

  const hash = bcrypt.hashSync(password, 10);
  try {
    db.prepare('INSERT INTO users (username, password) VALUES (?, ?)').run(username, hash);
    res.json({ ok: true });
  } catch {
    res.status(400).json({ error: 'Ник уже занят' });
  }
});

app.post('/api/login', (req, res) => {
  const { username, password } = req.body;
  const user = db.prepare('SELECT * FROM users WHERE username = ?').get(username);
  if (!user || !bcrypt.compareSync(password, user.password)) {
    return res.status(401).json({ error: 'Неверный ник или пароль' });
  }
  const token = jwt.sign({ id: user.id, username: user.username }, JWT_SECRET, { expiresIn: '7d' });
  res.json({
    token,
    user: {
      username: user.username,
      coins: user.coins,
      total_clicks: user.total_clicks,
      active_skin: user.active_skin,
      owned_skins: JSON.parse(user.owned_skins),
      theme: user.theme
    }
  });
});

app.get('/api/me', auth, (req, res) => {
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.user.id);
  if (!user) return res.status(404).json({ error: 'Не найден' });
  res.json({
    username: user.username,
    coins: user.coins,
    total_clicks: user.total_clicks,
    active_skin: user.active_skin,
    owned_skins: JSON.parse(user.owned_skins),
    theme: user.theme
  });
});

app.post('/api/click', auth, (req, res) => {
  const { amount } = req.body;
  if (!Number.isInteger(amount) || amount < 1 || amount > 100) {
    return res.status(400).json({ error: 'Некорректное количество' });
  }
  db.prepare('UPDATE users SET coins = coins + ?, total_clicks = total_clicks + ? WHERE id = ?')
    .run(amount, amount, req.user.id);
  const user = db.prepare('SELECT coins, total_clicks FROM users WHERE id = ?').get(req.user.id);
  res.json({ coins: user.coins, total_clicks: user.total_clicks });
});

const SKINS = require('./skins.json');

app.get('/api/skins', auth, (req, res) => {
  const user = db.prepare('SELECT owned_skins, coins FROM users WHERE id = ?').get(req.user.id);
  const owned = JSON.parse(user.owned_skins);
  res.json({ skins: SKINS, owned, coins: user.coins });
});

app.post('/api/buy-skin', auth, (req, res) => {
  const { skinId } = req.body;
  const skin = SKINS.find(s => s.id === skinId);
  if (!skin) return res.status(404).json({ error: 'Скин не найден' });

  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.user.id);
  const owned = JSON.parse(user.owned_skins);
  if (owned.includes(skinId)) return res.status(400).json({ error: 'Уже куплен' });
  if (user.coins < skin.price) return res.status(400).json({ error: 'Недостаточно монет' });

  owned.push(skinId);
  db.prepare('UPDATE users SET coins = coins - ?, owned_skins = ? WHERE id = ?')
    .run(skin.price, JSON.stringify(owned), req.user.id);

  res.json({ ok: true, coins: user.coins - skin.price, owned });
});

app.post('/api/equip-skin', auth, (req, res) => {
  const { skinId } = req.body;
  const user = db.prepare('SELECT owned_skins FROM users WHERE id = ?').get(req.user.id);
  const owned = JSON.parse(user.owned_skins);
  if (!owned.includes(skinId)) return res.status(403).json({ error: 'Скин не куплен' });

  db.prepare('UPDATE users SET active_skin = ? WHERE id = ?').run(skinId, req.user.id);
  res.json({ ok: true });
});

app.post('/api/theme', auth, (req, res) => {
  const { theme } = req.body;
  const allowed = ['dark', 'light', 'green', 'purple', 'red'];
  if (!allowed.includes(theme)) return res.status(400).json({ error: 'Неизвестная тема' });
  db.prepare('UPDATE users SET theme = ? WHERE id = ?').run(theme, req.user.id);
  res.json({ ok: true });
});

app.get('/api/leaderboard', (req, res) => {
  const rows = db.prepare(
    'SELECT username, coins, total_clicks FROM users ORDER BY coins DESC LIMIT 50'
  ).all();
  res.json(rows);
});

app.get('/api/user/:username', (req, res) => {
  const user = db.prepare(
    'SELECT username, coins, total_clicks, active_skin FROM users WHERE username = ?'
  ).get(req.params.username);
  if (!user) return res.status(404).json({ error: 'Не найден' });
  res.json(user);
});

app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
