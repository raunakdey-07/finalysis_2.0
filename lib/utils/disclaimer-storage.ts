const ACCEPTED_KEY = "finalysis_disclaimer_accepted";

/** Keeps the answer available even when browser storage is blocked. */
let memoryAccepted = false;

/**
 * Local subscribers.
 *
 * The browser `storage` event only fires in OTHER tabs. Subscribing to it alone
 * means the tab that accepted is never told, so the gate stays open until an
 * unrelated re-render happens to re-read the snapshot. This set is the missing
 * notification.
 */
const listeners = new Set<() => void>();

function notify(): void {
  listeners.forEach((listener) => listener());
}

function read(): boolean {
  if (typeof window === "undefined") return true;
  try {
    if (window.localStorage.getItem(ACCEPTED_KEY)) memoryAccepted = true;
  } catch {
    // localStorage itself can throw when storage is disabled. The in-memory
    // answer still stands for this page view.
  }
  return memoryAccepted;
}

export function hasAcceptedDisclaimer(): boolean {
  return read();
}

export function acceptDisclaimer(): void {
  memoryAccepted = true;
  notify();

  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(ACCEPTED_KEY, new Date().toISOString());
  } catch {
    // Consent still holds for this session even if it cannot be persisted.
  }
}

export function subscribeToDisclaimer(callback: () => void): () => void {
  listeners.add(callback);
  window.addEventListener("storage", callback);
  return () => {
    listeners.delete(callback);
    window.removeEventListener("storage", callback);
  };
}
