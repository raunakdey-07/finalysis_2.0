"use client";

import { useEffect, useSyncExternalStore } from "react";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogTitle,
  DialogTrigger,
} from "@radix-ui/react-dialog";
import {
  acceptDisclaimer,
  hasAcceptedDisclaimer,
  subscribeToDisclaimer,
} from "@/lib/utils/disclaimer-storage";

/**
 * The disclosure, in one place.
 *
 * It has two jobs and therefore two renderings. The gate shows the short form
 * a reader has to accept before entering. The footer shows the full reference
 * for anyone who wants the sources and the method. They are the same
 * disclosure, not two competing ones, so the wording lives here once.
 */

function Summary() {
  return (
    <ul className="list-disc space-y-1.5 pl-5 text-stone-700">
      <li>This is an educational research tool, not financial advice.</li>
      <li>Prices are delayed and company figures are only as current as the page they came from.</li>
      <li>Scores are arithmetic on a few published numbers. They are not predictions or targets.</li>
      <li>Verify anything that matters against official filings before acting on it.</li>
    </ul>
  );
}

function Sources() {
  return (
    <ul className="space-y-1.5">
      <li>
        <strong className="font-medium text-stone-900">Prices</strong> are read from Yahoo Finance
        and carry the exchange timestamp. When a live price is unavailable, Finalysis says so and
        shows an older close rather than presenting it as current.
      </li>
      <li>
        <strong className="font-medium text-stone-900">Company figures</strong> are read from a
        public Screener.in company page. Any figure the page does not publish is left blank. It is
        never replaced with an estimate or a zero.
      </li>
      <li>
        <strong className="font-medium text-stone-900">Headlines</strong> come from Google News RSS.
        They are written by newsrooms, not by Finalysis.
      </li>
      <li>
        <strong className="font-medium text-stone-900">The stock list</strong> is a checked-in
        dataset of NSE tickers. Coverage is limited to that list and to what each provider publishes
        for a given company.
      </li>
    </ul>
  );
}

function Method() {
  return (
    <>
      <p>
        Business quality and valuation each start from a neutral 50 and adjust it for published
        figures: return on equity, return on capital employed, dividend yield, P/E, and P/B. Each is
        compared against ranges for the company&apos;s sector.
      </p>
      <p className="mt-1.5">
        A figure that was not published contributes nothing and is named as missing. If no figure a
        score needs was published, Finalysis shows no score at all rather than a neutral one.
      </p>
    </>
  );
}

function Limits() {
  return (
    <p>
      The scores do not measure management quality, competitive advantage, accounting quality,
      growth, or future returns. They are not probabilities, expected returns, or targets, and they
      are not a judgement about whether a company is a good investment.
    </p>
  );
}

const PANEL = "max-h-[85vh] w-[calc(100%-2rem)] max-w-lg overflow-y-auto border border-stone-300 bg-white p-6 shadow-xl sm:p-8";

/**
 * The first-visit gate.
 *
 * Nothing dismisses it. There is no close button, Escape and an outside click
 * are both refused, and focus is held inside the dialog until the reader
 * accepts. A gate that can be dismissed without a decision is not a gate.
 */
export function DisclaimerGate() {
  const accepted = useSyncExternalStore(
    subscribeToDisclaimer,
    hasAcceptedDisclaimer,
    // Assume accepted during server render so the markup matches on hydration;
    // the real answer arrives on the client immediately afterwards.
    () => true
  );

  /**
   * A gate is only a gate if the page behind it cannot be scrolled away from.
   * Radix blocks pointer events, but a wheel or a drag still moves the content
   * underneath, which reads as the page having loaded behind a dialog the
   * reader cannot dismiss.
   */
  useEffect(() => {
    if (accepted || typeof document === "undefined") return;

    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, [accepted]);

  return (
    <Dialog
      open={!accepted}
      // Fully controlled by `accepted`. Nothing that the dialog can do on its
      // own closes it, because a gate that a stray keypress can dismiss is not
      // a gate; only the button below records a decision.
      onOpenChange={() => undefined}
    >
      <DialogContent
        aria-modal="true"
        onEscapeKeyDown={(event) => event.preventDefault()}
        onPointerDownOutside={(event) => event.preventDefault()}
        onInteractOutside={(event) => event.preventDefault()}
        className={`fixed left-1/2 top-1/2 z-50 -translate-x-1/2 -translate-y-1/2 ${PANEL}`}
      >
        <DialogTitle className="text-lg font-semibold text-stone-900">
          Before you read anything here
        </DialogTitle>

        <div className="mt-4 space-y-4 text-sm leading-relaxed text-stone-700">
          <DialogDescription>
            Finalysis is an educational research tool for Indian equities. It exists to make
            published company figures easier to read, not to tell you what to buy.
          </DialogDescription>
          <Summary />
          <p className="text-xs text-stone-600">
            The full sources and method are linked in the footer, and you can reopen them at any
            time.
          </p>
        </div>

        <button
          type="button"
          onClick={() => acceptDisclaimer()}
          className="mt-6 w-full rounded-lg bg-stone-900 py-3 text-sm font-medium text-white transition hover:bg-stone-800 focus-visible:ring-2 focus-visible:ring-stone-900 focus-visible:ring-offset-2"
        >
          I understand, continue
        </button>
      </DialogContent>
    </Dialog>
  );
}

/** The full reference, available on demand from the footer. */
export function MethodologyDialog() {
  return (
    <Dialog>
      <DialogTrigger asChild>
        <button
          type="button"
          className="rounded text-xs font-medium text-stone-700 underline underline-offset-4 transition hover:text-stone-900 focus-visible:ring-2 focus-visible:ring-stone-700 focus-visible:ring-offset-2"
        >
          Sources, method, and limits
        </button>
      </DialogTrigger>

      <DialogContent
        aria-modal="true"
        className={`fixed left-1/2 top-1/2 z-50 -translate-x-1/2 -translate-y-1/2 ${PANEL}`}
      >
        <DialogTitle className="text-lg font-semibold text-stone-900">
          Sources, method, and limits
        </DialogTitle>

        <div className="mt-4 space-y-5 text-sm leading-relaxed text-stone-700">
          <DialogDescription>
            Finalysis is an educational research tool. It is not financial advice, not a
            recommendation to buy or sell, and not a substitute for professional advice.
          </DialogDescription>

          <div>
            <h3 className="mb-1.5 font-medium text-stone-900">Where the numbers come from</h3>
            <Sources />
          </div>

          <div>
            <h3 className="mb-1.5 font-medium text-stone-900">How the scores work</h3>
            <Method />
          </div>

          <div>
            <h3 className="mb-1.5 font-medium text-stone-900">What the scores do not do</h3>
            <Limits />
          </div>
        </div>

        <DialogClose asChild>
          <button
            type="button"
            className="mt-6 w-full rounded-lg border border-stone-300 py-2.5 text-sm font-medium text-stone-700 transition hover:border-stone-500 hover:text-stone-900 focus-visible:ring-2 focus-visible:ring-stone-700 focus-visible:ring-offset-2"
          >
            Close
          </button>
        </DialogClose>
      </DialogContent>
    </Dialog>
  );
}
