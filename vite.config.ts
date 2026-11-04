import { fileURLToPath, URL } from 'node:url'
import { readFileSync } from 'node:fs'

import { defineConfig } from 'vitest/config'
import type { Plugin } from 'vite'
import vue from '@vitejs/plugin-vue'
import { buildIcs, type IcsEvent } from './src/utils/calendar'

/**
 * Abonnierbarer Kalender-Feed unter /calendar.ics, erzeugt aus den veröffentlichten
 * Events (src/events.json). Im Build als Datei, im Dev-Server on the fly.
 */
function icsFeed(): Plugin {
  const fileName = 'calendar.ics'
  const render = () => {
    const events: IcsEvent[] = JSON.parse(readFileSync(new URL('./src/events.json', import.meta.url), 'utf-8'))
    const domain = readFileSync(new URL('./public/CNAME', import.meta.url), 'utf-8').trim()
    return buildIcs(events, {
      eventUrl: e => `https://${domain}/event/${encodeURI(e.id)}`,
      refreshInterval: 'PT12H',
    })
  }
  return {
    name: 'ics-feed',
    configureServer(server) {
      server.middlewares.use(`/${fileName}`, (_req, res) => {
        res.setHeader('Content-Type', 'text/calendar; charset=utf-8')
        res.end(render())
      })
    },
    generateBundle() {
      this.emitFile({ type: 'asset', fileName, source: render() })
    },
  }
}

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    vue(),
    icsFeed(),
  ],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url))
    }
  },
  test: {
    environment: 'happy-dom',
    setupFiles: ['./src/__tests__/setup.ts'],
    exclude: ['e2e/**', 'node_modules/**'],
  },
  server: {
    proxy: {
      '/api': {
        target: 'http://localhost:8000',
        changeOrigin: true,
        secure: false,
      }
    }
  }
})
