/**
 * Запусти один раз: node create-admin.js <ник> <пароль>
 * Создаёт/обновляет аккаунт с флагом is_admin = 1
 */
const bcrypt  = require('bcryptjs');
const sqlite3 = require('sqlite3').verbose();
const path    = require('path');

const [,, username, password] = process.argv;
if (!username || !password) {
  console.error('Использование: node create-admin.js <ник> <пароль>');
  process.exit(1);
}

const db   = new sqlite3.Database(path.join(__dirname, 'game.db'));
const hash = bcrypt.hashSync(password, 12);

db.serialize(() => {
  db.run(`CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL,
    coins REAL DEFAULT 0,
    total_clicks INTEGER DEFAULT 0,
    active_skin TEXT DEFAULT 'default',
    owned_skins TEXT DEFAULT '["default"]',
    theme TEXT DEFAULT 'dark',
    upgrades TEXT DEFAULT '{}',
    badges TEXT DEFAULT '[]',
    rank TEXT DEFAULT 'Новичок',
    is_admin INTEGER DEFAULT 0,
    created_at INTEGER DEFAULT (strftime('%s','now')),
    last_seen  INTEGER DEFAULT (strftime('%s','now'))
  )`);

  db.run(
    `INSERT INTO users (username, password, is_admin)
     VALUES (?, ?, 1)
     ON CONFLICT(username) DO UPDATE SET password = excluded.password, is_admin = 1`,
    [username, hash],
    function(err) {
      if (err) { console.error('Ошибка:', err.message); }
      else { console.log(`✅ Админ "${username}" создан/обновлён.`); }
      db.close();
    }
  );
});
