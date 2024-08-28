import { fileURLToPath, URL } from "url";
import { defineConfig } from "vite";
import vue from "@vitejs/plugin-vue";
// 用https要用的憑證
import mkcert from "vite-plugin-mkcert";

export default defineConfig({
  plugins: [vue(), mkcert()],
  server: {
    https: {},
    host: true, // 監聽所有地址，包括局域網和公網地址
  },
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
});
