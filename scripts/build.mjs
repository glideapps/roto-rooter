#!/usr/bin/env node

import * as esbuild from 'esbuild';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';
import { execSync } from 'child_process';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '..');
const distDir = path.join(rootDir, 'dist');

// Clean dist directory
if (fs.existsSync(distDir)) {
  fs.rmSync(distDir, { recursive: true });
}
fs.mkdirSync(distDir);

const packageJson = JSON.parse(
  fs.readFileSync(path.join(rootDir, 'package.json'), 'utf-8')
);

const commonOptions = {
  bundle: true,
  platform: 'node',
  target: 'node18',
  format: 'cjs',
  sourcemap: false,
  minify: true,
  define: {
    __VERSION__: JSON.stringify(packageJson.version),
  },
};

// Build the CLI
await esbuild.build({
  ...commonOptions,
  entryPoints: [path.join(rootDir, 'src/cli.ts')],
  outfile: path.join(rootDir, 'dist/cli.js'),
  banner: {
    js: '#!/usr/bin/env node',
  },
});

// Build the library (for programmatic use)
await esbuild.build({
  ...commonOptions,
  entryPoints: [path.join(rootDir, 'src/index.ts')],
  outfile: path.join(rootDir, 'dist/index.js'),
});

// Generate type declarations using tsc
execSync('npx tsc --emitDeclarationOnly --declaration --outDir dist', {
  cwd: rootDir,
  stdio: 'inherit',
});

console.log('Build complete');
