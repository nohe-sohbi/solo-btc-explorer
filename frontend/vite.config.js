import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
    plugins: [react()],
    server: {
        port: 3000,
        proxy: {
            '/api': {
                target: 'http://localhost:8080',
                changeOrigin: true
            },
            '/ws': {
                target: 'ws://localhost:8080',
                ws: true
            },
            // Health probes and metrics, linked from the advanced view.
            '/healthz': 'http://localhost:8080',
            '/readyz': 'http://localhost:8080',
            '/metrics': 'http://localhost:8080'
        }
    },
    test: {
        // Pure-logic suites default to the fast node env; component tests opt into
        // jsdom per file via a `// @vitest-environment jsdom` header comment.
        environment: 'node',
        include: ['src/**/*.{test,spec}.{js,jsx}'],
    }
})
