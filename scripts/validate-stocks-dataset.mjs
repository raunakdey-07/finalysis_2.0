import fs from 'node:fs';
import path from 'node:path';

const filePath = path.resolve(process.cwd(), 'data/stocks.json');
const raw = fs.readFileSync(filePath, 'utf8');
const data = JSON.parse(raw);

const allowedSectors = new Set([
  'Information Technology',
  'Banking & Financial Services',
  'FMCG & Consumer',
  'Pharma & Healthcare',
  'Auto & Mobility',
  'Energy & Utilities',
  'Metals & Mining',
  'Infrastructure & Industrials',
  'Chemicals',
  'Real Estate',
  'Telecom & Media',
  'Textiles & Apparel',
  'Agriculture',
]);

if (!Array.isArray(data)) {
  throw new Error('stocks.json must contain an array');
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

  if (entry.industry !== undefined && typeof entry.industry !== 'string') {
    problems.push(`${where}: industry must be a string when present`);
  }

  if (!Array.isArray(entry.aliases) || entry.aliases.length === 0) {
    problems.push(`${where}: aliases must be a non-empty array`);
  }

  if (typeof entry.sector !== 'string' || !allowedSectors.has(entry.sector)) {
    problems.push(`${where}: invalid sector (${entry.sector})`);
  }

  if (seenSymbols.has(entry.symbol)) {
    problems.push(`${where}: duplicate symbol (${entry.symbol})`);
  }
  seenSymbols.add(entry.symbol);
}

if (problems.length > 0) {
  console.error('Stocks dataset validation failed:');
  for (const problem of problems) {
    console.error(`- ${problem}`);
  }
  process.exit(1);
}

console.log(`Stocks dataset valid: ${data.length} entries, ${seenSymbols.size} unique symbols.`);
