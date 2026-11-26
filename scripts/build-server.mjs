import { build } from 'esbuild';

await build({
  entryPoints: ['server.ts'],
  outfile: 'server.cjs',
  bundle: true,
  platform: 'node',
  format: 'cjs',
  target: 'node24',
  define: { 'process.env.NODE_ENV': '"production"', 'import.meta.env': '{}' },
  external: ['bufferutil', 'utf-8-validate'],
});
