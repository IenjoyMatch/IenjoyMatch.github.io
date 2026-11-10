(() => {
  const menu = document.querySelector('.mobile-menu');
  const trigger = menu?.querySelector('.menu-trigger');
  const actions = document.querySelector('#quick-actions');
  const material = document.querySelector('#material-toggle');
  const theme = document.querySelector('#theme-toggle');
  const top = document.querySelector('#quick-top');
  const appearance = window.portfolioAppearance;
  if (!menu || !trigger || !actions || !material || !theme || !top || !appearance) return;

  const items = [material, theme, top];
  const movingDots = [menu.querySelector('.menu-dot-top'), menu.querySelector('.menu-dot-middle')];
  let dotAnimations = [];
  let closeTimer = 0;
  let materialTimer = 0;
  let arrowTimer = 0;

  function animateDots(open) {
    const current = movingDots.map(dot => {
      const style = getComputedStyle(dot);
      return { transform: style.transform === 'none' ? 'translateY(0px)' : style.transform, opacity: Number(style.opacity) };
    });
    dotAnimations.forEach(animation => animation.cancel());
    dotAnimations = [];
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    movingDots.forEach((dot, index) => {
      if (typeof dot.animate !== 'function') return;
      const bottom = `translateY(${index === 0 ? 14 : 7}px)`;
      const start = { ...current[index], offset: 0, easing: 'cubic-bezier(.42,0,.58,1)' };
      const frames = open ? [
        start,
        { transform: bottom, opacity: 1, offset: .28, easing: 'cubic-bezier(.22,1.18,.36,1)' },
        { transform: 'translateY(0px)', opacity: 1, offset: 1 }
      ] : [
        start,
        { transform: bottom, opacity: 1, offset: .62 },
        { transform: bottom, opacity: 0, offset: .76 },
        { transform: 'translateY(0px)', opacity: 0, offset: .77 },
        { transform: 'translateY(0px)', opacity: 1, offset: 1 }
      ];
      dotAnimations.push(dot.animate(frames, { duration: 560, fill: 'none' }));
    });
  }

  function setOpen(open, returnFocus = false) {
    if (menu.classList.contains('is-open') !== open) animateDots(open);
    if (!open && closeTimer) { clearTimeout(closeTimer); closeTimer = 0; }
    menu.classList.toggle('is-open', open);
    trigger.setAttribute('aria-expanded', String(open));
    trigger.setAttribute('aria-label', open ? '关闭快捷菜单' : '打开快捷菜单');
    actions.setAttribute('aria-hidden', String(!open));
    items.forEach(item => { item.tabIndex = open ? 0 : -1; });
    if (returnFocus) trigger.focus({ preventScroll: true });
  }

  function reflectSettings() {
    const state = appearance.get();
    material.setAttribute('aria-checked', String(state.material));
    theme.setAttribute('aria-checked', String(state.dark));
  }

  trigger.addEventListener('click', () => setOpen(!menu.classList.contains('is-open')));
  material.addEventListener('click', () => {
    clearTimeout(materialTimer);
    material.classList.remove('is-changing');
    void material.offsetWidth;
    material.classList.add('is-changing');
    materialTimer = window.setTimeout(() => material.classList.remove('is-changing'), 700);
    appearance.set({ material: !appearance.get().material });
  });
  theme.addEventListener('click', () => appearance.set({ dark: !appearance.get().dark }));
  top.addEventListener('click', () => {
    clearTimeout(arrowTimer);
    if (closeTimer) clearTimeout(closeTimer);
    top.classList.remove('is-returning');
    void top.offsetWidth;
    top.classList.add('is-returning');
    arrowTimer = window.setTimeout(() => top.classList.remove('is-returning'), 700);
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    closeTimer = window.setTimeout(() => setOpen(false), reduced ? 0 : 430);
  });
  document.addEventListener('pointerdown', event => {
    if (menu.classList.contains('is-open') && !menu.contains(event.target)) setOpen(false);
  });
  document.addEventListener('keydown', event => {
    if (event.key === 'Escape' && menu.classList.contains('is-open')) {
      event.preventDefault();
      setOpen(false, true);
    }
  });
  window.addEventListener('portfolio:appearance', reflectSettings);
  window.addEventListener('storage', event => {
    if (event.key !== 'ienjoymatch-appearance-v1' || !event.newValue) return;
    try {
      const next = JSON.parse(event.newValue);
      appearance.set({ dark: next.dark === true, material: next.material !== false });
    } catch (_) {}
  });
  reflectSettings();
})();
