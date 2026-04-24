import { useState, useEffect } from 'react';

export type ColorScheme = 'dark' | 'light';

const KEY = 'orbit_color_scheme';

function apply(scheme: ColorScheme) {
  document.documentElement.setAttribute('data-theme', scheme);
}

export function useColorScheme() {
  const [scheme, setScheme] = useState<ColorScheme>(() => {
    return (localStorage.getItem(KEY) as ColorScheme) ?? 'dark';
  });

  useEffect(() => {
    apply(scheme);
    localStorage.setItem(KEY, scheme);
  }, [scheme]);

  const toggle = () => setScheme(s => s === 'dark' ? 'light' : 'dark');

  return { scheme, toggle };
}
