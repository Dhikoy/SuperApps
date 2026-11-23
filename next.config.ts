import type { NextConfig } from "next";

const skipTypecheck = process.env.SKIP_TYPECHECK === "true";

const noStoreHeaders = [
  { key: "Cache-Control", value: "no-store, no-cache, must-revalidate, private" },
  { key: "Pragma", value: "no-cache" },
  { key: "Expires", value: "0" },
  { key: "Surrogate-Control", value: "no-store" },
];

const securityHeaders = [
  { key: "Strict-Transport-Security", value: "max-age=31536000; includeSubDomains" },
  { key: "X-Frame-Options", value: "SAMEORIGIN" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  // Kamera & lokasi dipakai presensi (selfie + GPS)
  { key: "Permissions-Policy", value: "camera=(self), geolocation=(self), microphone=(), payment=()" },
];

const nextConfig: NextConfig = {
  typescript: {
    ignoreBuildErrors: skipTypecheck,
  },
  poweredByHeader: false,
  serverExternalPackages: ["exceljs"],
  async headers() {
    return [
      {
        source: "/:path*",
        headers: securityHeaders,
      },
      {
        source: "/dashboard/:path*",
        headers: noStoreHeaders,
      },
      {
        source: "/dashboard",
        headers: noStoreHeaders,
      },
      {
        source: "/api/auth/:path*",
        headers: noStoreHeaders,
      },
    ];
  },
};

export default nextConfig;
