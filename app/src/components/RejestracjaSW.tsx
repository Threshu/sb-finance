'use client';

import { useEffect } from 'react';

export function RejestracjaSW() {
  useEffect(() => {
    if (process.env.NODE_ENV !== 'production') return;
    if (!('serviceWorker' in navigator)) return;
    navigator.serviceWorker.register('/sw.js').catch(() => {
      /* brak offline to nie powód, żeby apka nie działała */
    });
  }, []);

  return null;
}
