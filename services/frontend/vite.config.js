import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

const backend = process.env.VITE_API_URL || 'http://localhost:3000';

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/api': { target: backend, changeOrigin: true },
      '/s/':  { target: backend, changeOrigin: true },
      '/health': { target: backend, changeOrigin: true },
    },
    watch: { usePolling: true },
    host: '0.0.0.0',
    allowedHosts: true,
  },
});
