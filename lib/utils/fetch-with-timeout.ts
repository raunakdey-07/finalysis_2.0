const DEFAULT_TIMEOUT_MS = 10_000;
const MIN_TIMEOUT_MS = 1_000;
const MAX_TIMEOUT_MS = 60_000;

function clampTimeoutMs(value: number): number {
  if (!Number.isFinite(value)) return DEFAULT_TIMEOUT_MS;
  return Math.min(MAX_TIMEOUT_MS, Math.max(MIN_TIMEOUT_MS, Math.floor(value)));
}

function buildSignal(timeoutMs: number, externalSignal?: AbortSignal | null) {
  const controller = new AbortController();
  let detach: (() => void) | undefined;

  if (externalSignal) {
    if (externalSignal.aborted) {
      controller.abort(externalSignal.reason);
    } else {
      const onAbort = () => controller.abort(externalSignal.reason);
      externalSignal.addEventListener('abort', onAbort, { once: true });
      detach = () => externalSignal.removeEventListener('abort', onAbort);
    }
  }

  const timer = setTimeout(() => {
    controller.abort(new Error(`Request timed out after ${timeoutMs}ms`));
  }, timeoutMs);

  return {
    signal: controller.signal,
    release: () => {
      clearTimeout(timer);
      detach?.();
    },
  };
}

/**
 * Fetch and read the body under one timeout.
 *
 * `fetch` resolves when headers arrive, so a caller that reads the body after
 * this returns has no deadline on a response that stalls mid-stream. Provider
 * payloads here run to hundreds of kilobytes, so both steps are bounded
 * together.
 */
export interface FetchResult<T> {
  data: T;
  status: number;
  ok: boolean;
  headers: Record<string, string>;
}

export async function fetchText(
  input: RequestInfo | URL,
  init: RequestInit = {},
  timeoutMs: number = DEFAULT_TIMEOUT_MS
): Promise<{ text: string; status: number; ok: boolean; headers: Record<string, string> }> {
  const { signal, release } = buildSignal(clampTimeoutMs(timeoutMs), init.signal);

  try {
    const response = await fetch(input, { ...init, signal });
    const text = await response.text();
    return {
      text,
      status: response.status,
      ok: response.ok,
      headers: headersToObject(response.headers),
    };
  } finally {
    release();
  }
}

/** Header names are lower-cased so callers can index them predictably. */
export function headersToObject(headers: Headers): Record<string, string> {
  const out: Record<string, string> = {};
  headers.forEach((value, key) => {
    out[key.toLowerCase()] = value;
  });
  return out;
}

export async function fetchJson<T>(
  input: RequestInfo | URL,
  init: RequestInit = {},
  timeoutMs: number = DEFAULT_TIMEOUT_MS
): Promise<FetchResult<T>> {
  const { text, status, ok, headers } = await fetchText(input, init, timeoutMs);
  return { data: JSON.parse(text) as T, status, ok, headers };
}
