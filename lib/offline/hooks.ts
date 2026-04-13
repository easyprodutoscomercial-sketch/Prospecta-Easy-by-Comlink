'use client';

import { useEffect, useState } from 'react';
import { subscribeQueue, isOnline, processQueue, installQueueAutoFlush } from './queue';

export function useOnlineStatus(): boolean {
  const [online, setOnline] = useState<boolean>(() => (typeof navigator === 'undefined' ? true : navigator.onLine !== false));
  useEffect(() => {
    const up = () => setOnline(true);
    const down = () => setOnline(false);
    window.addEventListener('online', up);
    window.addEventListener('offline', down);
    return () => {
      window.removeEventListener('online', up);
      window.removeEventListener('offline', down);
    };
  }, []);
  return online;
}

export function useQueueCount(): number {
  const [count, setCount] = useState(0);
  useEffect(() => {
    const unsub = subscribeQueue(setCount);
    return () => { unsub(); };
  }, []);
  return count;
}

export function useInstallQueueAutoFlush() {
  useEffect(() => {
    installQueueAutoFlush();
  }, []);
}

export { isOnline, processQueue };
