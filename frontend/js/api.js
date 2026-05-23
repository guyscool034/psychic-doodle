const API_BASE = window.location.origin + '/api';

async function apiFetch(path, method = 'GET', body = null) {
  const opts = {
    method,
    headers: { 'Content-Type': 'application/json' }
  };
  const token = localStorage.getItem('token');
  if (token) opts.headers['Authorization'] = token;
  if (body) opts.body = JSON.stringify(body);

  try {
    const r = await fetch(API_BASE + path, opts);
    return await r.json();
  } catch {
    return { error: 'Нет соединения с сервером' };
  }
}

async function apiRegister(username, password) {
  return apiFetch('/register', 'POST', { username, password });
}

async function apiLogin(username, password) {
  return apiFetch('/login', 'POST', { username, password });
}

async function apiMe() {
  return apiFetch('/me');
}

async function apiClick(amount) {
  return apiFetch('/click', 'POST', { amount });
}

async function apiSkins() {
  return apiFetch('/skins');
}

async function apiBuySkin(skinId) {
  return apiFetch('/buy-skin', 'POST', { skinId });
}

async function apiEquipSkin(skinId) {
  return apiFetch('/equip-skin', 'POST', { skinId });
}

async function apiSetTheme(theme) {
  return apiFetch('/theme', 'POST', { theme });
}

async function apiLeaderboard() {
  return apiFetch('/leaderboard');
}

async function apiUser(username) {
  return apiFetch('/user/' + encodeURIComponent(username));
}
