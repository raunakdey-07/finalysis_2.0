import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Finalysis - Simple Stock Research for India",
  description: "Understand any NSE stock in 30 seconds. We answer three questions: Is it a good business? Is it improving? Is the price fair?",
  keywords: ["stock research", "NSE", "Indian stocks", "fundamental analysis", "value investing", "stock analysis"],
  authors: [{ name: "Finalysis" }],
  openGraph: {
    title: "Finalysis - Simple Stock Research for India",
    description: "Understand any NSE stock in 30 seconds. Free, educational stock research tool.",
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
        {children}
      </body>
    </html>
  );
}
