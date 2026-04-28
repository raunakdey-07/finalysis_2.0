"use client";

import { useSyncExternalStore } from "react";

const DISCLAIMER_KEY = "finalysis_disclaimer_accepted";

// External store pattern - avoids setState in useEffect
function subscribe(callback: () => void) {
  window.addEventListener("storage", callback);
  return () => window.removeEventListener("storage", callback);
}

function getSnapshot() {
  return localStorage.getItem(DISCLAIMER_KEY);
}

function getServerSnapshot() {
  return "pending"; // Assume accepted during SSR to avoid hydration mismatch
}

export default function DisclaimerModal() {
  const accepted = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  
  function handleAccept() {
    localStorage.setItem(DISCLAIMER_KEY, new Date().toISOString());
    window.dispatchEvent(new Event("storage")); // Trigger re-render
  }

  // Don't render if SSR ("pending") or already accepted
  if (accepted) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-xl bg-white p-6 shadow-2xl sm:p-8">
        <h2 className="text-xl font-semibold text-stone-900">Before you begin</h2>
        
        <div className="mt-4 space-y-4 text-sm leading-relaxed text-stone-600">
          <p>
            <strong className="text-stone-800">Finalysis is an educational tool</strong> designed to help you understand 
            stocks better. It is not a substitute for professional financial advice.
          </p>
          
          <div className="rounded-lg bg-amber-50 p-4 text-amber-900">
            <p className="font-medium">Important Disclaimers:</p>
            <ul className="mt-2 list-inside list-disc space-y-1 text-amber-800">
              <li>This is <strong>not financial advice</strong></li>
              <li>Data may be delayed, incomplete, or inaccurate</li>
              <li>Always verify information from official sources</li>
              <li>Consult a SEBI-registered advisor before investing</li>
            </ul>
          </div>

          <p>
            <strong className="text-stone-800">Data sources:</strong> Prices from NSE public endpoints 
            (may be 10+ minutes delayed), fundamentals scraped from Screener.in (may be outdated), 
            news from Google News RSS, with fallback sources from NSE India, Screener.in, BSE India, and Moneycontrol when needed.
          </p>

          <p>
            <strong className="text-stone-800">No guarantees:</strong> The scores, verdicts, and recommendations 
            are algorithmically generated and may not reflect actual investment quality. Past performance 
            does not guarantee future results.
          </p>

          <p className="text-xs text-stone-500">
            By continuing, you acknowledge that you understand these limitations and agree to use 
            this tool for educational purposes only.
          </p>
        </div>

        <button
          onClick={handleAccept}
          className="mt-6 w-full rounded-lg bg-stone-900 py-3 text-sm font-medium text-white hover:bg-stone-800"
        >
          I understand, continue
        </button>
      </div>
    </div>
  );
}
