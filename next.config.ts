import type { NextConfig } from "next";

/**
 * Security headers.
 *
 * The site renders provider text and links to third-party pages, so it declares
 * a restrictive policy rather than relying on defaults.
 *
 * `script-src` allows 'unsafe-inline' because Next.js injects its own inline
 * bootstrap and flight payload into the document. Removing it needs a
 * per-request nonce via middleware, which is a larger change than this policy
 * is currently worth. Every other directive is restrictive: no framing, no
 * plugins, no cross-origin connections, and a self-only form target.
 */
const contentSecurityPolicy = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: https:",
  "font-src 'self' data:",
  "connect-src 'self'",
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "object-src 'none'",
].join("; ");

const securityHeaders = [
  { key: "Content-Security-Policy", value: contentSecurityPolicy },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), interest-cohort=()" },
];

const nextConfig: NextConfig = {
  poweredByHeader: false,
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

export default nextConfig;
