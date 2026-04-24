import { createContext, useContext, useEffect, useState } from 'react';
import { doc, onSnapshot, setDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from './AuthContext';

export interface ThemeSettings {
  appName: string;
  tagline: string;
  accentColor: string;
  plan: 'solo' | 'agence' | 'setup';
  locked?: boolean;
}

export const DEFAULT_SETTINGS: ThemeSettings = {
  appName: 'Orbit',
  tagline: 'CRM pour freelances',
  accentColor: '#7c5cfc',
  plan: 'solo',
};

interface ThemeContextType {
  settings: ThemeSettings;
  loaded: boolean;
  isNewUser: boolean;
  plan: 'solo' | 'agence' | 'setup';
  locked: boolean;
  saveSettings: (s: ThemeSettings) => Promise<void>;
}

const ThemeContext = createContext<ThemeContextType>({
  settings: DEFAULT_SETTINGS,
  loaded: false,
  isNewUser: false,
  plan: 'solo' as const,
  locked: false,
  saveSettings: async () => {},
});

function hexToRgb(hex: string) {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return { r, g, b };
}

function darken(hex: string, amt = 18): string {
  const { r, g, b } = hexToRgb(hex);
  const c = (v: number) => Math.max(0, v - amt).toString(16).padStart(2, '0');
  return `#${c(r)}${c(g)}${c(b)}`;
}

export function applyTheme(color: string) {
  const { r, g, b } = hexToRgb(color);
  const root = document.documentElement;
  root.style.setProperty('--accent', color);
  root.style.setProperty('--accent-hover', darken(color));
  root.style.setProperty('--accent-dim', `rgba(${r},${g},${b},0.12)`);
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const [settings, setSettings] = useState<ThemeSettings>(DEFAULT_SETTINGS);
  const [loaded, setLoaded] = useState(false);
  const [isNewUser, setIsNewUser] = useState(false);

  useEffect(() => {
    if (!user) return;
    return onSnapshot(doc(db, 'users', user.uid, 'meta', 'settings'), snap => {
      if (snap.exists()) {
        const data = { ...DEFAULT_SETTINGS, ...snap.data() } as ThemeSettings;
        setSettings(data);
        applyTheme(data.accentColor);
        setIsNewUser(false);
      } else {
        setIsNewUser(true);
        applyTheme(DEFAULT_SETTINGS.accentColor);
      }
      setLoaded(true);
    });
  }, [user]);

  const saveSettings = async (s: ThemeSettings) => {
    if (!user) return;
    await setDoc(doc(db, 'users', user.uid, 'meta', 'settings'), s);
    setSettings(s);
    applyTheme(s.accentColor);
    setIsNewUser(false);
  };

  return (
    <ThemeContext.Provider value={{ settings, loaded, isNewUser, plan: settings.plan ?? 'solo', locked: settings.locked ?? false, saveSettings }}>
      {children}
    </ThemeContext.Provider>
  );
}

export const useTheme = () => useContext(ThemeContext);
