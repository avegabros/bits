'use client';

import { useEffect, useState, Suspense } from 'react';
import { usePathname } from 'next/navigation';
import { useNavigation } from '@/context/NavigationContext';

function NavigationProgressBar() {
  const { isNavigating } = useNavigation();
  const pathname = usePathname();
  const [width, setWidth] = useState(0);
  const [visible, setVisible] = useState(false);
  const [completing, setCompleting] = useState(false);

  // When navigation starts → show bar and begin growing
  useEffect(() => {
    if (isNavigating) {
      setVisible(true);
      setCompleting(false);
      setWidth(15);
    }
  }, [isNavigating]);

  // Grow the bar incrementally while navigating
  useEffect(() => {
    if (!isNavigating || completing) return;

    const interval = setInterval(() => {
      setWidth(prev => {
        if (prev >= 85) return prev; // Hold at 85% until done
        const remaining = 85 - prev;
        return prev + remaining * 0.08;
      });
    }, 80);

    return () => clearInterval(interval);
  }, [isNavigating, completing]);

  // When pathname changes → navigation complete, finish the bar
  useEffect(() => {
    if (!visible) return;
    setCompleting(true);
    setWidth(100);

    const hide = setTimeout(() => {
      setVisible(false);
      setWidth(0);
      setCompleting(false);
    }, 250);

    return () => clearTimeout(hide);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname]);

  if (!visible && width === 0) return null;

  return (
    <div
      aria-hidden="true"
      className="fixed top-0 left-0 z-[9999] h-[3px] pointer-events-none"
      style={{
        width: `${width}%`,
        transition: completing
          ? 'width 180ms ease-out, opacity 200ms ease-out 180ms'
          : 'width 80ms linear',
        opacity: completing && width === 100 ? 0 : 1,
        background: 'var(--brand, #E60000)',
      }}
    >
      {/* Glowing right-edge effect */}
      <div
        className="absolute right-0 top-0 h-full w-20"
        style={{
          background: 'radial-gradient(ellipse at right, rgba(230,0,0,0.6) 0%, transparent 70%)',
          filter: 'blur(3px)',
        }}
      />
    </div>
  );
}

export function NavigationProgress() {
  return (
    <Suspense fallback={null}>
      <NavigationProgressBar />
    </Suspense>
  );
}
