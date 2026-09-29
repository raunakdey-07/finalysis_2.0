/**
 * First-visit consent.
 *
 * The gate only works if acceptance is remembered, and only records a real
 * decision. Storage being unavailable must not mean the gate reappears on
 * every navigation within a session.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

const store = new Map<string, string>();
let storageThrows = false;

vi.mock('@/lib/utils/disclaimer-storage', async () => {
  const actual = await vi.importActual<typeof import('@/lib/utils/disclaimer-storage')>(
    '@/lib/utils/disclaimer-storage'
  );
  return actual;
});

describe('disclaimer acceptance', () => {
  beforeEach(() => {
    store.clear();
    storageThrows = false;
    vi.resetModules();

    vi.stubGlobal('window', {
      localStorage: {
        getItem: (key: string) => {
          if (storageThrows) throw new Error('storage disabled');
          return store.get(key) ?? null;
        },
        setItem: (key: string, value: string) => {
          if (storageThrows) throw new Error('storage disabled');
          store.set(key, value);
        },
      },
    });
  });

  it('starts unaccepted', async () => {
    const { hasAcceptedDisclaimer } = await import('@/lib/utils/disclaimer-storage');
    expect(hasAcceptedDisclaimer()).toBe(false);
  });

  it('records acceptance and remembers it', async () => {
    const { acceptDisclaimer, hasAcceptedDisclaimer } = await import(
      '@/lib/utils/disclaimer-storage'
    );

    acceptDisclaimer();
    expect(hasAcceptedDisclaimer()).toBe(true);
    expect(store.size).toBe(1);
  });

  it('keeps the answer for the session when storage is blocked', async () => {
    const { acceptDisclaimer, hasAcceptedDisclaimer } = await import(
      '@/lib/utils/disclaimer-storage'
    );

    storageThrows = true;
    expect(() => acceptDisclaimer()).not.toThrow();
    expect(hasAcceptedDisclaimer()).toBe(true);
  });

  it('reads acceptance written by another tab', async () => {
    const { hasAcceptedDisclaimer } = await import('@/lib/utils/disclaimer-storage');
    store.set('finalysis_disclaimer_accepted', '2026-09-29T00:00:00.000Z');
    expect(hasAcceptedDisclaimer()).toBe(true);
  });
});
