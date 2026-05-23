async function init() {
  setupAuth();
  setupGame();
  setupAdmin();

  const token = localStorage.getItem('ck_token');
  if (!token) { showScreen('auth'); return; }

  const res = await apiMe();
  if (res.error) { localStorage.removeItem('ck_token'); showScreen('auth'); return; }

  await loadBadgeMeta();
  loadState(res);
  renderUpgrades();
  showScreen('game');
}

init();
