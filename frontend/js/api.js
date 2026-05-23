const API_BASE = window.location.origin + '/api';

async function apiFetch(path, method = 'GET', body = null) {
  const opts = { method, headers: { 'Content-Type': 'application/json' } };
  const token = localStorage.getItem('ck_token');
  if (token) opts.headers['Authorization'] = token;
  if (body !== null) opts.body = JSON.stringify(body);
  try {
    const r = await fetch(API_BASE + path, opts);
    return await r.json();
  } catch {
    return { error: 'Нет соединения с сервером' };
  }
}

const apiRegister   = (u, p)      => apiFetch('/register', 'POST', { username: u, password: p });
const apiLogin      = (u, p)      => apiFetch('/login', 'POST', { username: u, password: p });
const apiMe         = ()          => apiFetch('/me');
const apiClick      = (n)         => apiFetch('/click', 'POST', { amount: n });
const apiBuyUpgrade = (id)        => apiFetch('/buy-upgrade', 'POST', { upgradeId: id });
const apiSkins      = ()          => apiFetch('/skins');
const apiBuySkin    = (id)        => apiFetch('/buy-skin', 'POST', { skinId: id });
const apiEquip      = (id)        => apiFetch('/equip-skin', 'POST', { skinId: id });
const apiTheme      = (t)         => apiFetch('/theme', 'POST', { theme: t });
const apiLb         = ()          => apiFetch('/leaderboard');
const apiProfile    = (username)  => apiFetch('/profile/' + encodeURIComponent(username));
const apiBadges     = ()          => apiFetch('/badges');

// Admin
async function adminApiFetch(path, method = 'GET', body = null) {
  const opts = { method, headers: { 'Content-Type': 'application/json' } };
  const token = localStorage.getItem('ck_token');
  if (token) opts.headers['Authorization'] = token;
  if (body !== null) opts.body = JSON.stringify(body);
  try {
    const r = await fetch(API_BASE + path, opts);
    return await r.json();
  } catch {
    return { error: 'Нет соединения' };
  }
}

const adminLogin       = (u, p, s)       => apiFetch('/admin/login', 'POST', { username: u, password: p, adminSecret: s });
const adminGetUsers    = (page, q)       => adminApiFetch(`/admin/users?page=${page}&q=${encodeURIComponent(q||'')}`);
const adminGive        = (data)          => adminApiFetch('/admin/give', 'POST', data);
const adminCreate      = (u, p)          => adminApiFetch('/admin/create', 'POST', { username: u, password: p });
const adminBan         = (username)      => adminApiFetch('/admin/ban', 'POST', { username });
const adminIpAccounts  = ()              => adminApiFetch('/admin/ip-accounts');
