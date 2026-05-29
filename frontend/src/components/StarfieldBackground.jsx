import { useEffect, useRef } from "react";

export default function StarfieldBackground() {
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");

    let width, height, raf;
    let stars = [];

    const LAYERS = [
      { count: 220, speed: 0.012, minSize: 0.3, maxSize: 0.6, opacity: 0.35 },
      { count: 110, speed: 0.028, minSize: 0.5, maxSize: 0.9, opacity: 0.55 },
      { count: 45,  speed: 0.055, minSize: 0.8, maxSize: 1.4, opacity: 0.85 },
    ];

    function resize() {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      width = window.innerWidth;
      height = window.innerHeight;
      canvas.width = Math.round(width * dpr);
      canvas.height = Math.round(height * dpr);
      canvas.style.width = width + "px";
      canvas.style.height = height + "px";
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      buildStars();
    }

    function buildStars() {
      stars = [];
      for (const l of LAYERS) {
        for (let i = 0; i < l.count; i++) {
          stars.push({
            x: Math.random() * width,
            y: Math.random() * height,
            size: l.minSize + Math.random() * (l.maxSize - l.minSize),
            speed: l.speed * (0.7 + Math.random() * 0.6),
            alpha: l.opacity * (0.4 + Math.random() * 0.6),
            phase: Math.random() * Math.PI * 2,
            freq: 0.004 + Math.random() * 0.008,
          });
        }
      }
    }

    function frame() {
      ctx.clearRect(0, 0, width, height);
      for (const s of stars) {
        s.y -= s.speed;
        if (s.y < -2) {
          s.y = height + 2;
          s.x = Math.random() * width;
        }
        s.phase += s.freq;
        const a = s.alpha * (0.55 + 0.45 * Math.sin(s.phase));
        ctx.beginPath();
        ctx.arc(s.x, s.y, s.size, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(255,255,255,${a.toFixed(3)})`;
        ctx.fill();
      }
      raf = requestAnimationFrame(frame);
    }

    resize();
    window.addEventListener("resize", resize);
    raf = requestAnimationFrame(frame);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", resize);
    };
  }, []);

  return (
    <div
      className="fixed inset-0 pointer-events-none select-none"
      style={{ zIndex: 0, background: "hsl(260 87% 3%)" }}
      aria-hidden="true"
    >
      <canvas ref={canvasRef} className="absolute inset-0" />
    </div>
  );
}
