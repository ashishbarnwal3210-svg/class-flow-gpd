import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import App from './App';
import './styles.css';
import './append.css';
import './liquid-glass.css';
import './messaging.css';
import './styles-3d.css';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000, // 5 minutes fresh in memory
      gcTime: 15 * 60 * 1000,   // keep in cache for 15 minutes
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});
// Disable Android Chrome "Touch to Search" popups from accidental taps
if (typeof window !== 'undefined') {
  window.addEventListener('touchstart', (e) => {
    const target = e.target as HTMLElement | null;
    if (!target) return;
    if (!target.closest('input, textarea, [contenteditable="true"], .selectable')) {
      const sel = window.getSelection();
      if (sel && sel.type === 'Range') {
        sel.removeAllRanges();
      }
    }
  }, { passive: true });
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode><QueryClientProvider client={queryClient}><BrowserRouter><App /></BrowserRouter></QueryClientProvider></React.StrictMode>,
);
