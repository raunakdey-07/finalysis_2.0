import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import "./globals.css";

/**
 * The typeface is committed to the repository and loaded from disk.
 *
 * `next/font/google` downloads the files during the build, which made a
 * production deploy depend on reaching Google. These are the same two subset
 * files that build produced, and the same ranges, so nothing about the
 * rendering changes.
 *
 * IBM Plex Sans ships as a variable font covering weights 100-700, so one file
 * serves every weight the design uses. Latin and Latin Extended are declared
 * separately because `next/font/local` has no `unicodeRange` option and two
 * faces without ranges would collide on every glyph. The rupee sign lives in
 * Latin Extended, so the split is load-bearing rather than tidy.
 */
const plex = localFont({
  src: [{ path: "./fonts/plex-sans-variable-latin.woff2", weight: "100 700", style: "normal" }],
  display: "swap",
  variable: "--font-plex",
  declarations: [
    {
      prop: "unicode-range",
      value:
        "U+0000-00FF,U+0131,U+0152-0153,U+02BB-02BC,U+02C6,U+02DA,U+02DC,U+0304,U+0308,U+0329,U+2000-206F,U+20AC,U+2122,U+2191,U+2193,U+2212,U+2215,U+FEFF,U+FFFD",
    },
  ],
});

const plexExt = localFont({
  src: [
    { path: "./fonts/plex-sans-variable-latin-ext.woff2", weight: "100 700", style: "normal" },
  ],
  display: "swap",
  variable: "--font-plex-ext",
  declarations: [
    {
      prop: "unicode-range",
      value:
        "U+0100-02BA,U+02BD-02C5,U+02C7-02CC,U+02CE-02D7,U+02DD-02FF,U+0304,U+0308,U+0329,U+1D00-1DBF,U+1E00-1E9F,U+1EF2-1EFF,U+2020,U+20A0-20AB,U+20AD-20C0,U+2113,U+2C60-2C7F,U+A720-A7FF",
    },
  ],
});

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "https://fin-alysis.vercel.app";

const description =
  "Read an NSE company from published numbers: price with its timestamp, valuation and returns against sector bands, and recent headlines. Educational research, not financial advice.";

const structuredData = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "WebSite",
      name: "Fin-alysis",
      url: siteUrl,
      description,
      inLanguage: "en-IN",
    },
    {
      "@type": "FAQPage",
      mainEntity: [
        {
          "@type": "Question",
          name: "What does Fin-alysis show for an NSE company?",
          acceptedAnswer: {
            "@type": "Answer",
            text: "A share price with the exchange timestamp it was recorded, published valuation and return figures compared against sector bands, and recent headlines. Every figure states where it came from and when it was true.",
          },
        },
        {
          "@type": "Question",
          name: "Does Fin-alysis give financial advice?",
          acceptedAnswer: {
            "@type": "Answer",
            text: "No. Fin-alysis is an educational research tool. Its scores are arithmetic on a few published numbers, not recommendations, predictions, or target prices.",
          },
        },
      ],
    },
  ],
};

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: "Fin-alysis: NSE Research Tool",
  description,
  icons: {
    icon: [{ url: "/icon.svg", type: "image/svg+xml" }],
    shortcut: "/icon.svg",
  },
  alternates: { canonical: "/" },
  openGraph: {
    title: "Fin-alysis: NSE Research Tool",
    description,
    url: "/",
    type: "website",
    locale: "en_IN",
  },
  twitter: {
    card: "summary",
    title: "Fin-alysis: NSE Research Tool",
    description,
  },
  robots: { index: true, follow: true },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#fafaf9",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en-IN" className={`${plex.variable} ${plexExt.variable}`}>
      {/*
        No font class on the body. `plex.className` would set
        `font-family: plex, "plex Fallback"` and win on specificity, which
        hides the Latin Extended face, so the rupee sign would fall through to
        a system font. The body rule in globals.css lists both faces.
      */}
      <body>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }}
        />
        {children}
      </body>
    </html>
  );
}
