# КоинКликер — туториал по деплою на Render.com

## Структура проекта

```
clickergame/
├── backend/
│   ├── server.js       # Express-сервер (API + раздача frontend)
│   ├── skins.json      # Данные о скинах
│   └── package.json
├── frontend/
│   ├── index.html
│   ├── css/
│   │   └── style.css
│   └── js/
│       ├── api.js      # Все запросы к серверу
│       ├── game.js     # Логика кликера и апгрейдов
│       ├── ui.js       # Экраны, кнопки, загрузка данных
│       └── main.js     # Точка входа
├── render.yaml         # Конфиг для Render.com
└── .gitignore
```

---

## Шаг 1 — Загрузи проект на GitHub

1. Создай новый репозиторий на [github.com](https://github.com/new)
2. Открой папку `clickergame` в терминале и выполни:

```bash
git init
git add .
git commit -m "init"
git remote add origin https://github.com/ТВОЙ_НИК/НАЗВАНИЕ_РЕПО.git
git push -u origin main
```

---

## Шаг 2 — Создай Web Service на Render.com

1. Зайди на [render.com](https://render.com) → **New** → **Web Service**
2. Подключи свой GitHub аккаунт, выбери репозиторий
3. Заполни поля:
   - **Name:** clickergame (или любое)
   - **Root Directory:** `backend`
   - **Build Command:** `npm install`
   - **Start Command:** `npm start`
   - **Instance Type:** Free
4. В разделе **Environment Variables** добавь:
   - `JWT_SECRET` — любая длинная случайная строка (например: `my_super_secret_key_abc123`)
   - `NODE_ENV` — `production`
5. Нажми **Deploy Web Service**

---

## Шаг 3 — Подожди деплой

Render установит зависимости и запустит сервер.  
Когда статус станет **Live**, сайт будет доступен по адресу вида:  
`https://clickergame-xxxx.onrender.com`

---

## Шаг 4 — Проверь

Открой ссылку в браузере. Должна появиться страница входа.  
Зарегистрируйся, войди — и вперёд кликать!

---

## Важные моменты

### База данных (SQLite)
На бесплатном тарифе Render файлы сбрасываются при каждом перезапуске.  
Это значит, что база данных `game.db` **удалится** при перезапуске сервиса.

**Чтобы сохранить данные навсегда — используй Render Disk:**
1. В настройках сервиса → **Disks** → **Add Disk**
2. Mount Path: `/data`
3. В `server.js` измени строку создания базы:
   ```js
   // было:
   const db = new Database('game.db');
   // стало:
   const db = new Database('/data/game.db');
   ```
4. Сделай git push — Render сам пересоберёт проект.

*(Disk стоит $1/мес за 1GB — самый дешёвый вариант для постоянного хранения)*

---

## Как добавить новый скин

Открой `backend/skins.json` и добавь объект в массив:

```json
{
  "id": "pizza",
  "name": "Пицца",
  "emoji": "🍕",
  "price": 2000,
  "color": "#ff9900",
  "description": "Аппетитная монета"
}
```

Сохрани и запушь — готово.

---

## Как добавить новый апгрейд

Открой `frontend/js/game.js`, найди массив `UPGRADES` и добавь:

```js
{ id: 'godmode', name: 'Бог кликов', desc: '+100 монет за клик', baseCost: 100000, costMult: 2.5, bonus: 100 },
```

---

## Локальный запуск (для тестирования)

```bash
cd backend
npm install
node server.js
```

Открой в браузере: `http://localhost:3000`

---

## Что есть в игре

| Фича | Описание |
|------|----------|
| 🎮 Кликер | Кликай по монете, копи монеты |
| ⬆️ Апгрейды | 5 улучшений для увеличения монет за клик |
| 🎨 Скины | 7 скинов монеты, покупаются за монеты |
| 🏆 Лидерборд | Топ-50 игроков по монетам |
| 🌑 Темы | 5 тем оформления (тёмная, светлая, зелёная, фиолетовая, красная) |
| 🔐 Аккаунты | Регистрация, вход, JWT-токены |
| 💾 Синхронизация | Клики батчами отправляются на сервер |
