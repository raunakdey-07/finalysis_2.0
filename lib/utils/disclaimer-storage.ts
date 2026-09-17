const DISCLAIMER_KEY = "finalysis_disclaimer_accepted";

// Keep acceptance for this page lifetime even when browser storage is blocked.
let memoryAcceptance: string | null = null;

export function hasAcceptedDisclaimer(): boolean {
  if (typeof window === "undefined") return false;

  try {
    memoryAcceptance = window.localStorage.getItem(DISCLAIMER_KEY) || memoryAcceptance;
  } catch {
    // Accessing localStorage itself can throw, as can getItem.
  }

  return Boolean(memoryAcceptance);
}

export function acceptDisclaimer(): void {
  if (typeof window === "undefined") return;

  memoryAcceptance = new Date().toISOString();
  try {
    window.localStorage.setItem(DISCLAIMER_KEY, memoryAcceptance);
  } catch {
    // The in-memory acceptance still lets the user continue.
  }
}
