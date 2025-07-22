import { defineConfig } from 'vite'
import { svelte } from '@sveltejs/vite-plugin-svelte'

export default defineConfig({
  plugins: [svelte()],
  base: '/confidence-picks/',
  css: {
    postcss: './postcss.config.js'
  }
})