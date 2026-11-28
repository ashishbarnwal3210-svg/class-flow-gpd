import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
export default defineConfig({
  plugins: [react(), tailwindcss()],
  test: { environment: 'jsdom', setupFiles: './src/test-setup.ts' },
  server: { host: '0.0.0.0', allowedHosts: true },
  optimizeDeps: { entries: ['index.html'] },
  build: { rollupOptions: { output: { manualChunks(id) {
    if (!id.includes('node_modules')) return;
    if (id.includes('/node_modules/react/') || id.includes('/node_modules/react-dom/') || id.includes('/node_modules/scheduler/')) return 'vendor-react';
    if (id.includes('/node_modules/lucide-react/')) return 'vendor-icons';
    if (id.includes('/node_modules/framer-motion/')) return 'vendor-motion';
    if (id.includes('/node_modules/@supabase/')) return 'vendor-supabase';
    if (id.includes('/node_modules/@tanstack/')) return 'vendor-query';
    if (id.includes('/node_modules/react-router')) return 'vendor-router';
    if (id.includes('/node_modules/three/')) return 'vendor-three';
    if (id.includes('/node_modules/zod/')) return 'vendor-validation';
  } } } }
});
