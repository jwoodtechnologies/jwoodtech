const LOGO_URL =
  "https://customer-assets.emergentagent.com/job_jwood-premium/artifacts/js25yd23_IMG_6989.png";

export const JwoodLogo = ({ className = "h-8 md:h-10", onClick, testId = "jwood-logo" }) => {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`group flex items-center select-none cursor-pointer focus:outline-none ${className}`}
      data-testid={testId}
      aria-label="Jwood Technologies"
    >
      <img
        src={LOGO_URL}
        alt="Jwood Technologies"
        draggable={false}
        className="h-full w-auto object-contain transition-opacity duration-300 group-hover:opacity-90 drop-shadow-[0_2px_24px_rgba(255,255,255,0.18)]"
        style={{ maxWidth: "min(70vw, 360px)" }}
      />
    </button>
  );
};

export default JwoodLogo;
