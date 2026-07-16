import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
const root=dirname(fileURLToPath(import.meta.url));
export default defineConfig({plugins:[react()],build:{rollupOptions:{input:{sidepanel:resolve(root,'index.html'),background:resolve(root,'src/background/service-worker.ts')},output:{entryFileNames:'assets/[name].js',chunkFileNames:'assets/[name]-[hash].js',assetFileNames:'assets/[name]-[hash][extname]'}}}});
