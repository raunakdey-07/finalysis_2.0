import fs from 'node:fs';
import path from 'node:path';

const inputPath = path.resolve(process.cwd(), 'data/nse_symbols.json');
const outputPath = path.resolve(process.cwd(), 'data/stocks.json');

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

const SYMBOL_OVERRIDES = {
  // Banking & Financial Services
  HDFCBANK: SECTORS.BANKING,
  ICICIBANK: SECTORS.BANKING,
  SBIN: SECTORS.BANKING,
  AXISBANK: SECTORS.BANKING,
  KOTAKBANK: SECTORS.BANKING,
  INDUSINDBK: SECTORS.BANKING,
  BAJFINANCE: SECTORS.BANKING,
  BAJAJFINSV: SECTORS.BANKING,
  JIOFIN: SECTORS.BANKING,
  CHOLAFIN: SECTORS.BANKING,
  HDFCLIFE: SECTORS.BANKING,
  SBILIFE: SECTORS.BANKING,
  ICICIPRULI: SECTORS.BANKING,

  // Information Technology
  TCS: SECTORS.IT,
  INFY: SECTORS.IT,
  HCLTECH: SECTORS.IT,
  WIPRO: SECTORS.IT,
  TECHM: SECTORS.IT,
  LTIM: SECTORS.IT,
  PERSISTENT: SECTORS.IT,
  OFSS: SECTORS.IT,
  MPHASIS: SECTORS.IT,

  // FMCG & Consumer
  HINDUNILVR: SECTORS.FMCG,
  ITC: SECTORS.FMCG,
  NESTLEIND: SECTORS.FMCG,
  BRITANNIA: SECTORS.FMCG,
  DABUR: SECTORS.FMCG,
  GODREJCP: SECTORS.FMCG,
  TATACONSUM: SECTORS.FMCG,
  VBL: SECTORS.FMCG,
  MARICO: SECTORS.FMCG,

  // Pharma & Healthcare
  SUNPHARMA: SECTORS.PHARMA,
  DRREDDY: SECTORS.PHARMA,
  CIPLA: SECTORS.PHARMA,
  LUPIN: SECTORS.PHARMA,
  DIVISLAB: SECTORS.PHARMA,
  TORNTPHARM: SECTORS.PHARMA,
  APOLLOHOSP: SECTORS.PHARMA,

  // Auto & Mobility
  TATAMOTORS: SECTORS.AUTO,
  MARUTI: SECTORS.AUTO,
  BAJAJAUTO: SECTORS.AUTO,
  HEROMOTOCO: SECTORS.AUTO,
  EICHERMOT: SECTORS.AUTO,
  M_M: SECTORS.AUTO,
  ASHOKLEY: SECTORS.AUTO,

  // Energy & Utilities
  RELIANCE: SECTORS.ENERGY,
  ONGC: SECTORS.ENERGY,
  OIL: SECTORS.ENERGY,
  NTPC: SECTORS.ENERGY,
  POWERGRID: SECTORS.ENERGY,
  TATAPOWER: SECTORS.ENERGY,
  ADANIGREEN: SECTORS.ENERGY,
  ADANIPOWER: SECTORS.ENERGY,
  BPCL: SECTORS.ENERGY,
  IOC: SECTORS.ENERGY,
  GAIL: SECTORS.ENERGY,

  // Metals & Mining
  TATASTEEL: SECTORS.METALS,
  JSWSTEEL: SECTORS.METALS,
  HINDALCO: SECTORS.METALS,
  VEDL: SECTORS.METALS,
  JINDALSTEL: SECTORS.METALS,
  COALINDIA: SECTORS.METALS,
  NMDC: SECTORS.METALS,
  SAIL: SECTORS.METALS,

  // Infrastructure & Industrials
  LT: SECTORS.INFRA,
  SIEMENS: SECTORS.INFRA,
  BHEL: SECTORS.INFRA,
  ABB: SECTORS.INFRA,
  ADANIPORTS: SECTORS.INFRA,
  ULTRACEMCO: SECTORS.INFRA,
  AMBUJACEM: SECTORS.INFRA,
  SHREECEM: SECTORS.INFRA,

  // Telecom
  BHARTIARTL: SECTORS.TELECOM,
  TATACOMM: SECTORS.TELECOM,
};

