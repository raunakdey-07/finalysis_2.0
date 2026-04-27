import fs from 'node:fs';
import path from 'node:path';

const targetPath = path.resolve(process.cwd(), 'data/nse_symbols.json');

const REQUEST_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122 Safari/537.36',
  Accept: 'application/json,text/plain,*/*',
  Referer: 'https://www.nseindia.com/',
  Origin: 'https://www.nseindia.com',
};

function parseArgs(argv) {
  const parsed = {
    force: false,
    limit: 0,
    concurrency: 8,
  };

  for (const arg of argv) {
    if (arg === '--force') {
      parsed.force = true;
      continue;
    }

    if (arg.startsWith('--limit=')) {
      const value = Number(arg.split('=')[1]);
      if (Number.isFinite(value) && value >= 0) parsed.limit = Math.floor(value);
      continue;
    }

    if (arg.startsWith('--concurrency=')) {
      const value = Number(arg.split('=')[1]);
      if (Number.isFinite(value) && value >= 1) parsed.concurrency = Math.floor(value);
    }
  }

  return parsed;
}

function toBareSymbol(symbol) {
  return String(symbol || '').trim().toUpperCase().replace(/\.NS$/i, '');
}

async function fetchIndustry(symbol) {
  const endpoint = `https://www.nseindia.com/api/quote-equity?symbol=${encodeURIComponent(symbol)}`;

  const response = await fetch(endpoint, { headers: REQUEST_HEADERS });
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }

  const payload = await response.json();
  const industry = payload?.info?.industry;
  return typeof industry === 'string' ? industry.trim() : '';
}

async function fetchIndustryWithRetry(symbol, retries = 2) {
  let lastError = null;

  for (let attempt = 0; attempt <= retries; attempt += 1) {
    try {
      return await fetchIndustry(symbol);
    } catch (error) {
      lastError = error;
      if (attempt < retries) {
        await new Promise((resolve) => setTimeout(resolve, 200 * (attempt + 1)));
      }
    }
  }

  throw lastError instanceof Error ? lastError : new Error(String(lastError));
}

async function runPool(items, concurrency, worker) {
  let index = 0;

  async function runWorker() {
    while (true) {
      const currentIndex = index;
      index += 1;
      if (currentIndex >= items.length) return;
      await worker(items[currentIndex], currentIndex);
    }
  }

  const workers = Array.from({ length: Math.min(concurrency, items.length) }, () => runWorker());
  await Promise.all(workers);
}

async function main() {
  const args = parseArgs(process.argv.slice(2));

  const raw = fs.readFileSync(targetPath, 'utf8');
  const rows = JSON.parse(raw);

  if (!Array.isArray(rows)) {
    throw new Error('Expected data/nse_symbols.json to be an array');
  }

  const candidates = rows.filter((row) => {
    if (args.force) return true;
    return !String(row.industry || '').trim();
  });

  const selected = args.limit > 0 ? candidates.slice(0, args.limit) : candidates;

  if (selected.length === 0) {
    console.log('Industry enrichment skipped: all symbols already have industry metadata.');
    return;
  }

  console.log(
    `Enriching industry metadata for ${selected.length} symbols ` +
      `(force=${args.force}, concurrency=${args.concurrency})...`
  );

  const failed = [];
  let updated = 0;
  let missingIndustry = 0;
  let completed = 0;

  await runPool(selected, args.concurrency, async (entry) => {
    const symbol = toBareSymbol(entry.symbol);

    try {
      const industry = await fetchIndustryWithRetry(symbol, 2);
      if (industry) {
        entry.industry = industry;
        updated += 1;
      } else {
        missingIndustry += 1;
      }
    } catch (error) {
      failed.push({
        symbol: entry.symbol,
        reason: error instanceof Error ? error.message : String(error),
      });
    }

    completed += 1;
    if (completed % 200 === 0 || completed === selected.length) {
      console.log(`Progress: ${completed}/${selected.length}`);
    }
  });

  fs.writeFileSync(targetPath, `${JSON.stringify(rows, null, 2)}\n`, 'utf8');

  console.log('Industry enrichment finished.');
  console.log(`Updated industries: ${updated}`);
  console.log(`Still missing industry: ${missingIndustry}`);
  console.log(`Failed requests: ${failed.length}`);

  if (failed.length > 0) {
    const preview = failed.slice(0, 20).map((item) => `${item.symbol}: ${item.reason}`);
    console.log('Sample failures:', preview);
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
