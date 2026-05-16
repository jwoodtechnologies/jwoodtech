import { useEffect, useRef, useState } from "react";

/**
 * IntersectionObserver-based scroll reveal. Plays once.
 */
export const Reveal = ({
  children,
  delay = 0,
  as: Tag = "div",
  className = "",
  ...rest
}) => {
  const ref = useRef(null);
  const [seen, setSeen] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting) {
            setSeen(true);
            io.disconnect();
          }
        });
      },
      { threshold: 0.12, rootMargin: "0px 0px -60px 0px" }
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  return (
    <Tag
      ref={ref}
      className={`reveal ${seen ? "in-view" : ""} ${className}`.trim()}
      style={{ transitionDelay: `${delay}ms` }}
      {...rest}
    >
      {children}
    </Tag>
  );
};

export default Reveal;
