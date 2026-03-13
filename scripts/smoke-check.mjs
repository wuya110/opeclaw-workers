import fs from 'node:fs';

const files = [
  'apps/worker/src/index.js',
  'apps/web/index.html',
  'wrangler.toml',
  'docs/ARCHITECTURE.md'
];

const missing = files.filter((file) => !fs.existsSync(file));
if (missing.length) {
  console.error('缺少关键文件:');
  for (const file of missing) console.error(`- ${file}`);
  process.exit(1);
}

console.log('骨架自检通过。');
