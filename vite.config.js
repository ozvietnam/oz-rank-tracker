import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Build outputs to dist/ (Vercel auto-detects the Vite preset).
// The api/ folder is deployed separately as Vercel Serverless Functions.
export default defineConfig({
  plugins: [react()],
  build: { outDir: 'dist', sourcemap: false },
});
