import fs from 'node:fs';
import path from 'node:path';

const NSE_EQUITY_LIST_URL = 'https://archives.nseindia.com/content/equities/EQUITY_L.csv';
const targetPath = path.resolve(process.cwd(), 'data/stocks.json');

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

function normalizeIndustryKey(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/[^a-z0-9\s&/-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

const SECTORS = {
  IT: 'Information Technology',
  BANKING: 'Banking & Financial Services',
  FMCG: 'FMCG & Consumer',
  PHARMA: 'Pharma & Healthcare',
  AUTO: 'Auto & Mobility',
  ENERGY: 'Energy & Utilities',
  METALS: 'Metals & Mining',
  INFRA: 'Infrastructure & Industrials',
  CHEMICALS: 'Chemicals',
  REALTY: 'Real Estate',
  TELECOM: 'Telecom & Media',
  TEXTILES: 'Textiles & Apparel',
  AGRI: 'Agriculture',
  OTHER: 'Other',
};

const INFER_RULES = [
  { sector: SECTORS.BANKING, patterns: [/\bbank\b/i, /\bfinance\b/i, /\binsurance\b/i, /\bbroking\b/i, /\basset management\b/i, /\bpayment\b/i] },
  { sector: SECTORS.IT, patterns: [/\bsoftware\b/i, /\btechnolog/i, /\bit enabled services\b/i, /\bbpo\b/i, /\bkpo\b/i, /\bcomput/i, /\bdigital\b/i] },
  { sector: SECTORS.PHARMA, patterns: [/\bpharma\b/i, /\bpharmaceutical/i, /\bhealthcare\b/i, /\bhospital\b/i, /\bbiotech\b/i, /\blabs\b/i] },
  { sector: SECTORS.AUTO, patterns: [/\bauto\b/i, /\bvehicle\b/i, /\bmotor\b/i, /\btyre\b/i, /\btractor\b/i, /\bbattery\b/i] },
  { sector: SECTORS.ENERGY, patterns: [/\benergy\b/i, /\boil\b/i, /\bgas\b/i, /\bpetro\b/i, /\bpower\b/i, /\butilities\b/i, /\bsolar\b/i] },
  { sector: SECTORS.METALS, patterns: [/\bmetal\b/i, /\bmining\b/i, /\bsteel\b/i, /\baluminium\b/i, /\bcopper\b/i, /\bzinc\b/i, /\biron\b/i] },
  { sector: SECTORS.INFRA, patterns: [/\binfrastructure\b/i, /\bconstruction\b/i, /\bengineering\b/i, /\bindustrial\b/i, /\bports\b/i, /\blogistics\b/i, /\bshipping\b/i, /\bcement\b/i, /\baerospace\b/i, /\bdefence\b/i, /\bpackaging\b/i, /\bpaper\b/i] },
  { sector: SECTORS.CHEMICALS, patterns: [/\bchemical\b/i, /\bfertilizer\b/i, /\bfertilis/i, /\bagrochem/i, /\bpigment\b/i, /\bdye\b/i, /\bpolymer\b/i, /\bplastic\b/i, /\brubber\b/i] },
  { sector: SECTORS.REALTY, patterns: [/\brealty\b/i, /\breal estate\b/i, /\bproperty\b/i, /\bdeveloper\b/i, /\bhousing\b/i] },
  { sector: SECTORS.TELECOM, patterns: [/\btelecom\b/i, /\bmedia\b/i, /\bbroadcast\b/i, /\bcable\b/i, /\bcommunication\b/i, /\bdigital media\b/i] },
  { sector: SECTORS.TEXTILES, patterns: [/\btextile\b/i, /\bgarment\b/i, /\bapparel\b/i, /\byarn\b/i, /\bspinning\b/i, /\bweaving\b/i, /\bcotton\b/i, /\bleather\b/i] },
  { sector: SECTORS.AGRI, patterns: [/\bagri\b/i, /\bagriculture\b/i, /\bseed\b/i, /\bplantation\b/i, /\bsugar\b/i, /\btea\b/i, /\bcoffee\b/i, /\bedible oil\b/i, /\bdairy\b/i] },
  { sector: SECTORS.FMCG, patterns: [/\bfmcg\b/i, /\bconsumer\b/i, /\bretail\b/i, /\bbeverage\b/i, /\bfood\b/i, /\bpersonal care\b/i, /\bhousehold\b/i, /\bpaint\b/i, /\bhotel\b/i, /\brestaurant\b/i, /\bfashion\b/i, /\bfurniture\b/i, /\bfootwear\b/i] },
];

function countMatches(patterns, text) {
  if (!text) return 0;
  return patterns.reduce((count, pattern) => count + (pattern.test(text) ? 1 : 0), 0);
}

function inferSector(symbol, name, industry = '') {
  const bareSymbol = symbol.replace(/\.NS$/i, '').toUpperCase();
  const normalizedName = normalizeIndustryKey(name);
  const normalizedIndustry = normalizeIndustryKey(industry);

  const overrides = {
    HDFCBANK: SECTORS.BANKING,
    ICICIBANK: SECTORS.BANKING,
    SBIN: SECTORS.BANKING,
    AXISBANK: SECTORS.BANKING,
    KOTAKBANK: SECTORS.BANKING,
    INDUSINDBK: SECTORS.BANKING,
    BAJFINANCE: SECTORS.BANKING,
    BAJAJFINSV: SECTORS.BANKING,
    TCS: SECTORS.IT,
    INFY: SECTORS.IT,
    HCLTECH: SECTORS.IT,
    WIPRO: SECTORS.IT,
    TECHM: SECTORS.IT,
    HINDUNILVR: SECTORS.FMCG,
    ITC: SECTORS.FMCG,
    NESTLEIND: SECTORS.FMCG,
    BRITANNIA: SECTORS.FMCG,
    SUNPHARMA: SECTORS.PHARMA,
    DRREDDY: SECTORS.PHARMA,
    CIPLA: SECTORS.PHARMA,
    DIVISLAB: SECTORS.PHARMA,
    TATAMOTORS: SECTORS.AUTO,
    MARUTI: SECTORS.AUTO,
    HEROMOTOCO: SECTORS.AUTO,
    EICHERMOT: SECTORS.AUTO,
    RELIANCE: SECTORS.ENERGY,
    ONGC: SECTORS.ENERGY,
    NTPC: SECTORS.ENERGY,
    POWERGRID: SECTORS.ENERGY,
    BPCL: SECTORS.ENERGY,
    IOC: SECTORS.ENERGY,
    GAIL: SECTORS.ENERGY,
    TATASTEEL: SECTORS.METALS,
    JSWSTEEL: SECTORS.METALS,
    HINDALCO: SECTORS.METALS,
    LT: SECTORS.INFRA,
    SIEMENS: SECTORS.INFRA,
    BHEL: SECTORS.INFRA,
    ABB: SECTORS.INFRA,
    ADANIPORTS: SECTORS.INFRA,
    ULTRACEMCO: SECTORS.INFRA,
    BHARTIARTL: SECTORS.TELECOM,
    TATACOMM: SECTORS.TELECOM,
  };

  if (overrides[bareSymbol]) {
    return overrides[bareSymbol];
  }

  let bestSector = SECTORS.OTHER;
  let bestScore = 0;

  for (const rule of INFER_RULES) {
    const score = countMatches(rule.patterns, normalizedIndustry) * 4 + countMatches(rule.patterns, normalizedName) * 2;
    if (score > bestScore) {
      bestScore = score;
      bestSector = rule.sector;
    }
  }

  return bestScore >= 2 ? bestSector : SECTORS.OTHER;
}

function mergeAliases(...aliasGroups) {
  return Array.from(
    new Set(
      aliasGroups
        .flat()
        .map((alias) => String(alias).trim().toLowerCase())
        .filter(Boolean)
    )
  );
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
    const aliases = mergeAliases(existingAliases, defaultAliases);

    mergedMap.set(row.symbol, {
      symbol: row.symbol,
      name: row.name || previous?.name?.trim() || '',
      industry: row.industry || previous?.industry || '',
      aliases,
      sector: previous?.sector || inferSector(row.symbol, row.name, row.industry),
    });
  }

  const staleSymbols = Array.from(existingMap.keys()).filter((symbol) => !mergedMap.has(symbol));

  const merged = Array.from(mergedMap.values()).sort((a, b) => a.symbol.localeCompare(b.symbol));

  fs.writeFileSync(targetPath, `${JSON.stringify(merged, null, 2)}\n`, 'utf8');

  console.log(`Synced ${merged.length} active NSE stocks to data/stocks.json`);
  if (staleSymbols.length > 0) {
    console.log(`Dropped ${staleSymbols.length} stale symbols no longer present in NSE EQUITY_L.csv`);
  }
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : String(err));
  process.exit(1);
});
