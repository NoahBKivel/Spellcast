import { useEffect, useState, type ReactNode } from "react";

const STARS = Array.from({ length: 60 }, (_, index) => ({
  left: (index * 53 + (index % 5) * 7) % 100,
  top: (index * 37 + (index % 4) * 5) % 78,
  size: 1 + (index % 4),
  delay: (index % 9) * 0.28,
}));

export function Stage({ children }: { children: ReactNode }) {
  const [scale, setScale] = useState(1);

  useEffect(() => {
    const fit = () => {
      setScale(Math.min(window.innerWidth / 1024, window.innerHeight / 574));
    };
    fit();
    window.addEventListener("resize", fit);
    return () => window.removeEventListener("resize", fit);
  }, []);

  return (
    <div className="sky">
      <div className="stars" aria-hidden="true">
        {STARS.map((star, index) => (
          <span
            key={index}
            className="star"
            style={{
              left: `${star.left}%`,
              top: `${star.top}%`,
              width: star.size,
              height: star.size,
              animationDelay: `${star.delay}s`,
            }}
          />
        ))}
      </div>
      <div className="stage-wrap">
        <div className="stage" style={{ transform: `translate(-50%, -50%) scale(${scale})` }}>
          {children}
        </div>
      </div>
    </div>
  );
}

export function Logo() {
  return <div className="logo">Spellcast</div>;
}
