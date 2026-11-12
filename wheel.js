// Match the reference site's Lenis wheel easing while leaving touch native.
(() => {
  if (!window.matchMedia || typeof window.Lenis !== 'function') return;

  const pointer = matchMedia('(hover: hover) and (pointer: fine)');
  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
  let lenis = null;

  function updateScrolling() {
    const enabled = pointer.matches && !reducedMotion.matches &&
      !document.documentElement.classList.contains('is-phone');
    if (enabled && !lenis) {
      lenis = new window.Lenis({
        lerp: 0.1,
        anchors: true,
        allowNestedScroll: true,
        syncTouch: false,
        autoRaf: true
      });
    } else if (!enabled && lenis) {
      // Reset an in-flight native scroll before cleanup so its delayed
      // completion cannot restore Lenis classes after the instance is gone.
      lenis.stop();
      lenis.destroy();
      lenis = null;
    }
  }

  function interruptMomentum() {
    if (!lenis) return;
    lenis.stop();
    lenis.start();
  }

  document.addEventListener('pointerdown', interruptMomentum, { passive: true, capture: true });
  document.addEventListener('keydown', event => {
    if (['ArrowUp', 'ArrowDown', 'PageUp', 'PageDown', 'Home', 'End', ' '].includes(event.key)) interruptMomentum();
  }, true);
  document.addEventListener('visibilitychange', () => { if (document.hidden) interruptMomentum(); });
  window.addEventListener('blur', interruptMomentum);
  for (const media of [pointer, reducedMotion]) {
    if (media.addEventListener) media.addEventListener('change', updateScrolling);
    else media.addListener(updateScrolling);
  }
  updateScrolling();
})();
