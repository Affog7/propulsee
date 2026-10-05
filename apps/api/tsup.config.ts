import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.ts'],
  format: 'esm',
  platform: 'node',
  target: 'node20',
  clean: true,
  // Les packages du monorepo exposent leurs sources TS : on les embarque dans le bundle.
  noExternal: [/^@propulsee\//],
});