const RAW_INDUSTRY_OVERRIDES = {
  'Hotels & Resorts': SECTORS.FMCG,
  'HOTELS/RESORTS': SECTORS.FMCG,
  'Tour Travel Related Services': SECTORS.FMCG,
  'Amusement Parks/ Other Recreation': SECTORS.FMCG,
  'Airline': SECTORS.FMCG,
  'Leisure Products': SECTORS.FMCG,
  Houseware: SECTORS.FMCG,
  Restaurants: SECTORS.FMCG,

  'Plywood Boards/ Laminates': SECTORS.INFRA,
  Ceramics: SECTORS.INFRA,
  'Granites & Marbles': SECTORS.INFRA,
  'Sanitary Ware': SECTORS.INFRA,
  'Waste Management': SECTORS.INFRA,
  'Water Supply & Management': SECTORS.INFRA,
  'Abrasives & Bearings': SECTORS.INFRA,
  'Consulting Services': SECTORS.INFRA,
  Dredging: SECTORS.INFRA,
  'Railway Wagons': SECTORS.INFRA,
  'Port & Port services': SECTORS.INFRA,
  'Airport & Airport services': SECTORS.INFRA,
  Diversified: SECTORS.INFRA,
  Education: SECTORS.INFRA,

  Paints: SECTORS.CHEMICALS,
  'Printing Inks': SECTORS.CHEMICALS,
  Explosives: SECTORS.CHEMICALS,

  Lubricants: SECTORS.ENERGY,
  'Offshore Support Solution Drilling': SECTORS.ENERGY,
  'LPG/CNG/PNG/LNG Supplier': SECTORS.ENERGY,

  'Electrodes & Refractories': SECTORS.METALS,
  'Ferro & Silica Manganese': SECTORS.METALS,
  'Diversified Metals': SECTORS.METALS,
  'Precious Metals': SECTORS.METALS,

  'Animal Feed': SECTORS.AGRI,
  Seafood: SECTORS.AGRI,
  'Forest Products': SECTORS.AGRI,

  'Jute & Jute Products': SECTORS.TEXTILES,

  'Printing & Publication': SECTORS.TELECOM,
  'E-Learning': SECTORS.TELECOM,

  Ratings: SECTORS.BANKING,

  Tractors: SECTORS.AUTO,
  'Passenger Cars & Utility Vehicles': SECTORS.AUTO,
  'Commercial Vehicles': SECTORS.AUTO,
  Cycles: SECTORS.AUTO,

  Biotechnology: SECTORS.PHARMA,
  Wellness: SECTORS.PHARMA,
};

const INDUSTRY_OVERRIDES = Object.fromEntries(
  Object.entries(RAW_INDUSTRY_OVERRIDES).map(([industry, sector]) => [normalizeIndustryKey(industry), sector])
);

