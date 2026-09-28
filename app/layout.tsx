import type { Metadata, Viewport } from "next";
import { IBM_Plex_Sans } from "next/font/google";
import "./globals.css";

const plex = IBM_Plex_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  display: "swap",
  variable: "--font-plex",
});

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "https://finalysis.vercel.app";

const description =
  "Read an NSE company from published numbers: price with its timestamp, valuation and returns against sector bands, and recent headlines. Educational research, not financial advice.";

const structuredData = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "WebSite",
      name: "Finalysis",
      url: siteUrl,
      description,
      inLanguage: "en-IN",
    },
    {
      "@type": "FAQPage",
      mainEntity: [
        {
          "@type": "Question",
          name: "What does Finalysis show for an NSE company?",
          acceptedAnswer: {
            "@type": "Answer",
            text: "A share price with the exchange timestamp it was recorded, published valuation and return figures compared against sector bands, and recent headlines. Every figure states where it came from and when it was true.",
          },
        },
        {
          "@type": "Question",
          name: "Does Finalysis give financial advice?",
          acceptedAnswer: {
            "@type": "Answer",
            text: "No. Finalysis is an educational research tool. Its scores are arithmetic on a few published numbers, not recommendations, predictions, or target prices.",
          },
        },
      ],
    },
  ],
};

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: "Finalysis: NSE company figures, with sources and timestamps",
  description,
  icons: {
    icon: [{ url: "/icon.svg", type: "image/svg+xml" }],
    shortcut: "/icon.svg",
  },
  alternates: { canonical: "/" },
  openGraph: {
    title: "Finalysis: NSE company figures, with sources and timestamps",
    description,
    url: "/",
    type: "website",
    locale: "en_IN",
  },
  twitter: {
    card: "summary",
    title: "Finalysis: NSE company figures, with sources and timestamps",
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
    <html lang="en-IN" className={plex.variable}>
      <body className={plex.className}>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }}
        />
        {children}
      </body>
    </html>
  );
}
