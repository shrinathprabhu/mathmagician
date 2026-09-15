import vinext from 'vinext';
import { defineConfig } from 'vite';
import { sites } from '@openai/sites-vite-plugin';
export default defineConfig({
  server: { watch: { useFsEvents: false, usePolling: true } },
  plugins: [vinext(), sites()],
});
