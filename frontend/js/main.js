async function init() {
  setupAuth();
  setupGame();

  const token = localStorage.getItem('ck_token');
  if (!token) {
    showScreen('auth');
    return;
  }

  const res = await apiMe();
  if (res.error) {
    localStorage.removeItem('ck_token');
    showScreen('auth');
    return;
  }

  loadState(res);
  renderUpgrades();
  showScreen('game');
}

init();
