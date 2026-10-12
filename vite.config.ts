import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  // './' damit die App auch unter einer GitHub-Pages-Adresse (…github.io/repo/) funktioniert
  base: './',
  plugins: [react()],
})