const SECTOR_RULES = [
  {
    sector: SECTORS.BANKING,
    patterns: [
      /\bbank\b/i,
      /\bfinancial\b/i,
      /\bfinance\b/i,
      /\bfinserv\b/i,
      /\bnbfc\b/i,
      /\binsurance\b/i,
      /\bsecurities\b/i,
      /\bbroking\b/i,
      /\basset management\b/i,
      /\bwealth\b/i,
      /\bhousing finance\b/i,
      /\blending\b/i,
      /\bcapital market\b/i,
      /\bdepository\b/i,
      /\bstock exchange\b/i,
      /\bmicrofinance\b/i,
      /\bpayment\b/i,
      /\binvestment company\b/i,
      /\bholding company\b/i,
      /\bstockbroking\b/i,
      /\ballied\b/i,
    ],
  },
  {
    sector: SECTORS.IT,
    patterns: [
      /\bsoftware\b/i,
      /\btechnolog/i,
      /\binfotech\b/i,
      /\binformation technology\b/i,
      /\bit services\b/i,
      /\bit consulting\b/i,
      /\bcloud\b/i,
      /\bdata\b/i,
      /\bdigital\b/i,
      /\bcomput/i,
      /\bsaas\b/i,
      /\bcyber\b/i,
      /\bsemiconductor\b/i,
      /\belectronics\b/i,
      /\binternet\b/i,
      /\bit enabled services\b/i,
      /\bbusiness process outsourcing\b/i,
      /\bknowledge process outsourcing\b/i,
      /\bbpo\b/i,
      /\bkpo\b/i,
    ],
  },
  {
    sector: SECTORS.PHARMA,
    patterns: [
      /\bpharma\b/i,
      /\bpharmaceutical/i,
      /\bhealthcare\b/i,
      /\bhospital\b/i,
      /\bbiotech\b/i,
      /\bdiagnostic\b/i,
      /\bdrug\b/i,
      /\btherapeutic\b/i,
      /\bmedical\b/i,
      /\blaborator/i,
      /\blabs\b/i,
    ],
  },
  {
    sector: SECTORS.AUTO,
    patterns: [
      /\bauto\b/i,
      /\bautomobile\b/i,
      /\bvehicle\b/i,
      /\bmotor\b/i,
      /\bmobility\b/i,
      /\btyre\b/i,
      /\btyres\b/i,
      /\btractor\b/i,
      /\bcommercial vehicle\b/i,
      /\bauto ancillar/i,
      /\bev\b/i,
      /\bbattery\b/i,
    ],
  },
  {
    sector: SECTORS.ENERGY,
    patterns: [
      /\benergy\b/i,
      /\boil\b/i,
      /\bgas\b/i,
      /\bpetro\b/i,
      /\bpetroleum\b/i,
      /\brefiner/i,
      /\bpower\b/i,
      /\butilities\b/i,
      /\belectric\b/i,
      /\brenewable\b/i,
      /\bsolar\b/i,
      /\bwind\b/i,
      /\bhydro\b/i,
      /\btransmission\b/i,
      /\bdistribution\b/i,
      /\bthermal\b/i,
    ],
  },
  {
    sector: SECTORS.METALS,
    patterns: [
      /\bmetal\b/i,
      /\bmining\b/i,
      /\bsteel\b/i,
      /\baluminium\b/i,
      /\bcopper\b/i,
      /\bzinc\b/i,
      /\biron\b/i,
      /\bferrous\b/i,
      /\balloy\b/i,
      /\bore\b/i,
      /\bmineral\b/i,
      /\bcoal\b/i,
      /\bsmelter\b/i,
    ],
  },
  {
    sector: SECTORS.FMCG,
    patterns: [
      /\bfmcg\b/i,
      /\bconsumer\b/i,
      /\bconsumer goods\b/i,
      /\bfoods\b/i,
      /\bfood products\b/i,
      /\bbeverage\b/i,
      /\bbrew\b/i,
      /\bdistiller/i,
      /\btobacco\b/i,
      /\bpersonal care\b/i,
      /\bhousehold\b/i,
      /\bretail\b/i,
      /\bpaint\b/i,
      /\bapparel\b/i,
      /\bfashion\b/i,
      /\bhotel\b/i,
      /\bresort\b/i,
      /\brestaurants?\b/i,
      /\bjewellery\b/i,
      /\bwatches\b/i,
      /\bhome furnishing\b/i,
      /\bfurniture\b/i,
      /\bfootwear\b/i,
      /\bstationary\b/i,
    ],
  },
  {
    sector: SECTORS.INFRA,
    patterns: [
      /\binfrastructure\b/i,
      /\binfra\b/i,
      /\bconstruction\b/i,
      /\bengineering\b/i,
      /\bcapital goods\b/i,
      /\bindustrial\b/i,
      /\bindustrial products\b/i,
      /\bprojects\b/i,
      /\bports\b/i,
      /\blogistics\b/i,
      /\bshipping\b/i,
      /\brail\b/i,
      /\broad\b/i,
      /\btransport\b/i,
      /\bcement\b/i,
      /\bdefence\b/i,
      /\baerospace\b/i,
      /\baviation\b/i,
      /\bpackaging\b/i,
      /\bpaper\b/i,
      /\bpaper products\b/i,
      /\bheavy electrical equipment\b/i,
      /\belectrical equipment\b/i,
      /\bcompressors\b/i,
      /\bpumps\b/i,
      /\bdiesel engines\b/i,
      /\bcables\b/i,
      /\bcastings\b/i,
      /\bforgings\b/i,
      /\btrading\b/i,
      /\bdistributors\b/i,
      /\bdiversified commercial services\b/i,
      /\beducation\b/i,
    ],
  },
  {
    sector: SECTORS.CHEMICALS,
    patterns: [
      /\bchemical\b/i,
      /\bchemicals\b/i,
      /\bspecialty\b/i,
      /\bfertilizer\b/i,
      /\bfertilis/i,
      /\bagrochem/i,
      /\bpigment\b/i,
      /\bdye\b/i,
      /\bsolvent\b/i,
      /\bpolymer\b/i,
      /\bplastic\b/i,
      /\bsurfactant\b/i,
      /\bresin\b/i,
      /\bdyes\b/i,
      /\bpigments\b/i,
      /\bpetrochemicals\b/i,
      /\bfertilizers\b/i,
      /\brubber\b/i,
    ],
  },
  {
    sector: SECTORS.REALTY,
    patterns: [
      /\brealty\b/i,
      /\breal estate\b/i,
      /\bproperties\b/i,
      /\bproperty\b/i,
      /\bdevelopers\b/i,
      /\bdeveloper\b/i,
      /\bland\b/i,
      /\bhousing\b/i,
      /\bcommercial real estate\b/i,
    ],
  },
  {
    sector: SECTORS.TELECOM,
    patterns: [
      /\btelecom\b/i,
      /\btelecommunication\b/i,
      /\bmedia\b/i,
      /\bentertainment\b/i,
      /\bbroadcast\b/i,
      /\bcable\b/i,
      /\bcommunication\b/i,
      /\bdigital media\b/i,
    ],
  },
  {
    sector: SECTORS.TEXTILES,
    patterns: [
      /\btextile\b/i,
      /\btextiles\b/i,
      /\bfabric\b/i,
      /\bgarment\b/i,
      /\bapparel\b/i,
      /\bapparels\b/i,
      /\byarn\b/i,
      /\bspinning\b/i,
      /\bweaving\b/i,
      /\bknit\b/i,
      /\bcotton\b/i,
      /\bdenim\b/i,
      /\bleather\b/i,
    ],
  },
  {
    sector: SECTORS.AGRI,
    patterns: [
      /\bagri\b/i,
      /\bagriculture\b/i,
      /\bfarming\b/i,
      /\bseed\b/i,
      /\bseeds\b/i,
      /\bplantation\b/i,
      /\bsugar\b/i,
      /\btea\b/i,
      /\bcoffee\b/i,
      /\bgrain\b/i,
      /\bedible oil\b/i,
      /\bpoultry\b/i,
      /\bdairy\b/i,
      /\bother agricultural products\b/i,
    ],
  },
];

