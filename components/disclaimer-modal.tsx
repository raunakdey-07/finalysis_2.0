"use client";

import { useState, useSyncExternalStore } from "react";
import {
  Root as Dialog,
  Content as DialogContent,
  Title as DialogTitle,
  Description as DialogDescription,
  Portal,
  Overlay,
  Trigger,
  Close,
} from "@radix-ui/react-dialog";
import { acceptDisclaimer, hasAcceptedDisclaimer } from "@/lib/utils/disclaimer-storage";

function subscribe(callback: () => void) {
  window.addEventListener("storage", callback);
  return () => window.removeEventListener("storage", callback);
}

function getServerSnapshot() {
  return true; // Keep the dialog closed until browser storage can be checked.
}

export default function DisclaimerModal() {
  const accepted = useSyncExternalStore(subscribe, hasAcceptedDisclaimer, getServerSnapshot);
  // An explicit dismissal overrides automatic opening without recording acceptance.
  const [open, setOpen] = useState<boolean | undefined>(undefined);

  function handleAccept() {
    acceptDisclaimer();
    setOpen(false);
  }

  return (
    <Dialog open={open ?? !accepted} onOpenChange={setOpen}>
      <Trigger asChild>
        <button
          type="button"
          className="rounded text-sm text-stone-600 underline underline-offset-4 hover:text-stone-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-stone-900 focus-visible:ring-offset-2"
        >
          Disclaimers &amp; Methodology
        </button>
      </Trigger>
      <Portal>
        <Overlay className="fixed inset-0 z-50 bg-black/50" />
        <DialogContent aria-modal="true" className="fixed left-1/2 top-1/2 z-50 max-h-[90vh] w-[calc(100%_-_2rem)] max-w-lg -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-xl bg-white p-6 shadow-2xl sm:p-8">
          <DialogTitle className="text-xl font-semibold text-stone-900">
            Before you begin
          </DialogTitle>

          <div className="mt-4 space-y-4 text-sm leading-relaxed text-stone-600">
            <DialogDescription>
              <strong className="text-stone-800">Finalysis is an educational tool</strong> designed to help you understand
              stocks better. It is not a substitute for professional financial advice.
            </DialogDescription>

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
              <strong className="text-stone-800">Data sources:</strong> Prices come from the Yahoo Finance public API,
              not a direct NSE feed. Fundamentals are extracted from Screener.in public pages.
              Prices may be delayed and fundamentals may be outdated.
            </p>

            <p>
              <strong className="text-stone-800">Methodology:</strong> Scores are rule-based, heuristic summaries of
              available inputs, not probabilities, expected returns, or predictions. Review the underlying metrics,
              their explanations, and data limitations rather than relying on a score alone.
            </p>

            <p>
              <strong className="text-stone-800">No guarantees:</strong> Scores and verdicts are educational summaries,
              not investment recommendations, and may not reflect actual investment quality. Past performance
              does not guarantee future results.
            </p>

            <p className="text-xs text-stone-500">
              Selecting “I understand, continue” records your acknowledgment of these limitations and educational use.
              Closing this dialog does not record acceptance.
            </p>
          </div>

          <button
            type="button"
            onClick={handleAccept}
            className="mt-6 w-full rounded-lg bg-stone-900 py-3 text-sm font-medium text-white hover:bg-stone-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-stone-900 focus-visible:ring-offset-2"
          >
            I understand, continue
          </button>
          <Close asChild>
            <button
              type="button"
              className="mt-3 w-full rounded-lg py-2 text-sm font-medium text-stone-600 hover:bg-stone-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-stone-900 focus-visible:ring-offset-2"
            >
              Close
            </button>
          </Close>
        </DialogContent>
      </Portal>
    </Dialog>
  );
}
