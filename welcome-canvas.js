/* === Silk Wave Canvas Animation for Welcome Screen === */
(function initWelcomeCanvas() {
  const modal = document.getElementById('cloud-sync-modal');
  const canvas = document.getElementById('welcome-canvas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  let W, H, animId;
  const WAVES = 7;

  function resize() {
    W = canvas.width = window.innerWidth;
    H = canvas.height = window.innerHeight;
  }

  window.addEventListener('resize', resize);
  resize();

  // Wave parameters
  const waves = Array.from({ length: WAVES }, (_, i) => ({
    amp: 55 + i * 18,
    freq: 0.0014 + i * 0.0004,
    speed: 0.00035 + i * 0.00012,
    phase: (Math.PI * 2 * i) / WAVES,
    yBase: 0.3 + (i / WAVES) * 0.6,
    thickness: 1.2 + i * 0.6,
    // Dark green palette — mirrors the fabric look in the reference
    hue: 140 + i * 6,
    lightness: 5 + i * 2.5,
    alpha: 0.55 - i * 0.05,
  }));

  let t = 0;

  function draw() {
    ctx.clearRect(0, 0, W, H);

    // Deep dark base
    const bg = ctx.createLinearGradient(0, 0, 0, H);
    bg.addColorStop(0, '#030d05');
    bg.addColorStop(1, '#060f08');
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, W, H);

    // Draw layered sinusoidal waves to mimic silk folds
    for (let wi = WAVES - 1; wi >= 0; wi--) {
      const w = waves[wi];
      const yMid = H * w.yBase;

      ctx.beginPath();
      ctx.moveTo(0, H);

      for (let x = 0; x <= W; x += 3) {
        const y = yMid +
          Math.sin(x * w.freq + t * w.speed + w.phase) * w.amp +
          Math.sin(x * w.freq * 1.7 + t * w.speed * 0.6 + w.phase * 1.3) * (w.amp * 0.45) +
          Math.cos(x * w.freq * 0.5 + t * w.speed * 1.4 + w.phase * 0.7) * (w.amp * 0.25);
        if (x === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }

      ctx.lineTo(W, H);
      ctx.closePath();

      const grad = ctx.createLinearGradient(0, yMid - w.amp, 0, yMid + w.amp + H * 0.1);
      grad.addColorStop(0, `hsla(${w.hue}, 55%, ${w.lightness + 5}%, ${w.alpha})`);
      grad.addColorStop(0.5, `hsla(${w.hue}, 60%, ${w.lightness}%, ${w.alpha * 0.7})`);
      grad.addColorStop(1, `hsla(${w.hue}, 45%, ${w.lightness - 2}%, 0)`);
      ctx.fillStyle = grad;
      ctx.fill();

      // Draw the wave ridge line for the silk sheen highlight
      ctx.beginPath();
      for (let x = 0; x <= W; x += 3) {
        const y = yMid +
          Math.sin(x * w.freq + t * w.speed + w.phase) * w.amp +
          Math.sin(x * w.freq * 1.7 + t * w.speed * 0.6 + w.phase * 1.3) * (w.amp * 0.45) +
          Math.cos(x * w.freq * 0.5 + t * w.speed * 1.4 + w.phase * 0.7) * (w.amp * 0.25);
        if (x === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.strokeStyle = `hsla(${w.hue + 20}, 70%, ${w.lightness + 18}%, ${w.alpha * 0.35})`;
      ctx.lineWidth = w.thickness;
      ctx.stroke();
    }

    // Subtle top vignette
    const vignette = ctx.createLinearGradient(0, 0, 0, H * 0.35);
    vignette.addColorStop(0, 'rgba(3,13,5,0.7)');
    vignette.addColorStop(1, 'rgba(3,13,5,0)');
    ctx.fillStyle = vignette;
    ctx.fillRect(0, 0, W, H);

    t++;
    animId = requestAnimationFrame(draw);
  }

  // Start/stop animation based on modal visibility
  const observer = new MutationObserver(() => {
    if (!modal.classList.contains('hidden')) {
      if (!animId) draw();
    } else {
      if (animId) { cancelAnimationFrame(animId); animId = null; }
    }
  });
  observer.observe(modal, { attributes: true, attributeFilter: ['class'] });
})();
