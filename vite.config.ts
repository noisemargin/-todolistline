import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

import { cloudflare } from "@cloudflare/vite-plugin";

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), cloudflare()],
  // 强制整个应用只用同一份 React,避免 React Flow 等库
  // 在运行时拿到第二个 React 实例(报 "Invalid hook call")。
  resolve: {
    dedupe: ['react', 'react-dom'],
  },
})