import { useState, useEffect } from 'react';

interface ServerTimeState {
    time: Date;
    isSynced: boolean;
    offset: number;
}

/**
 * useServerTime
 * 
 * A hook that provides the accurate, centralized server time instead of relying
 * on the local client machine's clock. It calculates the offset between the 
 * client and the server once on mount, and then applies that offset to a locally
 * running timer to prevent continuous API polling.
 */
export const useServerTime = (updateIntervalMs: number = 1000) => {
    // We maintain the latest calculated server time
    const [serverTime, setServerTime] = useState<Date>(new Date());
    const [isSynced, setIsSynced] = useState<boolean>(false);
    const [offsetMs, setOffsetMs] = useState<number>(0);

    // 1. Fetch the authoritative time from the backend
    useEffect(() => {
        let isMounted = true;

        const syncWithServer = async () => {
            try {
                // Record request start time to calculate network latency/round-trip time
                const requestStartedAt = Date.now();
                
                const response = await fetch('/api/time/now');
                if (!response.ok) throw new Error('Failed to fetch server time');
                
                const data = await response.json();
                
                if (data.success && data.data && data.data.timestamp) {
                    const requestEndedAt = Date.now();
                    const roundTripTime = requestEndedAt - requestStartedAt;
                    
                    // The actual server time when it processed the request is approximately
                    // the returned timestamp + half the round-trip time.
                    const exactServerTime = data.data.timestamp + (roundTripTime / 2);
                    
                    // Calculate the offset: Server Time - Local Time
                    const newOffset = exactServerTime - requestEndedAt;
                    
                    if (isMounted) {
                        setOffsetMs(newOffset);
                        setIsSynced(true);
                        setServerTime(new Date(Date.now() + newOffset));
                        console.log(`[TimeSync] Sycned with server. Offset: ${newOffset}ms`);
                    }
                }
            } catch (error) {
                console.error('[TimeSync] Failed to sync time with server:', error);
                // Fallback to local time if server is unreachable
                if (isMounted) {
                    setIsSynced(false);
                    setOffsetMs(0); // Trust local time as fallback
                }
            }
        };

        syncWithServer();

        // Optional: Re-sync every hour to correct any minor setInterval drift
        const resyncInterval = setInterval(syncWithServer, 60 * 60 * 1000);

        return () => {
            isMounted = false;
            clearInterval(resyncInterval);
        };
    }, []);

    // 2. Real-time tick using the calculated offset
    useEffect(() => {
        // Only run the tick if we want an interval (e.g. 1000ms for a clock)
        if (updateIntervalMs <= 0) return;

        const timer = setInterval(() => {
            // Apply the fixed offset to Date.now() to get the perfect server time
            // without hammering the backend API.
            setServerTime(new Date(Date.now() + offsetMs));
        }, updateIntervalMs);

        return () => clearInterval(timer);
    }, [offsetMs, updateIntervalMs]);

    return { serverTime, isSynced, offsetMs };
};
