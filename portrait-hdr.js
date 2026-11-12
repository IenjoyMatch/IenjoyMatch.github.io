// An optional HDR highlight; the CSS wave remains the fallback on all screens.
(() => {
  if (!navigator.gpu || !window.matchMedia || !('IntersectionObserver' in window)) return;
  // Reuse a single device across both portraits to avoid overlapping GPU contexts.
  let sharedDevicePromise = null;
  let sharedDeviceLost = false;
  function getSharedDevice() {
    if (!sharedDevicePromise) {
      sharedDevicePromise = navigator.gpu.requestAdapter({ powerPreference: 'low-power' })
        .then(adapter => {
          if (!adapter) throw new Error('WebGPU unavailable');
          return adapter.requestDevice();
        })
        .then(device => {
          device.lost.then(() => { sharedDeviceLost = true; });
          return device;
        })
        .catch(() => { sharedDeviceLost = true; return null; });
    }
    return sharedDevicePromise;
  }
  document.querySelectorAll('.portrait').forEach(portrait => {
    const ring = portrait.querySelector('.portrait-ring');
    if (!ring) return;

    const highRange = matchMedia('(dynamic-range: high)');
    const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
    const coarsePointer = matchMedia('(pointer: coarse)');
    let visible = false;
    let disabled = false;
    let initializing = false;
    let gpu = null;
    let frame = 0;

    const active = () => visible && !document.hidden && highRange.matches && !reducedMotion.matches && document.documentElement.dataset.material !== 'off';

    function resize() {
      if (!gpu) return;
      const scale = Math.min(window.devicePixelRatio || 1, coarsePointer.matches ? 1.25 : 1.5);
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
      // Keep presentation in step with the display, including high-refresh screens.
      try {
        const { device, context, pipeline, bindGroup, buffer, canvas, uniforms } = gpu;
        uniforms[0] = canvas.width;
        uniforms[1] = canvas.height;
        uniforms[2] = now / 1000;
        device.queue.writeBuffer(buffer, 0, uniforms);
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
        if (canvas.hidden) canvas.hidden = false;
      } catch (_) {
        disabled = true;
        stop();
        return;
      }
      frame = requestAnimationFrame(draw);
    }

    async function initialize() {
      initializing = true;
      let device;
      try {
        device = await getSharedDevice();
        if (!device || sharedDeviceLost) throw new Error('WebGPU unavailable');
        if (!active()) return;
        const canvas = document.createElement('canvas');
        canvas.className = 'portrait-hdr';
        canvas.setAttribute('aria-hidden', 'true');
        canvas.hidden = true;
        const scale = Math.min(window.devicePixelRatio || 1, coarsePointer.matches ? 1.25 : 1.5);
        canvas.width = Math.max(1, Math.round(ring.clientWidth * scale));
        canvas.height = Math.max(1, Math.round(ring.clientHeight * scale));
        const context = canvas.getContext('webgpu');
        if (!context || typeof context.getConfiguration !== 'function') throw new Error('HDR canvas unavailable');
        device.pushErrorScope('validation');
        context.configure({ device, format: 'rgba16float', alphaMode: 'premultiplied', toneMapping: { mode: 'extended' } });
        const validationError = await device.popErrorScope();
        if (validationError) throw validationError;
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
            let waveRadius = 0.80 + 0.16 * phase;
            // Two overlapping Gaussian profiles produce a soft feathered highlight.
            let distance = (radius - waveRadius) / 0.055;
            let wideDistance = (radius - waveRadius) / 0.12;
            let wave = exp(-distance * distance);
            let glow = exp(-wideDistance * wideDistance);
            let fade = smoothstep(0.0, 0.26, phase) * (1.0 - smoothstep(0.62, 1.0, phase));
            let clip = smoothstep(0.73, 0.84, radius) * (1.0 - smoothstep(0.92, 1.0, radius));
            let alpha = (wave * 0.20 + glow * 0.14) * fade * clip;
            return vec4<f32>(vec3<f32>(1.7, 1.38, 0.75) * alpha, alpha);
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
        // Keep the HDR surface outside the animated CSS mask and backdrop
        // layer; the shader already feathers its own transparent edges.
        portrait.appendChild(canvas);
        gpu = { device, context, canvas, pipeline, buffer, bindGroup, uniforms: new Float32Array(4) };
        device.lost.then(() => {
          disabled = true;
          stop();
          canvas.remove();
          gpu = null;
        });
      } catch (_) {
        disabled = true;
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
    window.addEventListener('portfolio:appearance', sync);
    document.addEventListener('visibilitychange', sync);
    window.addEventListener('resize', resize, { passive: true });
    if ('ResizeObserver' in window) new ResizeObserver(resize).observe(ring);
  });
})();
