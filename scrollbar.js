// A draggable overlay for fine pointers; touch and unsupported browsers keep their native scrollbar.
(() => {
  const bar = document.querySelector('#page-scrollbar');
  const thumb = bar?.querySelector('.page-scrollbar-thumb');
  if (!bar || !thumb || !window.matchMedia || !window.requestAnimationFrame) return;

  const root = document.documentElement;
  const footer = document.querySelector('.site-footer');
  const finePointer = matchMedia('(hover: hover) and (pointer: fine)');
  const forcedColors = matchMedia('(forced-colors: active)');
  let frame = 0;
  let scrollRange = 0;
  let thumbHeight = 0;
  let travel = 0;
  let dragging = false;
  let pointerId = null;
  let dragOffset = 0;

  function update() {
    frame = 0;
    const viewport = root.clientHeight;
    const pageHeight = Math.max(root.scrollHeight, document.body.scrollHeight);
    scrollRange = Math.max(0, pageHeight - viewport);
    const enabled = finePointer.matches && !forcedColors.matches && scrollRange > 0;
    root.classList.toggle('has-page-scrollbar', enabled);
    bar.hidden = !enabled;
    if (!enabled) { endDrag(); return; }

    const trackHeight = bar.clientHeight;
    thumbHeight = Math.min(trackHeight, Math.max(48, trackHeight * viewport / pageHeight));
    travel = Math.max(0, trackHeight - thumbHeight);
    const progress = Math.max(0, Math.min(1, window.scrollY / scrollRange));
    thumb.style.height = `${thumbHeight}px`;
    thumb.style.transform = `translate3d(0,${progress * travel}px,0)`;
    if (footer) {
      const footerRect = footer.getBoundingClientRect();
      const thumbCenter = progress * travel + thumbHeight / 2;
      bar.classList.toggle('is-over-gold', thumbCenter >= footerRect.top + footerRect.height * .44 && thumbCenter <= footerRect.bottom);
    }
    const value = Math.round(progress * 100);
    bar.setAttribute('aria-valuenow', String(value));
    bar.setAttribute('aria-valuetext', `${value}%`);
  }

  function scheduleUpdate() {
    if (!frame) frame = requestAnimationFrame(update);
  }

  function scrollFromPointer(clientY) {
    if (!travel || !scrollRange) return;
    const trackTop = bar.getBoundingClientRect().top;
    const progress = Math.max(0, Math.min(1, (clientY - trackTop - dragOffset) / travel));
    window.scrollTo({ top: progress * scrollRange, behavior: 'instant' });
    scheduleUpdate();
  }

  function endDrag() {
    if (!dragging) return;
    dragging = false;
    if (pointerId !== null && bar.hasPointerCapture(pointerId)) bar.releasePointerCapture(pointerId);
    pointerId = null;
    bar.classList.remove('is-dragging');
    root.classList.remove('is-dragging-page-scrollbar');
  }

  bar.addEventListener('pointerdown', event => {
    if (event.button !== 0 || bar.hidden) return;
    const rect = thumb.getBoundingClientRect();
    dragOffset = event.clientY >= rect.top && event.clientY <= rect.bottom
      ? event.clientY - rect.top : thumbHeight / 2;
    dragging = true;
    pointerId = event.pointerId;
    bar.classList.add('is-dragging');
    root.classList.add('is-dragging-page-scrollbar');
    bar.setPointerCapture(pointerId);
    scrollFromPointer(event.clientY);
    event.preventDefault();
  });
  bar.addEventListener('pointermove', event => {
    if (dragging && event.pointerId === pointerId) scrollFromPointer(event.clientY);
  });
  bar.addEventListener('pointerup', endDrag);
  bar.addEventListener('pointercancel', endDrag);
  bar.addEventListener('lostpointercapture', endDrag);

  bar.addEventListener('keydown', event => {
    let target = window.scrollY;
    switch (event.key) {
      case 'ArrowDown': target += 40; break;
      case 'ArrowUp': target -= 40; break;
      case 'PageDown': target += root.clientHeight * .9; break;
      case 'PageUp': target -= root.clientHeight * .9; break;
      case 'Home': target = 0; break;
      case 'End': target = scrollRange; break;
      default: return;
    }
    event.preventDefault();
    window.scrollTo({ top: Math.max(0, Math.min(scrollRange, target)), behavior: 'instant' });
    scheduleUpdate();
  });

  window.addEventListener('scroll', scheduleUpdate, { passive: true });
  window.addEventListener('resize', scheduleUpdate);
  for (const media of [finePointer, forcedColors]) {
    if (media.addEventListener) media.addEventListener('change', scheduleUpdate);
    else media.addListener(scheduleUpdate);
  }
  if (window.ResizeObserver) {
    const observer = new ResizeObserver(scheduleUpdate);
    observer.observe(root);
    observer.observe(document.body);
  }
  if (document.fonts?.ready) document.fonts.ready.then(scheduleUpdate);
  update();
})();
