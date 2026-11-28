import React, { useRef, useState, type ReactNode } from 'react';
import { useThemeStore } from '../../lib/theme-store';

interface Card3DTiltProps {
  children: ReactNode;
  className?: string;
  style?: React.CSSProperties;
  maxTilt?: number;
}

export function Card3DTilt({ children, className = '', style = {}, maxTilt = 10 }: Card3DTiltProps) {
  const uiMode = useThemeStore((s) => s.uiMode);
  const cardRef = useRef<HTMLDivElement>(null);
  const [tilt, setTilt] = useState({ x: 0, y: 0, glareX: 50, glareY: 50, isHovered: false });

  if (uiMode === 'classic') {
    return (
      <div className={className} style={style}>
        {children}
      </div>
    );
  }

  const onMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const card = cardRef.current;
    if (!card) return;
    const rect = card.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const centerX = rect.width / 2;
    const centerY = rect.height / 2;

    const normX = (x - centerX) / centerX;
    const normY = (y - centerY) / centerY;

    const rotY = normX * maxTilt;
    const rotX = -normY * maxTilt;

    setTilt({
      x: rotX,
      y: rotY,
      glareX: (x / rect.width) * 100,
      glareY: (y / rect.height) * 100,
      isHovered: true,
    });
  };

  const onMouseLeave = () => {
    setTilt((prev) => ({ ...prev, x: 0, y: 0, isHovered: false }));
  };

  return (
    <div
      ref={cardRef}
      className={`card-3d-tilt ${className}`}
      onMouseMove={onMouseMove}
      onMouseLeave={onMouseLeave}
      style={{
        ...style,
        perspective: '1000px',
        transformStyle: 'preserve-3d',
        transition: tilt.isHovered ? 'transform 0.08s ease-out' : 'transform 0.5s ease-out',
        transform: `perspective(1000px) rotateX(${tilt.x}deg) rotateY(${tilt.y}deg) translateZ(${tilt.isHovered ? 8 : 0}px)`,
        position: 'relative',
      }}
    >
      {children}
      {tilt.isHovered && (
        <div
          className="card-3d-glare"
          style={{
            position: 'absolute',
            inset: 0,
            borderRadius: 'inherit',
            pointerEvents: 'none',
            background: `radial-gradient(circle at ${tilt.glareX}% ${tilt.glareY}%, rgba(255,255,255,0.18) 0%, transparent 65%)`,
            zIndex: 10,
          }}
        />
      )}
    </div>
  );
}
