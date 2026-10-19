import fs from 'node:fs';
import { defineConfig } from 'tsup';

export default defineConfig([
  {
    entry: { index: 'src/index.ts' },
    format: 'esm',
    dts: true,
  },
  {
    entry: { cli: 'src/cli/index.ts' },
    format: 'esm',
    banner: { js: '#!/usr/bin/env node' },
    // the bundled ui server reads index.html from its own directory, which is dist/ once built
    onSuccess: async () => {
      fs.copyFileSync('src/ui/index.html', 'dist/index.html');
    },
  },
]);
