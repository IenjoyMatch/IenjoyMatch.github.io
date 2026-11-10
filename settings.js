// Apply saved appearance before the page paints to avoid a light-theme flash.
(() => {
  const key = 'ienjoymatch-appearance-v1';
  let saved = {};
  try { saved = JSON.parse(localStorage.getItem(key) || '{}') || {}; } catch (_) {}
  const state = { dark: saved.dark === true, material: saved.material !== false };

  function apply() {
    document.documentElement.dataset.theme = state.dark ? 'dark' : 'light';
    document.documentElement.dataset.material = state.material ? 'on' : 'off';
  }
  apply();

  window.portfolioAppearance = {
    get: () => ({ ...state }),
    set(update) {
      if (typeof update.dark === 'boolean') state.dark = update.dark;
      if (typeof update.material === 'boolean') state.material = update.material;
      apply();
      try { localStorage.setItem(key, JSON.stringify(state)); } catch (_) {}
      window.dispatchEvent(new CustomEvent('portfolio:appearance', { detail: { ...state } }));
    }
  };
})();
