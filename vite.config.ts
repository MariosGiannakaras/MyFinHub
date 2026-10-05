import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => ({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:4317',
        // Forward the browser-facing host/protocol so assertSameOrigin on the
        // backend compares Origin against http://127.0.0.1:5173 instead of
        // the upstream target http://127.0.0.1:4317.  The security check is
        // not weakened: genuine cross-origin requests still carry a different
        // Origin and continue to fail.
        headers: {
          'x-forwarded-host': '127.0.0.1:5173',
          'x-forwarded-proto': 'http',
        },
      },
    }
  },
  build: {
    sourcemap: mode !== 'production'
  }
}));
