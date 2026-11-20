import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import previewPages from './scripts/preview-pages.mjs'

export default defineConfig({
  plugins: [react(), tailwindcss(), previewPages()],
  server: { port: 5173 },
})
