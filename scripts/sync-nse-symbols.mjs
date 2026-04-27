import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const NSE_EQUITY_LIST_URL = 'https://archives.nseindia.com/content/equities/EQUITY_L.csv';
const targetPath = path.resolve(process.cwd(), 'data/nse_symbols.json');

function parseCsvLine(line) {
  const result = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i += 1) {
    const char = line[i];

    if (char === '"') {
      const next = line[i + 1];
      if (inQuotes && next === '"') {
        current += '"';
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (char === ',' && !inQuotes) {
      result.push(current.trim());
      current = '';
      continue;
    }

    current += char;
  }

  result.push(current.trim());
  return result;
}

function normalizeHeader(value) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}

function normalizeAlias(value) {
  return value
    .toLowerCase()
    .replace(/\b(limited|ltd|company|co|corporation|corp|inc|plc)\b/g, ' ')
    .replace(/[^a-z0-9&\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function buildDefaultAliases(symbol, name) {
  const aliases = new Set();
  const baseSymbol = symbol.replace(/\.NS$/i, '').toLowerCase();
  aliases.add(baseSymbol);

  const cleanName = name.replace(/\s+/g, ' ').trim();
  if (cleanName) aliases.add(cleanName.toLowerCase());

  const compactName = normalizeAlias(cleanName);
  if (compactName) aliases.add(compactName);

  if (compactName.includes(' and ')) {
    aliases.add(compactName.replace(/\band\b/g, '&').replace(/\s+/g, ' ').trim());
  }

  return Array.from(aliases).filter(Boolean);
}

async function fetchNseRows() {
  const response = await fetch(NSE_EQUITY_LIST_URL, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122 Safari/537.36',
      Accept: 'text/csv,*/*',
    },
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch NSE equity list (${response.status})`);
  }

  const csv = await response.text();
  const lines = csv
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0);

  if (lines.length < 2) {
    throw new Error('NSE CSV appears empty');
  }

  const headers = parseCsvLine(lines[0]);
  const normalizedHeaders = headers.map(normalizeHeader);

  const symbolIndex = normalizedHeaders.findIndex((h) => h === 'symbol');
  const nameIndex = normalizedHeaders.findIndex((h) => h === 'name of company');
  const industryIndex = normalizedHeaders.findIndex((h) => h === 'industry');

  if (symbolIndex < 0 || nameIndex < 0) {
    throw new Error('Could not locate required columns in NSE CSV');
  }

  const rows = [];

  for (let i = 1; i < lines.length; i += 1) {
    const cols = parseCsvLine(lines[i]);
    const symbol = (cols[symbolIndex] || '').trim().toUpperCase();
    const name = (cols[nameIndex] || '').trim();

    if (!symbol || !name) continue;
    if (!/^[A-Z0-9&\-.]+$/.test(symbol)) continue;

    rows.push({
      symbol: `${symbol}.NS`,
      name,
      industry: industryIndex >= 0 ? String(cols[industryIndex] || '').trim() : '',
    });
  }

  return rows;
}

async function main() {
  const existingRaw = fs.readFileSync(targetPath, 'utf8');
  const existing = JSON.parse(existingRaw);

  const existingMap = new Map(
    existing.map((entry) => [entry.symbol, entry])
  );

  const nseRows = await fetchNseRows();
  const mergedMap = new Map();

  for (const row of nseRows) {
    const previous = existingMap.get(row.symbol);
    const defaultAliases = buildDefaultAliases(row.symbol, row.name);
    const existingAliases = Array.isArray(previous?.aliases) ? previous.aliases : [];

    const aliases = Array.from(
      new Set([...existingAliases, ...defaultAliases].map((a) => String(a).trim().toLowerCase()).filter(Boolean))
    );

    mergedMap.set(row.symbol, {
      symbol: row.symbol,
      name: row.name || previous?.name?.trim() || '',
      industry: row.industry || previous?.industry || '',
      aliases,
    });
  }

  const staleSymbols = Array.from(existingMap.keys()).filter((symbol) => !mergedMap.has(symbol));

  const merged = Array.from(mergedMap.values()).sort((a, b) => a.symbol.localeCompare(b.symbol));

  fs.writeFileSync(targetPath, `${JSON.stringify(merged, null, 2)}\n`, 'utf8');

  console.log(`Synced ${merged.length} active NSE symbols to data/nse_symbols.json`);
  if (staleSymbols.length > 0) {
    console.log(`Dropped ${staleSymbols.length} stale symbols no longer present in NSE EQUITY_L.csv`);
  }

  const enrichIndustryResult = spawnSync('node', ['scripts/enrich-nse-industries.mjs', '--concurrency=8'], {
    cwd: process.cwd(),
    stdio: 'inherit',
  });

  if (enrichIndustryResult.status !== 0) {
    console.warn('Warning: industry enrichment failed; continuing with available metadata.');
  }

  const buildStocksResult = spawnSync('node', ['scripts/build-stocks-dataset.mjs'], {
    cwd: process.cwd(),
    stdio: 'inherit',
  });

  if (buildStocksResult.status !== 0) {
    throw new Error('Failed to build data/stocks.json after syncing symbols');
  }
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : String(err));
  process.exit(1);
});
