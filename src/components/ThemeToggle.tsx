import { Sun, Moon } from 'lucide-react';
import { useThemeStore } from '../lib/theme-store';

export function ThemeToggle() {
  const { theme, toggleTheme } = useThemeStore();

  return (
    <button
      type="button"
      className="icon-button theme-toggle-button"
      onClick={toggleTheme}
      title={theme === 'dark' ? 'Switch to Light theme' : 'Switch to Dark theme'}
      aria-label="Toggle dark or light theme"
    >
      {theme === 'dark' ? (
        <Sun size={17} style={{ color: '#f59e0b' }} />
      ) : (
        <Moon size={17} style={{ color: '#57534e' }} />
      )}
    </button>
  );
}
