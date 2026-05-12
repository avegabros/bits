'use client';

import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { usePathname, useRouter } from 'next/navigation';

interface NavigationContextType {
  isNavigating: boolean;
  navigate: (href: string) => void;
}

const NavigationContext = createContext<NavigationContextType>({
  isNavigating: false,
  navigate: () => {},
});

export function NavigationProvider({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [isNavigating, setIsNavigating] = useState(false);

  // Reset when navigation completes (pathname changes = navigation done)
  useEffect(() => {
    setIsNavigating(false);
  }, [pathname]);

  const navigate = useCallback((href: string) => {
    // Don't show loading if already on that page
    if (pathname === href || (href !== '/' && pathname.startsWith(href + '/'))) {
      return;
    }
    setIsNavigating(true);
    router.push(href);
  }, [pathname, router]);

  return (
    <NavigationContext.Provider value={{ isNavigating, navigate }}>
      {children}
    </NavigationContext.Provider>
  );
}

export function useNavigation() {
  return useContext(NavigationContext);
}
