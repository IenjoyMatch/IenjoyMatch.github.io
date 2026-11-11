// Add a short deceleration to discrete desktop wheel notches; leave touchpads
// and touch scrolling to the browser's native momentum.
(() => {
  if (!window.matchMedia || !window.requestAnimationFrame) return;

  const pointer = matchMedia('(hover: hover) and (pointer: fine)');
  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
  const root = document.documentElement;
  let frame = 0;
  let target = 0;
  let lastTime = 0;
  let direction = 0;

  function stop() {
    if (frame) cancelAnimationFrame(frame);
    frame = 0;
    lastTime = 0;
    direction = 0;
    root.classList.remove('wheel-damping');
  }

  function step(now) {
    frame = 0;
    if (document.hidden || reducedMotion.matches || !pointer.matches) return stop();
    const scroller = document.scrollingElement || root;
    const maxY = Math.max(0, scroller.scrollHeight - scroller.clientHeight);
    target = Math.max(0, Math.min(target, maxY));
    const current = window.scrollY;
    const elapsed = lastTime ? Math.min(now - lastTime, 40) : 16.67;
    lastTime = now;
    const difference = target - current;
    if (Math.abs(difference) < 1) {
      window.scrollTo(0, target);
      return stop();
    }
    const ease = 1 - Math.exp(-elapsed / 110);
    const movement = difference * ease;
    // Some browsers round scroll positions to whole pixels; keep the last
    // few frames moving instead of stalling just short of the target.
    window.scrollTo(0, current + (Math.abs(movement) < 1 ? Math.sign(movement) : movement));
    frame = requestAnimationFrame(step);
  }

  function hasScrollableAncestor(start) {
    let node = start instanceof Element ? start : start?.parentElement;
    while (node && node !== document.body && node !== root) {
      const overflow = getComputedStyle(node).overflowY;
      if (/^(auto|scroll|overlay)$/.test(overflow) && node.scrollHeight > node.clientHeight + 1) return true;
      node = node.parentElement;
    }
    return false;
  }

  window.addEventListener('wheel', event => {
    const mode = event.deltaMode;
    const deltaY = event.deltaY;
    // Small pixel deltas are usually precision touchpad input, which already
    // carries its own momentum and should not be smoothed a second time.
    const precise = mode === 0 && Math.abs(deltaY) < 40;
    if (!pointer.matches || reducedMotion.matches || !event.cancelable || event.defaultPrevented ||
        event.ctrlKey || event.metaKey || event.shiftKey || precise ||
        !deltaY || Math.abs(event.deltaX) >= Math.abs(deltaY) || hasScrollableAncestor(event.target)) {
      if (frame) stop();
      return;
    }

    const delta = mode === 1 ? deltaY * 16 : mode === 2 ? deltaY * window.innerHeight : deltaY;
    if (!Number.isFinite(delta)) return;
    event.preventDefault();
    const scroller = document.scrollingElement || root;
    const maxY = Math.max(0, scroller.scrollHeight - scroller.clientHeight);
    const nextDirection = Math.sign(delta);
    if (!frame || nextDirection !== direction) target = window.scrollY;
    direction = nextDirection;
    target = Math.max(0, Math.min(target + delta, maxY));
    if (!frame) {
      root.classList.add('wheel-damping');
      frame = requestAnimationFrame(step);
    }
  }, { passive: false });

  document.addEventListener('pointerdown', stop, { passive: true, capture: true });
  document.addEventListener('keydown', event => {
    if (['ArrowUp','ArrowDown','PageUp','PageDown','Home','End',' '].includes(event.key)) stop();
  }, true);
  document.addEventListener('visibilitychange', () => { if (document.hidden) stop(); });
  window.addEventListener('blur', stop);
  reducedMotion.addEventListener?.('change', stop);
  pointer.addEventListener?.('change', stop);
})();
