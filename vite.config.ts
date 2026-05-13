import { defineConfig, loadEnv } from 'vite'
import vue from '@vitejs/plugin-vue'
import { viteSingleFile } from 'vite-plugin-singlefile'

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const isSingleFile = mode === 'singlefile';
  const env = loadEnv(mode, process.cwd(), '');
  const publicBase = env.VITE_APP_PUBLIC_BASE || './';

  return {
    base: isSingleFile ? './' : publicBase,
    plugins: [
      vue(),
      ...(isSingleFile ? [viteSingleFile()] : [])
    ]
  };
})
