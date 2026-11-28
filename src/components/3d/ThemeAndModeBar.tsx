import { Sun, Moon, Sparkles, Layout } from 'lucide-react';
import { useThemeStore } from '../../lib/theme-store';

export function ThemeAndModeBar() {
  const { theme, toggleTheme, uiMode, toggleUIMode } = useThemeStore();

  return (
    <div className="theme-mode-controls">
      {/* 3D vs Classic Mode Switcher */}
      <button
        type="button"
        className={`mode-toggle-pill ${uiMode === '3d' ? 'active-3d' : 'active-classic'}`}
        onClick={toggleUIMode}
        title={uiMode === '3d' ? 'Switch to Classic 2D Interface' : 'Switch to 3D Spatial Experience'}
        aria-label="Toggle 3D or Classic UI"
      >
        {uiMode === '3d' ? (
          <>
            <Sparkles size={13} className="spin-slow" />
            <span>3D Spatial</span>
          </>
        ) : (
          <>
            <Layout size={13} />
            <span>Classic</span>
          </>
        )}
      </button>

      {/* Dark / Light Theme Toggle */}
      <button
        type="button"
        className="icon-button theme-toggle-button"
        onClick={toggleTheme}
        title={theme === 'dark' ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
        aria-label="Toggle Dark or Light Theme"
      >
        {theme === 'dark' ? (
          <Sun size={16} style={{ color: '#f59e0b' }} />
        ) : (
          <Moon size={16} style={{ color: '#4b5563' }} />
        )}
      </button>
    </div>
  );
}
