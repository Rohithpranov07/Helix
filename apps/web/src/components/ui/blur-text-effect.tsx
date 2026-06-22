'use client';

import React, { useLayoutEffect, useRef } from 'react';
import gsap from 'gsap';

interface BlurTextEffectProps {
  children: string;
  className?: string;
}

export const BlurTextEffect: React.FC<BlurTextEffectProps> = ({ children, className = '' }) => {
  const containerRef = useRef<HTMLSpanElement>(null);

  useLayoutEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const chars = container.querySelectorAll('span.char');

    // Hold the hidden state until the element scrolls into view.
    gsap.set(chars, { opacity: 0, y: 10, filter: 'blur(8px)' });

    let played = false;
    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        if (!entry?.isIntersecting || played) return;
        played = true;

        gsap.to(chars, {
          opacity: 1,
          y: 0,
          filter: 'blur(0px)',
          duration: 0.3,
          ease: 'power2.out',
          stagger: 0.015,
          clearProps: 'filter',
        });

        observer.disconnect();
      },
      { threshold: 0.2 }
    );

    observer.observe(container);

    return () => observer.disconnect();
  }, [children]);

  return (
    <span className={`inline-block ${className}`} ref={containerRef}>
      {children.split('').map((char, i) => (
        <span key={`${char}-${i}`} className="char inline-block" style={{ whiteSpace: 'pre' }}>
          {char === ' ' ? '\u00A0' : char}
        </span>
      ))}
    </span>
  );
};
