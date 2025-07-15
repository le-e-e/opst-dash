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
        target: 'http://controller:5000',
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
        target: 'http://controller:8774',
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
        target: 'http://controller:9696',
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
        target: 'http://controller:9292',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/glance/, ''),
        configure: (proxy, options) => {
          proxy.on('error', (err, req, res) => {
            console.log('Glance proxy error', err);
          });
        }
      },
      // Cinder API 프록시
      '/cinder': {
        target: 'http://controller:8776',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/cinder/, '/v3/e70a1557498a46e08839fdfb88fd9a1d'),
        configure: (proxy, options) => {
          proxy.on('error', (err, req, res) => {
            console.log('Cinder proxy error', err);
          });
        }
      },
      // Placement API 프록시
      '/placement': {
        target: 'http://controller:8778',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/placement/, ''),
        configure: (proxy, options) => {
          proxy.on('error', (err, req, res) => {
            console.log('Placement proxy error', err);
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