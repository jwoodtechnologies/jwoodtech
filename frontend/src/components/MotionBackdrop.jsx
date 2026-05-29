import { useEffect, useRef } from "react";

const VIDEO_SRC =
  "https://d8j0ntlcm91z4.cloudfront.net/user_38xzZboKViGWJOttwIXH07lWA1P/hf_20260328_065045_c44942da-53c6-4804-b734-f9e07fc22e08.mp4";

export default function MotionBackdrop() {
  const videoRef = useRef(null);
  const rafRef = useRef(null);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    let cancelled = false;

    function fadeIn() {
      if (cancelled) return;
      const start = performance.now();
      function tick(now) {
        if (cancelled) return;
        const t = Math.min((now - start) / 500, 1);
        video.style.opacity = t;
        if (t < 1) rafRef.current = requestAnimationFrame(tick);
      }
      rafRef.current = requestAnimationFrame(tick);
    }

    function fadeOut(onDone) {
      if (cancelled) return;
      const start = performance.now();
      function tick(now) {
        if (cancelled) return;
        const t = Math.min((now - start) / 500, 1);
        video.style.opacity = 1 - t;
        if (t < 1) rafRef.current = requestAnimationFrame(tick);
        else onDone();
      }
      rafRef.current = requestAnimationFrame(tick);
    }

    function handleTimeUpdate() {
      if (!video.duration) return;
      if (video.duration - video.currentTime <= 0.5 && parseFloat(video.style.opacity) > 0) {
        video.removeEventListener("timeupdate", handleTimeUpdate);
        fadeOut(() => {});
      }
    }

    function handleEnded() {
      video.style.opacity = 0;
      setTimeout(() => {
        if (cancelled) return;
        video.currentTime = 0;
        video.play().catch(() => {});
        video.addEventListener("timeupdate", handleTimeUpdate);
        fadeIn();
      }, 100);
    }

    video.style.opacity = 0;
    video.play().catch(() => {});
    video.addEventListener("timeupdate", handleTimeUpdate);
    video.addEventListener("ended", handleEnded);
    fadeIn();

    return () => {
      cancelled = true;
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      video.removeEventListener("timeupdate", handleTimeUpdate);
      video.removeEventListener("ended", handleEnded);
    };
  }, []);

  return (
    <div
      className="fixed inset-0 pointer-events-none select-none overflow-hidden"
      style={{ zIndex: 0, background: "hsl(260 87% 3%)" }}
      aria-hidden="true"
    >
      <video
        ref={videoRef}
        src={VIDEO_SRC}
        className="bg-video absolute inset-0 w-full h-full object-cover"
        muted
        playsInline
        loop={false}
        preload="auto"
        disablePictureInPicture
        style={{ opacity: 0 }}
      />
      {/* Subtle dark vignette for text legibility across the whole page */}
      <div
        className="absolute inset-0"
        style={{
          background:
            "radial-gradient(ellipse at center, rgba(0,0,0,0.1) 0%, rgba(0,0,0,0.55) 100%)",
        }}
      />
    </div>
  );
}
