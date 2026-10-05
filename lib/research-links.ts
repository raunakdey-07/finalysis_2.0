/**
 * Primary sources for a company.
 *
 * Fin-alysis summarises a handful of published figures and nothing else. These
 * are where the reader goes for the filings, notes and disclosures the screen
 * does not read.
 *
 * Server-safe on purpose: the news route offers the same links when no article
 * was retrieved, and the page offers them on every company.
 */
export interface ResearchLink {
  label: string;
  href: string;
  source: string;
}

export function buildResearchLinks(symbol: string, companyName: string | null): ResearchLink[] {
  const ticker = symbol.replace(/\.NS$/i, '').toUpperCase();
  const name = companyName ?? ticker;

  return [
    {
      label: `${name}: company page`,
      href: `https://www.screener.in/company/${encodeURIComponent(ticker)}/`,
      source: 'Screener.in',
    },
    {
      label: `${ticker}: price and company profile`,
      href: `https://finance.yahoo.com/quote/${encodeURIComponent(ticker)}.NS`,
      source: 'Yahoo Finance',
    },
    {
      label: `${ticker}: corporate filings and announcements`,
      href: 'https://www.nseindia.com/companies-listing/corporate-filings-announcements',
      source: 'NSE India',
    },
    {
      label: `${ticker}: quarterly results`,
      href: 'https://www.nseindia.com/companies-listing/quarterly-results',
      source: 'NSE India',
    },
    {
      label: `${ticker}: exchange quote page`,
      href: `https://www.bseindia.com/stock-share-price/${encodeURIComponent(ticker.toLowerCase())}/`,
      source: 'BSE India',
    },
  ];
}
