async function init() {
  setupAuthUI();
  setupGameUI();

  const token = localStorage.getItem('token');
  if (!token) {
    showScreen('auth');
    return;
  }

  const res = await apiMe();
  if (res.error) {
    localStorage.removeItem('token');
    showScreen('auth');
    return;
  }

  loadGameState(res);
  renderUpgrades();
  showScreen('game');
}

init();
