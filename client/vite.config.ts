import path from "path";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  server: {
    host: '0.0.0.0', // Allow connections from all hosts/IP addresses
    port: 5173,
    strictPort: true, // Fail if port is already in use
    allowedHosts: [
      'localhost',
      'login.lvh.me',
      'acme.lvh.me',
      'globex.lvh.me',
      'lvh.me',
      '.lvh.me' // Allow all subdomains of lvh.me
    ],
    proxy: {
      "/api": {
        target: "http://localhost:3000", // Your backend
        changeOrigin: false,
        secure: false,
      },
    },
    cors: true, // Enable CORS for all origins
    open: true, // Open browser on start
    hmr: {
      // Allow HMR connections from all hosts
      host: 'localhost',
      port: 5173,
    },
  },
});
