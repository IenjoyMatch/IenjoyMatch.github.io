(() => {
  const menu = document.querySelector('.mobile-menu');
  const button = menu?.querySelector('.menu-trigger');
  const buttons = menu ? [...menu.querySelectorAll('.back-top')] : [];
  if (!button || !buttons.length) return;
  const ua = navigator.userAgent || '';
  const isIPad = /iPad/i.test(ua) || (/Macintosh/i.test(ua) && navigator.maxTouchPoints > 1);
  const androidPhone = /Android/i.test(ua) &&
    (/Mobile/i.test(ua) || Math.min(window.screen.width, window.screen.height) <= 500);
  const isPhone = !isIPad && (navigator.userAgentData?.mobile === true || androidPhone ||
    /iPhone|iPod|Windows Phone|IEMobile|Opera Mini/i.test(ua));
  if (!isPhone) return;
  document.documentElement.classList.add('is-phone');
  const svgNS = 'http://www.w3.org/2000/svg';
  const advancedEnabled = () => document.documentElement.dataset.material !== 'off';
  let initialized = false;

  /*
   * Circular edge refraction adapted from AndroidLiquidGlass / the supplied
   * miuix_liquid_lens.frag. Copyright 2025 Kyant, Apache License 2.0.
   * Modified for a circular web surface using seven SVG backdrop samples and
   * the shader's spectral channel weights. Flutter-specific inputs are replaced
   * by a live browser backdrop, with a blur-only fallback on unverified paths.
   * See THIRD-PARTY-NOTICES.txt and LICENSE-APACHE-2.0.txt.
   */
  function createLensMaps() {
    const size = 128, surfaceSize = 52, radius = surfaceSize / 2;
    const refractionHeight = 12, refractionAmount = 6, dispersionAmount = 1.2, filterScale = 20;
    const spectrum = [
      { name: 'red', offset: 1, weights: [2 / 7, 0, 0] },
      { name: 'orange', offset: 2 / 3, weights: [2 / 7, 1 / 7, 0] },
      { name: 'yellow', offset: 1 / 3, weights: [2 / 7, 2 / 7, 0] },
      { name: 'green', offset: 0, weights: [0, 2 / 7, 0] },
      { name: 'cyan', offset: -1 / 3, weights: [0, 2 / 7, 1 / 3] },
      { name: 'blue', offset: -2 / 3, weights: [0, 0, 1 / 3] },
      { name: 'purple', offset: -1, weights: [1 / 7, 0, 1 / 3] }
    ];
    const maps = spectrum.map(sample => {
      const canvas = document.createElement('canvas');
      canvas.width = canvas.height = size;
      const ctx = canvas.getContext('2d');
      return ctx ? { ...sample, canvas, ctx, pixels: ctx.createImageData(size, size) } : null;
    });
    if (maps.some(map => !map)) return null;
    const limit = value => Math.max(-filterScale / 2, Math.min(filterScale / 2, value));
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        const px = ((x + .5) / size - .5) * surfaceSize;
        const py = ((y + .5) / size - .5) * surfaceSize;
        const distanceFromCenter = Math.hypot(px, py);
        const distanceInside = radius - distanceFromCenter;
        let dx = 0, dy = 0;
        if (distanceInside >= 0 && distanceInside < refractionHeight && distanceFromCenter > 0) {
          const edge = 1 - distanceInside / refractionHeight;
          const displacement = (1 - Math.sqrt(Math.max(0, 1 - edge * edge))) * refractionAmount;
          dx = displacement * px / distanceFromCenter;
          dy = displacement * py / distanceFromCenter;
        }
        const dispersion = dispersionAmount * px * py / (radius * radius);
        const i = (y * size + x) * 4;
        maps.forEach(map => {
          const factor = 1 + dispersion * map.offset;
          map.pixels.data[i] = Math.round(255 * (.5 + limit(dx * factor) / filterScale));
          map.pixels.data[i + 1] = Math.round(255 * (.5 + limit(dy * factor) / filterScale));
          map.pixels.data[i + 2] = 128;
          map.pixels.data[i + 3] = 255;
        });
      }
    }
    return maps.map(map => {
      map.ctx.putImageData(map.pixels, 0, 0);
      return { name: map.name, weights: map.weights, url: map.canvas.toDataURL('image/png') };
    });
  }

  function installLens() {
    if (initialized || !advancedEnabled()) return;
    initialized = true;
    // Unknown WebKit / WebView paths retain genuine backdrop blur instead of
    // risking shifted or corrupted SVG samples on unverified mobile GPUs.
    const blinkVersion = ua.match(/(?:Chrome|Chromium)\/(\d+)/i);
    const constrainedDevice = typeof navigator.deviceMemory === 'number' && navigator.deviceMemory <= 2;
    const stableBlink = /Android/i.test(ua) && blinkVersion && Number(blinkVersion[1]) >= 120 && !/;\s*wv\)/i.test(ua) && !constrainedDevice;
    const supported = typeof CSS !== 'undefined' && typeof CSS.supports === 'function' &&
      (CSS.supports('backdrop-filter', 'url("#liquid-glass-lens")') ||
      CSS.supports('-webkit-backdrop-filter', 'url("#liquid-glass-lens")'));
    if (!stableBlink || !supported) return;
    try {
      const maps = createLensMaps();
      if (!maps) return;
      const svg = document.createElementNS(svgNS, 'svg');
      svg.setAttribute('width', '0'); svg.setAttribute('height', '0');
      svg.setAttribute('aria-hidden', 'true'); svg.setAttribute('focusable', 'false');
      svg.style.position = 'absolute'; svg.style.pointerEvents = 'none';
      const defs = document.createElementNS(svgNS, 'defs');
      const filter = document.createElementNS(svgNS, 'filter');
      filter.id = 'liquid-glass-lens';
      filter.setAttribute('x', '0'); filter.setAttribute('y', '0');
      filter.setAttribute('width', '100%'); filter.setAttribute('height', '100%');
      filter.setAttribute('color-interpolation-filters', 'sRGB');
      maps.forEach(map => {
        const image = document.createElementNS(svgNS, 'feImage');
        image.setAttribute('x', '0'); image.setAttribute('y', '0');
        image.setAttribute('width', '52'); image.setAttribute('height', '52');
        image.setAttribute('preserveAspectRatio', 'none');
        image.setAttribute('result', `${map.name}-map`);
        image.setAttribute('href', map.url);
        const displacement = document.createElementNS(svgNS, 'feDisplacementMap');
        displacement.setAttribute('in', 'SourceGraphic');
        displacement.setAttribute('in2', `${map.name}-map`);
        displacement.setAttribute('result', `${map.name}-sample`);
        displacement.setAttribute('scale', '20');
        displacement.setAttribute('xChannelSelector', 'R');
        displacement.setAttribute('yChannelSelector', 'G');
        const color = document.createElementNS(svgNS, 'feColorMatrix');
        color.setAttribute('in', `${map.name}-sample`);
        color.setAttribute('type', 'matrix');
        const [red, green, blue] = map.weights;
        color.setAttribute('values', `${red} 0 0 0 0  0 ${green} 0 0 0  0 0 ${blue} 0 0  0 0 0 0 1`);
        color.setAttribute('result', `${map.name}-channel`);
        filter.append(image, displacement, color);
      });
      let previous = `${maps[0].name}-channel`;
      maps.slice(1).forEach((map, index) => {
        const combined = document.createElementNS(svgNS, 'feComposite');
        combined.setAttribute('in', previous); combined.setAttribute('in2', `${map.name}-channel`);
        combined.setAttribute('operator', 'arithmetic'); combined.setAttribute('k2', '1');
        combined.setAttribute('k3', '1'); combined.setAttribute('result', `spectrum-${index}`);
        filter.append(combined);
        previous = `spectrum-${index}`;
      });
      defs.append(filter); svg.append(defs);
      document.body.append(svg);
      Promise.all(maps.map(map => new Promise(resolve => {
        const image = new Image();
        image.onload = () => resolve(true);
        image.onerror = () => resolve(false);
        image.src = map.url;
      }))).then(loaded => {
        if (loaded.every(Boolean)) buttons.forEach(control => control.classList.add('glass-lens-ready'));
      });
    } catch (_) {
      // Keep the blur-only surface if canvas or SVG filters are unavailable.
    }
  }

  function parseColor(value) {
    const match = value.match(/^rgba?\(\s*([\d.]+)[,\s]+([\d.]+)[,\s]+([\d.]+)(?:\s*[,/]\s*([\d.]+))?\s*\)$/i);
    return match ? [Number(match[1]), Number(match[2]), Number(match[3]), match[4] === undefined ? 1 : Number(match[4])] : null;
  }

  const imageCache = new WeakMap();
  function imageColorAt(image, style, x, y) {
    if (!image.complete || !image.naturalWidth || !image.naturalHeight) return null;
    const source = image.currentSrc || image.src;
    let cached = imageCache.get(image);
    const refreshAfter = typeof navigator.deviceMemory === 'number' && navigator.deviceMemory <= 2 ? 600 : 250;
    if (!cached || cached.source !== source || (!cached.unavailable && performance.now() - cached.sampledAt > refreshAfter)) {
      try {
        const canvas = document.createElement('canvas');
        const scale = Math.min(1, 128 / Math.max(image.naturalWidth, image.naturalHeight));
        canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
        canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
        const context = canvas.getContext('2d', { willReadFrequently: true });
        context.drawImage(image, 0, 0, canvas.width, canvas.height);
        cached = { source, sampledAt: performance.now(), width: canvas.width, height: canvas.height, pixels: context.getImageData(0, 0, canvas.width, canvas.height).data };
      } catch (_) {
        // Cross-origin images without CORS cannot be read; the native glass
        // still filters their live pixels, while the edge uses nearby colors.
        cached = { source, unavailable: true };
      }
      imageCache.set(image, cached);
    }
    if (cached.unavailable) return null;
    const rect = image.getBoundingClientRect();
    if (!rect.width || !rect.height) return null;
    let width = rect.width, height = rect.height;
    if (style.objectFit === 'cover' || style.objectFit === 'contain') {
      const ratio = style.objectFit === 'cover'
        ? Math.max(rect.width / image.naturalWidth, rect.height / image.naturalHeight)
        : Math.min(rect.width / image.naturalWidth, rect.height / image.naturalHeight);
      width = image.naturalWidth * ratio; height = image.naturalHeight * ratio;
    }
    const position = style.objectPosition.split(/\s+/);
    const fraction = value => value?.endsWith('%') ? parseFloat(value) / 100 : .5;
    const u = (x - rect.left - (rect.width - width) * fraction(position[0])) / width;
    const v = (y - rect.top - (rect.height - height) * fraction(position[1] || position[0])) / height;
    if (u < 0 || u >= 1 || v < 0 || v >= 1) return null;
    const ix = Math.min(cached.width - 1, Math.floor(u * cached.width));
    const iy = Math.min(cached.height - 1, Math.floor(v * cached.height));
    const i = (iy * cached.width + ix) * 4, p = cached.pixels;
    return [p[i], p[i + 1], p[i + 2], p[i + 3] / 255];
  }

  function gradientEstimate(value) {
    if (!/gradient\(/i.test(value)) return null;
    const colors = [...value.matchAll(/rgba?\([^)]*\)/gi)].map(match => parseColor(match[0])).filter(Boolean);
    if (!colors.length) return null;
    const levels = colors.map(color => (.2126 * color[0] + .7152 * color[1] + .0722 * color[2]) / 255);
    return {
      color: colors[0].map((_, index) => colors.reduce((sum, color) => sum + color[index], 0) / colors.length),
      uncertain: Math.min(...levels) < .25 && Math.max(...levels) > .75
    };
  }

  // Native backdrop-filter samples the live pixels. Nearby readable DOM / image
  // colors provide a separate, approximate contribution to the thin rim.
  function sampleBackdrop(x, y) {
    x = Math.max(0, Math.min(window.innerWidth - 1, x));
    y = Math.max(0, Math.min(window.innerHeight - 1, y));
    let r = 0, g = 0, b = 0, alpha = 0, rimReliable = true;
    function layer(color, opacity) {
      if (!color || alpha >= .995) return;
      const weight = (1 - alpha) * color[3] * opacity;
      r += color[0] * weight; g += color[1] * weight; b += color[2] * weight; alpha += weight;
    }
    for (const element of document.elementsFromPoint(x, y)) {
      if (element === menu || menu.contains(element)) continue;
      const style = getComputedStyle(element), opacity = Number(style.opacity);
      if (style.visibility === 'hidden' || opacity === 0) continue;
      const tag = element.tagName.toLowerCase();
      if (tag === 'img') {
        const color = imageColorAt(element, style, x, y);
        if (color) layer(color, opacity); else rimReliable = false;
      } else if (['video', 'canvas', 'picture'].includes(tag)) {
        rimReliable = false;
      }
      if (style.backgroundImage !== 'none') {
        // A gradient's average is not its local pixel color. Leave the rim to
        // the native backdrop instead of painting an invented hue.
        rimReliable = false;
        const estimate = gradientEstimate(style.backgroundImage);
        if (estimate) layer(estimate.color, opacity);
      }
      layer(parseColor(style.backgroundColor), opacity);
      if (alpha >= .995) break;
    }
    if (alpha < .995) { const rest = 1 - alpha; r += 245 * rest; g += 245 * rest; b += 245 * rest; }
    return { rgb: [r, g, b], rimReliable };
  }

  function updateBackdropTone(button) {
    const rect = button.getBoundingClientRect();
    if (!rect.width || !rect.height) return;
    const cx = rect.left + rect.width / 2, cy = rect.top + rect.height / 2;
    const radius = Math.min(rect.width, rect.height) / 2 + 6;
    for (let i = 0; i < 8; i++) {
      const angle = i * Math.PI / 4, dx = Math.sin(angle) * radius, dy = -Math.cos(angle) * radius;
      const near = sampleBackdrop(cx + dx, cy + dy);
      const across = sampleBackdrop(cx - dx, cy - dy);
      const nearWeight = near.rimReliable ? .62 : 0, acrossWeight = across.rimReliable ? .38 : 0;
      const weight = nearWeight + acrossWeight;
      // Two opposed, directional light responses mirror the bloom-stroke
      // shader's squared-normal falloff instead of drawing a white ring.
      const nx = Math.sin(angle), ny = -Math.cos(angle);
      const key = Math.max(0, -nx * .65 - ny * .76);
      const fill = Math.max(0, nx * .72 + ny * .69);
      const glint = .05 + .18 * key * key + .10 * fill * fill;
      const strength = (.18 + .32 * key * key + .16 * fill * fill) * weight;
      const color = near.rgb.map((value, index) => weight ? Math.round(((value * nearWeight + across.rgb[index] * acrossWeight) / weight) * (1 - glint) + 255 * glint) : 0);
      const name = `--glass-rim-${i}`, value = `rgba(${color[0]},${color[1]},${color[2]},${strength.toFixed(2)})`;
      if (button.style.getPropertyValue(name) !== value) button.style.setProperty(name, value);
    }
  }

  let toneFrame = 0, toneTimer = 0, lastToneUpdate = 0;
  function scheduleBackdropTone() {
    if (!advancedEnabled()) {
      if (toneFrame) cancelAnimationFrame(toneFrame);
      if (toneTimer) clearTimeout(toneTimer);
      toneFrame = toneTimer = 0;
      return;
    }
    if (toneFrame || toneTimer) return;
    const wait = Math.max(0, 80 - (performance.now() - lastToneUpdate));
    const queue = () => {
      toneTimer = 0;
      toneFrame = requestAnimationFrame(() => {
        toneFrame = 0;
        if (!advancedEnabled()) return;
        lastToneUpdate = performance.now();
        const activeButtons = menu.classList.contains('is-open') ? buttons : [button];
        activeButtons.forEach(updateBackdropTone);
      });
    };
    if (wait) toneTimer = setTimeout(queue, wait);
    else queue();
  }

  function positionLight(button, event) {
    const rect = button.getBoundingClientRect();
    const clamp = value => Math.max(0, Math.min(1, value));
    const x = 16 + 68 * clamp((event.clientX - rect.left) / rect.width);
    const y = 12 + 68 * clamp((event.clientY - rect.top) / rect.height);
    button.style.setProperty('--glass-light-x', `${x.toFixed(1)}%`);
    button.style.setProperty('--glass-light-y', `${y.toFixed(1)}%`);
  }
  function resetLight(button) {
    button.classList.remove('is-pressed');
    button.style.removeProperty('--glass-light-x');
    button.style.removeProperty('--glass-light-y');
  }
  buttons.forEach(control => {
    control.addEventListener('pointerdown', event => {
      if (advancedEnabled()) positionLight(control, event);
      control.classList.add('is-pressed');
      scheduleBackdropTone();
    }, { passive: true });
    control.addEventListener('pointermove', event => {
      if (advancedEnabled() && control.classList.contains('is-pressed')) positionLight(control, event);
    }, { passive: true });
    control.addEventListener('pointerup', () => resetLight(control), { passive: true });
    control.addEventListener('pointercancel', () => resetLight(control), { passive: true });
    control.addEventListener('pointerleave', () => resetLight(control), { passive: true });
  });
  window.addEventListener('scroll', scheduleBackdropTone, { passive: true });
  window.addEventListener('resize', scheduleBackdropTone, { passive: true });
  window.addEventListener('load', scheduleBackdropTone, { once: true });
  const backdropObserver = new MutationObserver(records => {
    if (records.some(record => record.target !== menu && !menu.contains(record.target))) scheduleBackdropTone();
  });
  backdropObserver.observe(document.body, { subtree: true, attributes: true, attributeFilter: ['style', 'class', 'src'] });
  const sampleInterval = typeof navigator.deviceMemory === 'number' && navigator.deviceMemory <= 2 ? 240 : 120;
  window.setInterval(() => { if (!document.hidden && advancedEnabled()) scheduleBackdropTone(); }, sampleInterval);
  document.addEventListener('visibilitychange', () => { if (!document.hidden) scheduleBackdropTone(); });
  window.addEventListener('portfolio:appearance', () => {
    if (advancedEnabled()) installLens();
    scheduleBackdropTone();
  });
  menu.addEventListener('transitionrun', scheduleBackdropTone);
  document.fonts?.ready.then(scheduleBackdropTone);
  scheduleBackdropTone();
  installLens();
})();
