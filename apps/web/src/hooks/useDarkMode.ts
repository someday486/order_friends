'use client';

import { useEffect, useSyncExternalStore } from 'react';

const THEME_STORAGE_KEY = 'theme';
const THEME_CHANGE_EVENT = 'orderfriends-theme-change';

function readIsDarkSnapshot() {
  if (typeof window === 'undefined') {
    return false;
  }

  const stored = window.localStorage.getItem(THEME_STORAGE_KEY);
  if (stored === 'dark') {
    return true;
  }

  if (stored === 'light') {
    return false;
  }

  return window.matchMedia('(prefers-color-scheme: dark)').matches;
}

function subscribeToTheme(callback: () => void) {
  if (typeof window === 'undefined') {
    return () => {};
  }

  const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
  const handleChange = () => {
    callback();
  };

  mediaQuery.addEventListener('change', handleChange);
  window.addEventListener('storage', handleChange);
  window.addEventListener(THEME_CHANGE_EVENT, handleChange);

  return () => {
    mediaQuery.removeEventListener('change', handleChange);
    window.removeEventListener('storage', handleChange);
    window.removeEventListener(THEME_CHANGE_EVENT, handleChange);
  };
}

export function useDarkMode() {
  const isDark = useSyncExternalStore(
    subscribeToTheme,
    readIsDarkSnapshot,
    () => false,
  );

  useEffect(() => {
    document.documentElement.classList.toggle('dark', isDark);
    window.localStorage.setItem(THEME_STORAGE_KEY, isDark ? 'dark' : 'light');
  }, [isDark]);

  const toggle = () => {
    const nextIsDark = !readIsDarkSnapshot();
    window.localStorage.setItem(
      THEME_STORAGE_KEY,
      nextIsDark ? 'dark' : 'light',
    );
    document.documentElement.classList.toggle('dark', nextIsDark);
    window.dispatchEvent(new Event(THEME_CHANGE_EVENT));
  };

  return { isDark, toggle };
}
