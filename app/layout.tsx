import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Finalysis 3.0 - Stock Analysis for Indian Equities",
  description: "Zero-budget stock analysis app for Indian equities with NSE integration, cached fundamentals, and RSS-based news sentiment analysis",
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