function normalizeText(value) {
  return normalizeIndustryKey(value);
}

function countMatches(patterns, text) {
  if (!text) return 0;
  return patterns.reduce((count, pattern) => count + (pattern.test(text) ? 1 : 0), 0);
}

function inferSector(symbol, name, industry = '') {
  const bareSymbol = symbol.replace(/\.NS$/i, '').toUpperCase();
  if (SYMBOL_OVERRIDES[bareSymbol]) {
    return SYMBOL_OVERRIDES[bareSymbol];
  }

  const normalizedName = normalizeText(name);
  const normalizedIndustry = normalizeText(industry);

  if (normalizedIndustry && INDUSTRY_OVERRIDES[normalizedIndustry]) {
    return INDUSTRY_OVERRIDES[normalizedIndustry];
  }

  let bestSector = SECTORS.OTHER;
  let bestScore = 0;

  for (const rule of SECTOR_RULES) {
    const industryScore = countMatches(rule.patterns, normalizedIndustry) * 4;
    const nameScore = countMatches(rule.patterns, normalizedName) * 2;
    const score = industryScore + nameScore;

    if (score > bestScore) {
      bestScore = score;
      bestSector = rule.sector;
    }
  }

  return bestScore >= 2 ? bestSector : SECTORS.OTHER;
}

function normalizeAliases(aliases) {
  if (!Array.isArray(aliases)) return [];
  return Array.from(new Set(aliases.map((alias) => String(alias).trim().toLowerCase()).filter(Boolean)));
}

function main() {
  const raw = fs.readFileSync(inputPath, 'utf8');
  const rows = JSON.parse(raw);

  if (!Array.isArray(rows)) {
    throw new Error('Expected data/nse_symbols.json to be an array');
  }

  const stocks = rows
    .map((entry) => {
      const symbol = String(entry.symbol || '').trim().toUpperCase();
      const name = String(entry.name || '').trim();
      const industry = String(entry.industry || '').trim();
      const aliases = normalizeAliases(entry.aliases);

      const sector = inferSector(symbol, name, industry);

      return {
        symbol,
        name,
        industry,
        aliases,
        sector,
      };
    })
    .filter((entry) => entry.symbol && entry.name && entry.aliases.length > 0)
    .sort((a, b) => a.symbol.localeCompare(b.symbol));

  fs.writeFileSync(outputPath, `${JSON.stringify(stocks, null, 2)}\n`, 'utf8');

  const sectorCounts = stocks.reduce((acc, stock) => {
    acc[stock.sector] = (acc[stock.sector] || 0) + 1;
    return acc;
  }, {});

  const missingIndustry = stocks.filter((stock) => !stock.industry).length;

  console.log(`Built data/stocks.json with ${stocks.length} entries.`);
  console.log(`Missing industry metadata for ${missingIndustry} stocks.`);
  console.log('Sector distribution:', sectorCounts);
}

main();
