import path from 'path'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  build: { outDir: 'dist' },
  plugins: [react()],
  resolve: {
    alias: [
      { find: /^@ui\/(.*)$/, replacement: path.resolve(__dirname, '../../packages/ui/src/$1') },
      { find: /^@supabase$/, replacement: path.resolve(__dirname, '../../packages/supabase/src/index.ts') }
    ]
  }
})
