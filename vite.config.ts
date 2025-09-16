import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    port: 3000,
    host: true,
    proxy: {
      // Keystone API 프록시
      '/keystone': {
        target: 'http://192.168.0.25:5000',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/keystone/, '/v3'),
        configure: (proxy, options) => {
          proxy.on('error', (err, req, res) => {
            console.log('Keystone proxy error', err);
          });
          proxy.on('proxyReq', (proxyReq, req, res) => {
            console.log('Keystone proxy request:', req.method, req.url);
          });
        }
      },
      // Nova API 프록시
      '/nova': {
        target: 'http://192.168.0.25:8774',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/nova/, '/v2.1'),
        configure: (proxy, options) => {
          proxy.on('error', (err, req, res) => {
            console.log('Nova proxy error', err);
          });
        }
      },
      // Neutron API 프록시
      '/neutron': {
        target: 'http://192.168.0.25:9696',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/neutron/, ''),
        configure: (proxy, options) => {
          proxy.on('error', (err, req, res) => {
            console.log('Neutron proxy error', err);
          });
        }
      },
      // Glance API 프록시
      '/glance': {
        target: 'http://192.168.0.25:9292',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/glance/, ''),
        configure: (proxy, options) => {
          proxy.on('error', (err, req, res) => {
            console.log('Glance proxy error', err);
          });
        }
      },
      // Cinder API 프록시 (볼륨 서비스)
      '/cinder': {
        target: 'http://192.168.0.25:8776',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/cinder/, ''),
        configure: (proxy, options) => {
          proxy.on('error', (err, req, res) => {
            console.log('Cinder proxy error', err);
          });
          proxy.on('proxyReq', (proxyReq, req, res) => {
            console.log('Cinder proxy request:', req.method, req.url);
          });
        }
      },
      // Placement API 프록시
      '/placement': {
        target: 'http://192.168.0.25:8780',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/placement/, ''),
        configure: (proxy, options) => {
          proxy.on('error', (err, req, res) => {
            console.log('Placement proxy error', err);
          });
        }
      },
      // Heat API 프록시
      '/heat': {
        target: 'http://192.168.0.25:8004',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/heat/, '/v1/%(tenant_id)s'),
        configure: (proxy, options) => {
          proxy.on('error', (err, req, res) => {
            console.log('Heat proxy error', err);
          });
        }
      },
      // Heat-cfn API 프록시
      '/heat-cfn': {
        target: 'http://192.168.0.25:8000',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/heat-cfn/, '/v1'),
        configure: (proxy, options) => {
          proxy.on('error', (err, req, res) => {
            console.log('Heat-cfn proxy error', err);
          });
        }
      },
      // 대기열 API 프록시 (간단한 파일 서버)
      '/api/queue': {
        target: 'http://localhost:3002',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/queue/, '/api'),
        configure: (proxy, options) => {
          proxy.on('error', (err, req, res) => {
            console.log('Queue API proxy error', err);
          });
        }
      }
    }
  },
  build: {
    outDir: 'dist',
    sourcemap: true
  }
}) 