(() => {
  const header = document.querySelector('.nav');
  const links = [...document.querySelectorAll('.nav nav a[href^="#"]')];
  const sections = links.map(link => document.querySelector(link.getAttribute('href')));
  function currentScrollY() {
    const scroller = document.scrollingElement || document.documentElement;
    const maxY = Math.max(0, scroller.scrollHeight - scroller.clientHeight);
    return Math.max(0, Math.min(window.scrollY, maxY));
  }
  let previousY = currentScrollY();
  let framePending = false;
  let awaitingFirstInteraction = true;
  let toneTimer = 0;

  function parseColor(value) {
    const match = value.match(/^rgba?\(\s*([\d.]+)[,\s]+([\d.]+)[,\s]+([\d.]+)(?:\s*[,/]\s*([\d.]+))?\s*\)$/i);
    return match ? [Number(match[1]), Number(match[2]), Number(match[3]), match[4] === undefined ? 1 : Number(match[4])] : null;
  }

  function hasTextAt(element, x, y) {
    for (const node of element.childNodes) {
      if (node.nodeType !== Node.TEXT_NODE || !node.nodeValue.trim()) continue;
      const range = document.createRange();
      range.selectNodeContents(node);
      const hit = [...range.getClientRects()].some(rect => x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom);
      range.detach?.();
      if (hit) return true;
    }
    return false;
  }

  // The browser composites the real backdrop. These small DOM probes only
  // choose a legible light/dark tint when content moves behind the navigation.
  function updateNavGlassTone() {
    toneTimer = 0;
    if (!document.elementsFromPoint) return;
    const y = Math.max(1, Math.min(window.innerHeight - 1, header.offsetHeight / 2));
    let brightness = 0, samples = 0, busy = false;
    for (const fraction of [.08, .29, .5, .71, .92]) {
      const x = Math.max(1, Math.min(window.innerWidth - 1, window.innerWidth * fraction));
      let r = 0, g = 0, b = 0, alpha = 0;
      function layer(color, opacity) {
        if (!color || alpha >= .995) return;
        const weight = (1 - alpha) * color[3] * opacity;
        r += color[0] * weight; g += color[1] * weight; b += color[2] * weight; alpha += weight;
      }
      for (const element of document.elementsFromPoint(x, y)) {
        if (element === header || header.contains(element)) continue;
        const style = getComputedStyle(element), opacity = Number(style.opacity);
        if (style.visibility === 'hidden' || opacity === 0) continue;
        if (['img', 'video', 'canvas', 'picture'].includes(element.tagName.toLowerCase())) busy = true;
        if (hasTextAt(element, x, y)) busy = true;
        if (style.backgroundImage !== 'none') {
          busy = true;
          const colors = [...style.backgroundImage.matchAll(/rgba?\([^)]*\)/gi)].map(m => parseColor(m[0])).filter(Boolean);
          if (colors.length) layer(colors[0].map((_, i) => colors.reduce((sum, color) => sum + color[i], 0) / colors.length), opacity);
        }
        layer(parseColor(style.backgroundColor), opacity);
        if (alpha >= .995) break;
      }
      if (alpha < .995) { const rest = 1 - alpha; r += 245 * rest; g += 245 * rest; b += 245 * rest; }
      brightness += (.2126 * r + .7152 * g + .0722 * b) / 255;
      samples++;
    }
    header.classList.toggle('nav-glass-dark', samples > 0 && brightness / samples < .48);
    header.classList.toggle('nav-glass-busy', busy);
  }

  function scheduleNavGlassTone() {
    if (toneTimer) return;
    toneTimer = window.setTimeout(() => requestAnimationFrame(updateNavGlassTone), 80);
  }

  function revealNavigation() {
    header.classList.remove('is-hidden');
  }

  function updateNavigation() {
    framePending = false;
    const y = currentScrollY();
    header.classList.toggle('is-scrolled', y > 40);

    const threshold = window.innerHeight * 0.48;
    let current = -1;
    sections.forEach((section, index) => {
      if (!section) return;
      const bounds = section.getBoundingClientRect();
      if (bounds.top <= threshold && bounds.bottom > threshold) current = index;
    });
    links.forEach((link, index) => {
      if (index === current) link.setAttribute('aria-current', 'location');
      else link.removeAttribute('aria-current');
    });

    // Initial hash navigation or scroll restoration should not hide the header.
    if (awaitingFirstInteraction) {
      previousY = y;
      return;
    }
    if (y === 0) {
      revealNavigation();
      previousY = y;
      return;
    }
    if (Math.abs(y - previousY) > 6) {
      header.classList.toggle('is-hidden', y > previousY);
      previousY = y;
    }
  }

  function onScroll() {
    scheduleNavGlassTone();
    if (!framePending) {
      framePending = true;
      window.requestAnimationFrame(updateNavigation);
    }
  }

  header.addEventListener('focusin', revealNavigation);
  function beginUserInteraction() {
    if (!awaitingFirstInteraction) return;
    awaitingFirstInteraction = false;
  }
  ['wheel', 'touchstart', 'pointerdown', 'keydown'].forEach(type => {
    window.addEventListener(type, beginUserInteraction, { passive: true, once: true });
  });
  window.addEventListener('load', () => {
    if (!awaitingFirstInteraction) return;
    previousY = currentScrollY();
    revealNavigation();
  }, { once: true });
  window.addEventListener('scroll', onScroll, { passive: true });
  window.addEventListener('resize', () => { updateNavigation(); scheduleNavGlassTone(); });
  window.addEventListener('load', scheduleNavGlassTone, { once: true });
  // Backdrop pixels are filtered continuously by the browser; refresh the
  // contrast tint as well when a video or animated background changes in place.
  window.setInterval(() => {
    if (!document.hidden && !header.classList.contains('is-hidden')) scheduleNavGlassTone();
  }, 200);
  document.addEventListener('visibilitychange', () => { if (!document.hidden) scheduleNavGlassTone(); });
  updateNavigation();
  scheduleNavGlassTone();
})();
