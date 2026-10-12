import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Spielserver für das Online-Spiel. Im Entwickeln leitet Vite /socket.io dorthin weiter,
// damit der Browser nur eine Adresse kennt. Tests setzen ZUERIPOLY_SERVER auf ihren eigenen Server.
const gameServer = process.env.ZUERIPOLY_SERVER ?? "http://localhost:3001";

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      "/socket.io": { target: gameServer, ws: true },
    },
  },
});
