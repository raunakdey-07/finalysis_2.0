/**
 * Display formatting.
 *
 * Two rules: financial values are grouped the way an Indian reader expects,
 * and every timestamp is rendered in the exchange's own timezone rather than
 * the reader's, so "15:30 IST" always means 15:30 IST.
 */

const EXCHANGE_TIMEZONE = 'Asia/Kolkata';

const dateTimeFormatter = new Intl.DateTimeFormat('en-IN', {
  timeZone: EXCHANGE_TIMEZONE,
  day: 'numeric',
  month: 'short',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
  hour12: false,
});

const dateFormatter = new Intl.DateTimeFormat('en-IN', {
  timeZone: EXCHANGE_TIMEZONE,
  day: 'numeric',
  month: 'short',
  year: 'numeric',
});

export function formatExchangeDateTime(iso: string | null | undefined): string | null {
  if (!iso) return null;
  const parsed = new Date(iso);
  if (Number.isNaN(parsed.getTime())) return null;
  return `${dateTimeFormatter.format(parsed)} IST`;
}

export function formatExchangeDate(iso: string | null | undefined): string | null {
  if (!iso) return null;
  const parsed = new Date(iso);
  if (Number.isNaN(parsed.getTime())) return null;
  return dateFormatter.format(parsed);
}

/** Compact duration used in "retrieved 4 minutes ago". */
export function formatDuration(ms: number): string {
  if (ms < 60_000) return 'moments';

  const minutes = Math.floor(ms / 60_000);
  if (minutes < 60) return `${minutes} minute${minutes === 1 ? '' : 's'}`;

  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} hour${hours === 1 ? '' : 's'}`;

  const days = Math.floor(hours / 24);
  if (days <= 45) return `${days} day${days === 1 ? '' : 's'}`;

  return `${Math.floor(days / 30)} months`;
}

export type FreshnessTone = 'live' | 'recent' | 'stale' | 'unknown';

export interface FreshnessDescription {
  /** The headline the reader needs. */
  label: string;
  /** Secondary line explaining where it came from. */
  detail: string;
  tone: FreshnessTone;
}

/**
 * A quote the exchange recorded more than this long ago is the previous
 * session's close, not a live price. Over a weekend the gap is days, and the
 * page must say so rather than showing a teal "live" treatment.
 */
const LIVE_QUOTE_MAX_AGE_MS = 20 * 60 * 60 * 1000;

/**
 * Describe how current a price is.
 *
 * Two independent facts are combined. `freshness.kind` says how the value
 * reached us. The quote timestamp says when it was true. A value fetched live
 * during a market holiday is still an old close, so the age decides the
 * wording.
 */
export function describePriceFreshness(params: {
  quotedAt: string | null;
  fetchedAt: string;
  freshness: { kind: 'live' | 'cached' | 'daily-close' | 'stale-cache'; ageMs: number | null };
}): FreshnessDescription {
  const { quotedAt, fetchedAt, freshness } = params;
  const quoteTime = formatExchangeDateTime(quotedAt);
  const fetchTime = formatExchangeDateTime(fetchedAt);

  const previousCloseWording = () => ({
    label: quoteTime ? `Last recorded price, as of ${quoteTime}` : 'Last recorded price',
    detail:
      'The exchange has not traded since this price, so it is the most recent close rather than a live quote.',
    tone: 'recent' as const,
  });

  switch (freshness.kind) {
    case 'live':
      if (!quoteTime) {
        return {
          label: `Fetched at ${fetchTime ?? 'an unrecorded time'}`,
          detail: 'The provider did not report a quote time for this price.',
          tone: 'recent',
        };
      }
      if (freshness.ageMs !== null && freshness.ageMs > LIVE_QUOTE_MAX_AGE_MS) {
        return previousCloseWording();
      }
      return { label: `Accurate as of ${quoteTime}`, detail: 'Live quote from the exchange.', tone: 'live' };

    case 'cached': {
      const age = formatDuration(freshness.ageMs ?? 0);
      if (freshness.ageMs !== null && freshness.ageMs > LIVE_QUOTE_MAX_AGE_MS) {
        return previousCloseWording();
      }
      return {
        label: quoteTime ? `Accurate as of ${quoteTime}` : `Retrieved at ${fetchTime ?? 'an unrecorded time'}`,
        detail: `Live quote, retrieved ${age} ago.`,
        tone: 'recent',
      };
    }

    case 'daily-close': {
      const closeDate = formatExchangeDate(quotedAt);
      return {
        label: closeDate ? `Last close: ${closeDate}` : 'Last close, date unrecorded',
        detail: 'End-of-day close from the scheduled snapshot. This is not a live price.',
        tone: 'stale',
      };
    }

    case 'stale-cache': {
      const age = formatDuration(freshness.ageMs ?? 0);
      return {
        label: quoteTime ? `Last known price, as of ${quoteTime}` : 'Last known price',
        detail: `Live pricing is unavailable. This is the last price retrieved, ${age} ago.`,
        tone: 'stale',
      };
    }

    default:
      return {
        label: 'Freshness unknown',
        detail: 'This price could not be traced to a specific time.',
        tone: 'unknown',
      };
  }
}

const BARE = new Intl.NumberFormat('en-IN', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const COMPACT = new Intl.NumberFormat('en-IN', {
  minimumFractionDigits: 1,
  maximumFractionDigits: 1,
});

/** Renders a nullable financial value, never substituting a zero for absence. */
export function formatRupees(value: number | null | undefined): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return '—';
  return BARE.format(value);
}

/** A ratio such as ROE, carrying its own unit so the value is never read bare. */
export function formatPercent(value: number | null | undefined): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return '—';
  return `${BARE.format(value)}%`;
}

export function formatSignedPercent(value: number | null | undefined, compact = false): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return '—';
  const sign = value > 0 ? '+' : value < 0 ? '−' : '';
  return `${sign}${compact ? COMPACT.format(Math.abs(value)) : BARE.format(Math.abs(value))}%`;
}

export function formatMultiple(value: number | null | undefined): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return '—';
  return `${BARE.format(value)}x`;
}

/** Human-readable relative time for article lists, in the reader's locale. */
export function formatRelativeTime(iso: string, now: number = Date.now()): string {
  const parsed = Date.parse(iso);
  if (Number.isNaN(parsed)) return '';

  const diffMs = now - parsed;
  if (diffMs < 0) return 'just now';

  const minutes = Math.round(diffMs / 60_000);
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes}m ago`;

  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;

  const days = Math.round(hours / 24);
  if (days === 1) return 'yesterday';
  if (days < 7) return `${days}d ago`;

  return formatExchangeDate(iso) ?? '';
}
