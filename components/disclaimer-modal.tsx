"use client";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
  DialogTrigger,
} from "@radix-ui/react-dialog";

/**
 * Sources, methodology, and limits.
 *
 * Rendered on demand from the footer rather than forced on first visit, because
 * a modal that blocks the page is both a worse experience and an easier thing
 * to dismiss without reading. The same content also appears as plain text in
 * the footer, so the disclosure is visible to a reader who never opens it.
 */
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
        className="fixed left-1/2 top-1/2 z-50 max-h-[90vh] w-[calc(100%-2rem)] max-w-lg -translate-x-1/2 -translate-y-1/2 overflow-y-auto border border-stone-300 bg-white p-6 shadow-xl sm:p-8"
      >
        <DialogTitle className="text-lg font-semibold text-stone-900">
          Sources, method, and limits
        </DialogTitle>

        <div className="mt-4 space-y-4 text-sm leading-relaxed text-stone-700">
          <DialogDescription>
            Finalysis is an educational research tool. It is not financial advice, not a
            recommendation to buy or sell, and not a substitute for professional advice.
          </DialogDescription>

          <div className="border-l-2 border-amber-500 bg-amber-50 px-4 py-3 text-amber-900">
            <p className="font-medium">Before you rely on anything here</p>
            <ul className="mt-2 list-disc space-y-1 pl-5 text-amber-900">
              <li>Market data is delayed and may be wrong.</li>
              <li>Company figures come from a public web page and are only as current as that page.</li>
              <li>Scores are arithmetic on a few published numbers, not predictions.</li>
              <li>Verify anything that matters against official filings before acting on it.</li>
            </ul>
          </div>

          <div>
            <h3 className="font-medium text-stone-900">Where the numbers come from</h3>
            <ul className="mt-1.5 space-y-1.5">
              <li>
                <strong className="font-medium">Prices</strong> are read from Yahoo Finance and carry
                the exchange timestamp. When a live price is unavailable, Finalysis says so and shows
                an older close rather than presenting it as current.
              </li>
              <li>
                <strong className="font-medium">Company figures</strong> are read from a public
                Screener.in company page. Any figure the page does not publish is left blank. It is
                never replaced with an estimate or a zero.
              </li>
              <li>
                <strong className="font-medium">Headlines</strong> come from Google News RSS. They
                are written by newsrooms, not by Finalysis.
              </li>
              <li>
                <strong className="font-medium">The stock list</strong> is a checked-in dataset of
                NSE tickers. Coverage is limited to what that list contains and to what the
                providers publish for a given company.
              </li>
            </ul>
          </div>

          <div>
            <h3 className="font-medium text-stone-900">How the scores work</h3>
            <p className="mt-1.5">
              Business quality and valuation are each built by starting from a neutral 50 and
              adjusting it for published figures: return on equity, return on capital employed,
              dividend yield, P/E, and P/B. Each is compared against ranges for the company&apos;s
              sector.
            </p>
            <p className="mt-1.5">
              A figure that was not published contributes nothing and is named as missing. If no
              figure a score needs was published, Finalysis shows no score at all rather than a
              neutral one.
            </p>
          </div>

          <div>
            <h3 className="font-medium text-stone-900">What the scores do not do</h3>
            <p className="mt-1.5">
              They do not measure management quality, competitive advantage, accounting quality,
              growth, or future returns. They are not probabilities, expected returns, or targets,
              and they are not a judgement about whether a company is a good investment.
            </p>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
