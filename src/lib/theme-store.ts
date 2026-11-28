import { create } from 'zustand';

export type AppTheme = 'light' | 'dark';
export type UIMode = '3d' | 'classic';

interface ThemeState {
  theme: AppTheme;
  uiMode: UIMode;
  setTheme: (theme: AppTheme) => void;
  toggleTheme: () => void;
  setUIMode: (mode: UIMode) => void;
  toggleUIMode: () => void;
}

const THEME_KEY = 'classflow_theme';
const UI_MODE_KEY = 'classflow_ui_mode';

function getInitialTheme(): AppTheme {
  if (typeof window === 'undefined') return 'light';
  const saved = localStorage.getItem(THEME_KEY);
  if (saved === 'dark' || saved === 'light') return saved;
  // Default to system preference
  if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
    return 'dark';
  }
  return 'light';
}

function getInitialUIMode(): UIMode {
  if (typeof window === 'undefined') return '3d';
  const saved = localStorage.getItem(UI_MODE_KEY);
  if (saved === '3d' || saved === 'classic') return saved;
  return '3d'; // Default to 3D so user can experience it immediately
}

export const useThemeStore = create<ThemeState>((set, get) => ({
  theme: getInitialTheme(),
  uiMode: getInitialUIMode(),

  setTheme: (theme) => {
    localStorage.setItem(THEME_KEY, theme);
    document.documentElement.setAttribute('data-theme', theme);
    set({ theme });
  },

  toggleTheme: () => {
    const next = get().theme === 'light' ? 'dark' : 'light';
    get().setTheme(next);
  },

  setUIMode: (uiMode) => {
    localStorage.setItem(UI_MODE_KEY, uiMode);
    document.documentElement.setAttribute('data-ui-mode', uiMode);
    set({ uiMode });
  },

  toggleUIMode: () => {
    const next = get().uiMode === '3d' ? 'classic' : '3d';
    get().setUIMode(next);
  },
}));

// Initialize DOM attributes immediately on load
if (typeof document !== 'undefined') {
  const initialTheme = getInitialTheme();
  const initialMode = getInitialUIMode();
  document.documentElement.setAttribute('data-theme', initialTheme);
  document.documentElement.setAttribute('data-ui-mode', initialMode);
}
