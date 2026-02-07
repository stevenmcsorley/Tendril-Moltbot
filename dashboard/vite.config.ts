import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
    plugins: [react()],
    server: {
        host: true,
        port: 3334,
        strictPort: true,
        proxy: {
            '/api': {
                target: 'http://localhost:3333',
                changeOrigin: true,
            },
            '/ws': {
                target: 'ws://localhost:3333',
                ws: true,
            },
        },
    },
    build: {
        outDir: 'dist',
    },
});
