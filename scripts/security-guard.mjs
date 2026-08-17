import { execFileSync } from 'node:child_process';
import fs from 'node:fs';

const files = execFileSync('git', ['ls-files', '-z'], { encoding: 'utf8' }).split('\0').filter(Boolean);
const violations = [];
const allowedData = new Set(['data/rheomiq-data.example.json']);
const secretPatterns = [
  { name: 'Supabase secret key', re: /sb_secret_[A-Za-z0-9_-]{20,}/g },
  { name: 'Supabase legacy service-role JWT', re: /eyJ[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}/g },
  { name: 'PostgreSQL password URL', re: /postgres(?:ql)?:\/\/[^\s:@/]+:(?!\[YOUR-PASSWORD\]|REPLACE_ME)[^\s@/]{8,}@/gi },
];

for (const file of files) {
  if ((file === '.env' || file.startsWith('.env.')) && file !== '.env.example') {
    violations.push(`${file}: environment file must not be tracked`);
    continue;
  }
  if (file.startsWith('data/') && file.endsWith('.json') && !allowedData.has(file)) {
    violations.push(`${file}: personal finance JSON must not be tracked`);
  }

  let content;
  try {
    const stat = fs.statSync(file);
    if (!stat.isFile() || stat.size > 2 * 1024 * 1024) continue;
    content = fs.readFileSync(file, 'utf8');
  } catch { continue; }

  for (const { name, re } of secretPatterns) {
    re.lastIndex = 0;
    if (re.test(content)) violations.push(`${file}: possible ${name}`);
  }
}

if (violations.length) {
  console.error('RheomIQ privacy guard failed:\n' + violations.map(v => `- ${v}`).join('\n'));
  process.exit(1);
}
console.log(`RheomIQ privacy guard passed (${files.length} tracked files checked).`);
