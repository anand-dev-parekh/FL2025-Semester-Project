import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    headers: {
      // Use restrict-properties instead of same-origin
      'Cross-Origin-Opener-Policy': 'unsafe-none',
    }
  }
})