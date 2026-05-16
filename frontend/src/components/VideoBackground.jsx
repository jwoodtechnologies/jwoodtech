import { useEffect, useRef } from "react";

const VIDEO_URL =
  "https://customer-assets.emergentagent.com/job_jwood-premium/artifacts/e54ms20w_7782667-hd_1080_1920_25fps.MP4";

/**
 * iOS Safari insists on rendering its own play/pause overlay on top of any
 * visible <video> element (especially when Low Power Mode blocks autoplay).
 * CSS can NOT suppress that overlay — it lives above the shadow DOM.
 *
 * Trick used by apple.com & stripe.com hero videos: keep a hidden <video> that
 * just decodes frames, and paint them into a <canvas>. iOS cannot attach media
 * controls to a canvas, so the play/pause chrome can never appear.
 */
export const VideoBackground = () => {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);

  useEffect(() => {
    const v = videoRef.current;
    const c = canvasRef.current;
    if (!v || !c) return;

    const ctx = c.getContext("2d");
    v.muted = true;
    v.defaultMuted = true;
    v.playsInline = true;

    let raf = 0;

    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      c.width = Math.floor(window.innerWidth * dpr);
      c.height = Math.floor(window.innerHeight * dpr);
    };
    resize();
    window.addEventListener("resize", resize);

    const draw = () => {
      if (v.readyState >= 2 && !v.paused) {
        // object-fit: cover equivalent
        const vw = v.videoWidth || 16;
        const vh = v.videoHeight || 9;
        const cw = c.width;
        const ch = c.height;
        const vr = vw / vh;
        const cr = cw / ch;
        let dw, dh, dx, dy;
        if (cr > vr) {
          dw = cw;
          dh = cw / vr;
          dx = 0;
          dy = (ch - dh) / 2;
        } else {
          dh = ch;
          dw = ch * vr;
          dy = 0;
          dx = (cw - dw) / 2;
        }
        ctx.drawImage(v, dx, dy, dw, dh);
      }
      raf = requestAnimationFrame(draw);
    };

    const tryPlay = () => {
      const p = v.play();
      if (p && typeof p.catch === "function") p.catch(() => {});
    };
    tryPlay();
    raf = requestAnimationFrame(draw);

    // Retry on visibility / any touch — breaks past iOS autoplay guards.
    const onVis = () => document.visibilityState === "visible" && tryPlay();
    const onTouch = () => tryPlay();
    document.addEventListener("visibilitychange", onVis);
    window.addEventListener("touchstart", onTouch, { passive: true });
    window.addEventListener("click", onTouch);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", resize);
      document.removeEventListener("visibilitychange", onVis);
      window.removeEventListener("touchstart", onTouch);
      window.removeEventListener("click", onTouch);
    };
  }, []);

  return (
    <div
      className="fixed inset-0 z-0 overflow-hidden bg-black pointer-events-none select-none"
      aria-hidden="true"
      data-testid="video-background"
    >
      {/* Hidden decoder — 1×1 off-screen so iOS can't render any media chrome */}
      <video
        ref={videoRef}
        src={VIDEO_URL}
        autoPlay
        muted
        loop
        playsInline
        preload="auto"
        disablePictureInPicture
        disableRemotePlayback
        controls={false}
        tabIndex={-1}
        {...{
          "webkit-playsinline": "true",
          "x5-playsinline": "true",
          "x5-video-player-type": "h5-page",
        }}
        style={{
          position: "absolute",
          width: 1,
          height: 1,
          top: -9999,
          left: -9999,
          opacity: 0,
          pointerEvents: "none",
        }}
      />
      <canvas
        ref={canvasRef}
        className="absolute inset-0 w-full h-full pointer-events-none"
        data-testid="video-canvas"
      />
      {/* Soft dark vignette + slight tint for legibility */}
      <div className="absolute inset-0 bg-black/40 pointer-events-none" />
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background:
            "radial-gradient(ellipse at center, rgba(0,0,0,0) 0%, rgba(0,0,0,0.55) 100%)",
        }}
      />
    </div>
  );
};

export default VideoBackground;
