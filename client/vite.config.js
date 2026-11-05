import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from 'tailwindcss';
import autoprefixer from 'autoprefixer';
import { fileURLToPath } from 'node:url';
import { dirname } from 'node:path';
const rootDir = dirname(fileURLToPath(import.meta.url));
const projectRoot = dirname(rootDir);
export default defineConfig(({ mode }) => {
  // The backend reads e2e/.env; load that same file for the Vite proxy and port.
  // Allow client/.env to override project-wide defaults when needed.
  const env = { ...loadEnv(mode, projectRoot, ''), ...loadEnv(mode, rootDir, '') };
  const apiTarget = env.VITE_API_PROXY_TARGET || process.env.VITE_API_PROXY_TARGET || 'http://127.0.0.1:5000';
  const devPort = Number(env.VITE_PORT || process.env.VITE_PORT || 5175);
  return {
    root: rootDir,
    plugins: [react()],
    css: { postcss: { plugins: [tailwindcss({ config: fileURLToPath(new URL('./tailwind.config.cjs', import.meta.url)) }), autoprefixer()] } },
    server: { host: '127.0.0.1', port: devPort, strictPort: true, proxy: { '/api': { target: apiTarget, changeOrigin: true, timeout: 660000, proxyTimeout: 660000 } } },
    preview: { host: '127.0.0.1', port: devPort, strictPort: true },
    build: { outDir: 'dist' },
  };
});
