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

  // Keep the whole footer mark hidden until its shared portrait is decoded.
  // The logo's white vector details and its image must appear together.
  document.documentElement.classList.add('footer-bird-loading');
  document.addEventListener('DOMContentLoaded', () => {
    const root = document.documentElement;
    const bird = document.querySelector('.footer-bird');
    const portrait = document.querySelector('.hero-portrait img');
    if (!bird || !portrait) {
      root.classList.remove('footer-bird-loading');
      return;
    }

    let revealed = false;
    let fallbackStarted = false;
    const show = image => {
      if (revealed) return;
      const source = image.currentSrc || image.src;
      if (!source) return;
      revealed = true;
      bird.querySelectorAll('image').forEach(element => {
        const href = element.getAttribute('href');
        if (!href || new URL(href, document.baseURI).href !== source) element.setAttribute('href', source);
      });
      // Give the SVG instances a paint opportunity after the bitmap is decoded.
      requestAnimationFrame(() => requestAnimationFrame(() => root.classList.remove('footer-bird-loading')));
    };
    const ready = image => {
      if (typeof image.decode !== 'function') return show(image);
      image.decode().then(() => show(image), () => {
        if (image.complete && image.naturalWidth) show(image);
        else useFallback();
      });
    };
    const useFallback = () => {
      if (revealed || fallbackStarted) return;
      fallbackStarted = true;
      const image = new Image();
      image.onload = () => ready(image);
      image.src = 'avatar.png';
    };

    if (portrait.complete) {
      if (portrait.naturalWidth) ready(portrait);
      else useFallback();
    } else {
      portrait.addEventListener('load', () => ready(portrait), { once: true });
      portrait.addEventListener('error', useFallback, { once: true });
    }
  }, { once: true });

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
