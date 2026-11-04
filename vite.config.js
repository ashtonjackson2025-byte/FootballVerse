import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  return {
    plugins: [react()],
    server: {
      proxy: {
        '/api/football-data': {
          target: 'https://api.football-data.org',
          changeOrigin: true,
          rewrite: path => path.replace(/^\/api\/football-data/, '/v4'),
          configure: proxy => {
            proxy.on('proxyReq', proxyReq => {
              if (env.FOOTBALL_DATA_TOKEN) proxyReq.setHeader('X-Auth-Token', env.FOOTBALL_DATA_TOKEN)
            })
          }
        }
      }
    }
  }
})
