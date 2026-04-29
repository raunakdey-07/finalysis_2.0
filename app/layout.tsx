import type { Metadata, Viewport } from "next";
import "./globals.css";

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "https://finalysis.vercel.app";

const structuredData = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "WebSite",
      name: "Finalysis",
      url: siteUrl,
      description:
        "Simple stock research for India. Understand any NSE stock through business quality, momentum, and valuation context.",
      inLanguage: "en-IN",
      potentialAction: {
        "@type": "SearchAction",
        target: `${siteUrl}/?symbol={search_term_string}`,
        "query-input": "required name=search_term_string",
      },
    },
    {
      "@type": "FAQPage",
      mainEntity: [
        {
          "@type": "Question",
          name: "What does Finalysis evaluate for NSE stocks?",
          acceptedAnswer: {
            "@type": "Answer",
            text: "Finalysis evaluates business quality, momentum, and valuation with explainable signals and investor-friendly red-flag context.",
          },
        },
        {
          "@type": "Question",
          name: "Is Finalysis financial advice?",
          acceptedAnswer: {
            "@type": "Answer",
            text: "No. Finalysis is an educational stock research and screening tool. Always do your own research before investing.",
          },
        },
      ],
    },
  ],
};

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: "Finalysis - Simple Stock Research for India",
  description: "Understand any NSE stock in 30 seconds. We answer three questions: Is it a good business? Is it improving? Is the price fair?",
  icons: {
    icon: [{ url: "/icon.svg", type: "image/svg+xml" }],
    shortcut: "/icon.svg",
  },
  alternates: {
    canonical: "/",
  },
  keywords: ["stock research", "NSE", "Indian stocks", "fundamental analysis", "value investing", "stock analysis"],
  authors: [{ name: "Finalysis" }],
  openGraph: {
    title: "Finalysis - Simple Stock Research for India",
    description: "Understand any NSE stock in 30 seconds. Free, educational stock research tool.",
    url: "/",
    type: "website",
    locale: "en_IN",
  },
  twitter: {
    card: "summary",
    title: "Finalysis - Simple Stock Research for India",
    description: "Understand any NSE stock in 30 seconds. Free, educational stock research tool.",
  },
  robots: {
    index: true,
    follow: true,
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#1c1917",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased">
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }}
        />
        {children}
      </body>
    </html>
  );
}
