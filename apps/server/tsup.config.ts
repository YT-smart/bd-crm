import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm'],
  platform: 'node',
  target: 'node20',
  outDir: 'dist',
  clean: true,
  sourcemap: true,
  // 共享包是 TS 源码，必须打进产物；其余依赖保持外部引用
  noExternal: [/^@bdcrm\//],
});
