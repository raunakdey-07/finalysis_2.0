import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const KEY = "finalysis_disclaimer_accepted";

function mockStorage(value: string | null = null) {
  const storage = {
    getItem: vi.fn(() => value),
    setItem: vi.fn((_key: string, next: string) => { value = next; }),
  };
  vi.stubGlobal("window", { localStorage: storage });
  return storage;
}

describe("disclaimer storage", () => {
  beforeEach(() => {
    vi.resetModules();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  it("is safe in the node/SSR environment without window", async () => {
    const { hasAcceptedDisclaimer, acceptDisclaimer } = await import("@/lib/utils/disclaimer-storage");
    expect(hasAcceptedDisclaimer()).toBe(false);
    expect(() => acceptDisclaimer()).not.toThrow();
    expect(hasAcceptedDisclaimer()).toBe(false);
  });

  it("does not record acceptance just by checking a first visit", async () => {
    const storage = mockStorage();
    const { hasAcceptedDisclaimer } = await import("@/lib/utils/disclaimer-storage");
    expect(hasAcceptedDisclaimer()).toBe(false);
    expect(hasAcceptedDisclaimer()).toBe(false);
    expect(storage.getItem).toHaveBeenCalledWith(KEY);
    expect(storage.setItem).not.toHaveBeenCalled();
  });

  it("recognizes an existing acceptance without writing it again", async () => {
    const storage = mockStorage("2026-01-01T00:00:00.000Z");
    const { hasAcceptedDisclaimer } = await import("@/lib/utils/disclaimer-storage");
    expect(hasAcceptedDisclaimer()).toBe(true);
    expect(storage.setItem).not.toHaveBeenCalled();
  });

  it("stores an ISO timestamp under the existing key and survives a module reload", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-09-17T12:00:00.000Z"));
    const storage = mockStorage();
    const { hasAcceptedDisclaimer, acceptDisclaimer } = await import("@/lib/utils/disclaimer-storage");
    acceptDisclaimer();
    expect(storage.setItem).toHaveBeenCalledWith(KEY, "2026-09-17T12:00:00.000Z");
    expect(hasAcceptedDisclaimer()).toBe(true);
    vi.resetModules();
    const reloaded = await import("@/lib/utils/disclaimer-storage");
    expect(reloaded.hasAcceptedDisclaimer()).toBe(true);
  });

  it("uses memory when accessing localStorage itself throws", async () => {
    vi.stubGlobal("window", {
      get localStorage() { throw new Error("Storage access blocked"); },
    });
    const { hasAcceptedDisclaimer, acceptDisclaimer } = await import("@/lib/utils/disclaimer-storage");
    expect(hasAcceptedDisclaimer()).toBe(false);
    expect(() => acceptDisclaimer()).not.toThrow();
    expect(hasAcceptedDisclaimer()).toBe(true);
  });

  it("handles getItem throwing before and after acceptance", async () => {
    const storage = mockStorage();
    storage.getItem.mockImplementation(() => { throw new Error("Read blocked"); });
    const { hasAcceptedDisclaimer, acceptDisclaimer } = await import("@/lib/utils/disclaimer-storage");
    expect(hasAcceptedDisclaimer()).toBe(false);
    acceptDisclaimer();
    expect(hasAcceptedDisclaimer()).toBe(true);
  });

  it("retains acceptance when setItem fails but getItem keeps returning null", async () => {
    const storage = mockStorage();
    storage.setItem.mockImplementation(() => { throw new Error("Quota exceeded"); });
    const { hasAcceptedDisclaimer, acceptDisclaimer } = await import("@/lib/utils/disclaimer-storage");
    expect(() => acceptDisclaimer()).not.toThrow();
    expect(hasAcceptedDisclaimer()).toBe(true);
    expect(hasAcceptedDisclaimer()).toBe(true);
    expect(storage.getItem).toHaveReturnedWith(null);
  });

  it("keeps a previously read acceptance if subsequent reads are blocked", async () => {
    const storage = mockStorage("2026-01-01T00:00:00.000Z");
    const { hasAcceptedDisclaimer } = await import("@/lib/utils/disclaimer-storage");
    expect(hasAcceptedDisclaimer()).toBe(true);
    storage.getItem.mockImplementation(() => { throw new Error("Read blocked"); });
    expect(hasAcceptedDisclaimer()).toBe(true);
  });
});
