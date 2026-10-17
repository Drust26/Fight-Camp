import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { viteSingleFile } from 'vite-plugin-singlefile';
import { readFileSync } from 'node:fs';

// the game's version lives in desktop/package.json (the installer and the updater read it there too)
const version = JSON.parse(readFileSync(new URL('./desktop/package.json', import.meta.url), 'utf8')).version;

// SINGLE=1 builds one self-contained HTML file (offline-playable).
export default defineConfig({
  plugins: process.env.SINGLE ? [react(), viteSingleFile()] : [react()],
  base: './',
  define: { __APP_VERSION__: JSON.stringify(version) },
  test: { environment: 'node', include: ['tests/**/*.test.ts'] },
} as any);
