'use client';

import { useEffect, useState } from 'react';

export function useDarkMode() {
  const [isDark, setIsDark] = useState(false);
  const [isResolved, setIsResolved] = useState(false);

  useEffect(() => {
    const stored = localStorage.getItem('theme');
    if (stored === 'dark') {
      setIsDark(true);
    } else if (stored === 'light') {
      setIsDark(false);
    } else {
      setIsDark(window.matchMedia('(prefers-color-scheme: dark)').matches);
    }
    setIsResolved(true);
  }, []);

  useEffect(() => {
    if (!isResolved) return;
    document.documentElement.classList.toggle('dark', isDark);
    localStorage.setItem('theme', isDark ? 'dark' : 'light');
  }, [isDark, isResolved]);

  const toggle = () => {
    setIsDark((prev) => !prev);
  };

  return { isDark, toggle };
}
