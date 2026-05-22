'use client';

import React, { useRef, useState, useEffect } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

interface HorizontalScrollerProps {
  children: React.ReactNode;
  className?: string; // For the outer relative wrapper
  innerClassName?: string; // For the inner scrollable container
}

export function HorizontalScroller({ children, className = '', innerClassName = '' }: HorizontalScrollerProps) {
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [showLeft, setShowLeft] = useState(false);
  const [showRight, setShowRight] = useState(false);

  const checkScroll = () => {
    if (scrollContainerRef.current) {
      const { scrollLeft, scrollWidth, clientWidth } = scrollContainerRef.current;
      // Use a small threshold (e.g., 2px) to account for fractional pixel rounding issues
      setShowLeft(scrollLeft > 2);
      setShowRight(Math.ceil(scrollLeft + clientWidth) < scrollWidth - 2);
    }
  };

  useEffect(() => {
    checkScroll();
    window.addEventListener('resize', checkScroll);
    return () => window.removeEventListener('resize', checkScroll);
  }, [children]);

  const scroll = (direction: 'left' | 'right') => {
    if (scrollContainerRef.current) {
      const { scrollLeft, clientWidth } = scrollContainerRef.current;
      const scrollAmount = clientWidth * 0.7; // Scroll by 70% of container width for context
      const target = direction === 'left' ? scrollLeft - scrollAmount : scrollLeft + scrollAmount;
      scrollContainerRef.current.scrollTo({
        left: target,
        behavior: 'smooth'
      });
    }
  };

  return (
    <div className={`relative group flex w-full ${className}`}>
      {/* Left Arrow */}
      {showLeft && (
        <div className="absolute left-0 top-0 bottom-0 z-10 hidden md:flex items-center pointer-events-none px-2 bg-gradient-to-r from-background via-background/80 to-transparent">
          <button
            onClick={() => scroll('left')}
            className="pointer-events-auto flex items-center justify-center w-8 h-8 rounded-full bg-background shadow-md border border-border text-foreground hover:bg-secondary hover:scale-105 active:scale-95 transition-all cursor-pointer"
            aria-label="Scroll left"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Right Arrow */}
      {showRight && (
        <div className="absolute right-0 top-0 bottom-0 z-10 hidden md:flex items-center pointer-events-none px-2 bg-gradient-to-l from-background via-background/80 to-transparent">
          <button
            onClick={() => scroll('right')}
            className="pointer-events-auto flex items-center justify-center w-8 h-8 rounded-full bg-background shadow-md border border-border text-foreground hover:bg-secondary hover:scale-105 active:scale-95 transition-all cursor-pointer"
            aria-label="Scroll right"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      )}

      <div
        ref={scrollContainerRef}
        onScroll={checkScroll}
        className={`w-full overflow-x-auto scroll-smooth [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none] ${innerClassName}`}
      >
        {children}
      </div>
    </div>
  );
}
