import path from 'path'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  build: {
    outDir: 'dist',
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules')) {
            if (id.includes('react') || id.includes('react-dom')) return 'vendor-react'
            if (id.includes('@tanstack')) return 'vendor-query'
            if (id.includes('@radix-ui') || id.includes('lucide-react') || id.includes('zustand')) return 'vendor-ui'
            return 'vendor'
          }
        }
      }
    }
  },
  plugins: [react()],
  resolve: {
    alias: [
      { find: /^@ui\/(.*)$/, replacement: path.resolve(__dirname, '../../packages/ui/src/$1') },
      { find: /^@supabase$/, replacement: path.resolve(__dirname, '../../packages/supabase/src/index.ts') }
    ]
  }
})
