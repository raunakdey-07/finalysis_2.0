import fs from 'node:fs';
import path from 'node:path';

const filePath = path.resolve(process.cwd(), 'data/nse_symbols.json');
const raw = fs.readFileSync(filePath, 'utf8');
const data = JSON.parse(raw);

if (!Array.isArray(data)) {
  throw new Error('nse_symbols.json must contain an array');
}

const symbolRegex = /^[A-Z0-9&\-.]+\.NS$/;
const seenSymbols = new Set();
const problems = [];

for (const [index, entry] of data.entries()) {
  const where = `index ${index}`;

  if (!entry || typeof entry !== 'object') {
    problems.push(`${where}: entry must be an object`);
    continue;
  }

  if (typeof entry.symbol !== 'string' || !symbolRegex.test(entry.symbol)) {
    problems.push(`${where}: invalid symbol format (${entry.symbol})`);
  }

  if (typeof entry.name !== 'string' || entry.name.trim().length < 2) {
    problems.push(`${where}: invalid company name`);
  }

  if (!Array.isArray(entry.aliases) || entry.aliases.length === 0) {
    problems.push(`${where}: aliases must be a non-empty array`);
  } else {
    const uniqueAliases = new Set(entry.aliases.map((a) => String(a).toLowerCase().trim()).filter(Boolean));
    if (uniqueAliases.size !== entry.aliases.length) {
      problems.push(`${where}: duplicate/empty aliases detected`);
    }
  }

  if (seenSymbols.has(entry.symbol)) {
    problems.push(`${where}: duplicate symbol (${entry.symbol})`);
  }
  seenSymbols.add(entry.symbol);
}

if (problems.length > 0) {
  console.error('Symbol index validation failed:');
  for (const problem of problems) {
    console.error(`- ${problem}`);
  }
  process.exit(1);
}

console.log(`Symbol index valid: ${data.length} entries, ${seenSymbols.size} unique symbols.`);
