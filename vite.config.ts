
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { cwd } from 'node:process';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, cwd(), '');
  
  return {
    plugins: [react(), tailwindcss()],
    define: {
      'process.env.API_KEY': JSON.stringify(env.API_KEY),
      'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY),
    },
    server: {
      port: 3000,
      host: true,
      proxy: {
        '/api/5000': { target: 'http://127.0.0.1:5000', changeOrigin: true, rewrite: (path) => path.replace(/^\/api\/5000/, '') },
        '/api/5001': { target: 'http://127.0.0.1:5001', changeOrigin: true, rewrite: (path) => path.replace(/^\/api\/5001/, '') },
        '/api/5002': { target: 'http://127.0.0.1:5002', changeOrigin: true, rewrite: (path) => path.replace(/^\/api\/5002/, '') },
        '/api/5003': { target: 'http://127.0.0.1:5003', changeOrigin: true, rewrite: (path) => path.replace(/^\/api\/5003/, '') },
        '/api/5004': { target: 'http://127.0.0.1:5004', changeOrigin: true, rewrite: (path) => path.replace(/^\/api\/5004/, '') },
        '/api/5005': { target: 'http://127.0.0.1:5005', changeOrigin: true, rewrite: (path) => path.replace(/^\/api\/5005/, '') },
        '/api/5006': { target: 'http://127.0.0.1:5006', changeOrigin: true, rewrite: (path) => path.replace(/^\/api\/5006/, '') },
        '/api/5007': { target: 'http://127.0.0.1:5007', changeOrigin: true, rewrite: (path) => path.replace(/^\/api\/5007/, '') },
        '/api/5008': { target: 'http://127.0.0.1:5008', changeOrigin: true, rewrite: (path) => path.replace(/^\/api\/5008/, '') },
        '/api/5010': { target: 'http://127.0.0.1:5010', changeOrigin: true, rewrite: (path) => path.replace(/^\/api\/5010/, '') },
      }
    }
  };
});
