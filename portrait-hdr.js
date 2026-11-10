// An optional HDR highlight; the CSS wave remains the fallback on all screens.
(() => {
  const portrait = document.querySelector('.portrait');
  const ring = portrait && portrait.querySelector('.portrait-ring');
  if (!ring || !navigator.gpu || !window.matchMedia || !('IntersectionObserver' in window)) return;

  const highRange = matchMedia('(dynamic-range: high)');
  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
  let visible = false;
  let disabled = false;
  let initializing = false;
  let gpu = null;
  let frame = 0;
  let lastDraw = 0;

  const active = () => visible && !document.hidden && highRange.matches && !reducedMotion.matches;

  function resize() {
    if (!gpu) return;
    const scale = Math.min(window.devicePixelRatio || 1, 1.5);
    // Use layout dimensions, not the animated transform, to avoid reallocating
    // the GPU surface on every frame of the breathing animation.
    const width = Math.max(1, Math.round(ring.clientWidth * scale));
    const height = Math.max(1, Math.round(ring.clientHeight * scale));
    if (gpu.canvas.width !== width || gpu.canvas.height !== height) {
      gpu.canvas.width = width;
      gpu.canvas.height = height;
    }
  }

  function stop() {
    if (frame) cancelAnimationFrame(frame);
    frame = 0;
    if (gpu) gpu.canvas.hidden = true;
  }

  function draw(now) {
    frame = 0;
    if (!gpu || !active()) return stop();
    if (now - lastDraw >= 33) {
      lastDraw = now;
      try {
        resize();
        const { device, context, pipeline, bindGroup, buffer, canvas } = gpu;
        device.queue.writeBuffer(buffer, 0, new Float32Array([canvas.width, canvas.height, now / 1000, 0]));
        const encoder = device.createCommandEncoder();
        const pass = encoder.beginRenderPass({
          colorAttachments: [{
            view: context.getCurrentTexture().createView(),
            clearValue: { r: 0, g: 0, b: 0, a: 0 },
            loadOp: 'clear',
            storeOp: 'store'
          }]
        });
        pass.setPipeline(pipeline);
        pass.setBindGroup(0, bindGroup);
        pass.draw(3);
        pass.end();
        device.queue.submit([encoder.finish()]);
        canvas.hidden = false;
      } catch (_) {
        disabled = true;
        stop();
        return;
      }
    }
    frame = requestAnimationFrame(draw);
  }

  async function initialize() {
    initializing = true;
    let device;
    try {
      const adapter = await navigator.gpu.requestAdapter({ powerPreference: 'low-power' });
      if (!adapter) throw new Error('WebGPU unavailable');
      device = await adapter.requestDevice();
      const canvas = document.createElement('canvas');
      canvas.className = 'portrait-hdr';
      canvas.setAttribute('aria-hidden', 'true');
      canvas.hidden = true;
      const context = canvas.getContext('webgpu');
      if (!context || typeof context.getConfiguration !== 'function') throw new Error('HDR canvas unavailable');
      device.pushErrorScope('validation');
      context.configure({ device, format: 'rgba16float', alphaMode: 'premultiplied', toneMapping: { mode: 'extended' } });
      if (context.getConfiguration()?.toneMapping?.mode !== 'extended') throw new Error('HDR tone mapping unavailable');

      const shader = device.createShaderModule({ code: `
        struct Params { resolution: vec2<f32>, time: f32, padding: f32 }
        @group(0) @binding(0) var<uniform> params: Params;
        @vertex fn vertexMain(@builtin(vertex_index) i: u32) -> @builtin(position) vec4<f32> {
          let points = array<vec2<f32>, 3>(vec2<f32>(-1.0, -1.0), vec2<f32>(3.0, -1.0), vec2<f32>(-1.0, 3.0));
          return vec4<f32>(points[i], 0.0, 1.0);
        }
        @fragment fn fragmentMain(@builtin(position) position: vec4<f32>) -> @location(0) vec4<f32> {
          let p = (position.xy / params.resolution - vec2<f32>(0.5)) * 2.0;
          let radius = length(p);
          let phase = fract(params.time / 4.0);
          let waveRadius = 0.80 + 0.20 * phase;
          let distance = (radius - waveRadius) / 0.025;
          let wideDistance = (radius - waveRadius) / 0.06;
          let wave = exp(-distance * distance);
          let glow = exp(-wideDistance * wideDistance);
          let fade = smoothstep(0.0, 0.18, phase) * (1.0 - smoothstep(0.8, 1.0, phase));
          let clip = 1.0 - smoothstep(0.98, 1.0, radius);
          let alpha = (wave * 0.42 + glow * 0.08) * fade * clip;
          return vec4<f32>(vec3<f32>(1.9, 1.48, 0.65) * alpha, alpha);
        }
      ` });
      const pipeline = await device.createRenderPipelineAsync({
        layout: 'auto',
        vertex: { module: shader, entryPoint: 'vertexMain' },
        fragment: { module: shader, entryPoint: 'fragmentMain', targets: [{ format: 'rgba16float' }] },
        primitive: { topology: 'triangle-list' }
      });
      const buffer = device.createBuffer({ size: 16, usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST });
      const bindGroup = device.createBindGroup({
        layout: pipeline.getBindGroupLayout(0),
        entries: [{ binding: 0, resource: { buffer } }]
      });
      const validationError = await device.popErrorScope();
      if (validationError) throw validationError;
      ring.appendChild(canvas);
      gpu = { device, context, canvas, pipeline, buffer, bindGroup };
      device.lost.then(() => {
        disabled = true;
        stop();
        canvas.remove();
        gpu = null;
      });
    } catch (_) {
      disabled = true;
      if (device) device.destroy();
    } finally {
      initializing = false;
      sync();
    }
  }

  function sync() {
    if (!active()) return stop();
    if (!gpu) {
      if (!disabled && !initializing) initialize();
      return;
    }
    if (!frame) frame = requestAnimationFrame(draw);
  }

  new IntersectionObserver(entries => {
    visible = entries[0].isIntersecting;
    sync();
  }, { rootMargin: '50px' }).observe(portrait);
  highRange.addEventListener('change', sync);
  reducedMotion.addEventListener('change', sync);
  document.addEventListener('visibilitychange', sync);
  window.addEventListener('resize', resize, { passive: true });
})();
