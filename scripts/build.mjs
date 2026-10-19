import { build } from 'esbuild';
import { readFile, writeFile } from 'node:fs/promises';

await build({
  entryPoints: ['src/main.js'], bundle: true, outfile: 'main.js', format: 'cjs', platform: 'node',
  target: 'es2022', external: ['obsidian', 'node:https'], loader: { '.png': 'base64' },
  minify: false, sourcemap: false, treeShaking: true,
  banner: { js: '/* Creation Studio | MIT | Copyright (c) 2026 Xie Lab */' }
});
const manifest = JSON.parse(await readFile('manifest.json', 'utf8'));
const pkg = JSON.parse(await readFile('package.json', 'utf8'));
if (pkg.version !== manifest.version) throw new Error('Package and manifest versions differ');
let versions = {};
try { versions = JSON.parse(await readFile('versions.json', 'utf8')); } catch (error) { if (error.code !== 'ENOENT') throw error; }
await writeFile('versions.json', JSON.stringify({ ...versions, [manifest.version]: manifest.minAppVersion }, null, 2) + '\n');
console.log(`Built Creation Studio ${manifest.version}; templates and banner included in main.js.`);
