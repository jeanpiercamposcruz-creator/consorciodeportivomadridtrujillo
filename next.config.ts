import type { NextConfig } from "next";

const SUPABASE = "https://wuoqjcqniacsassxhrvs.supabase.co";

/**
 * Cabeceras de seguridad (equivalen al archivo `_headers` y a la CSP del ERP original).
 * Vercel NO lee `_headers` (es de Netlify/Cloudflare), por eso se declaran aquí.
 * Solo en producción: `next dev` necesita eval y websockets que esta política bloquearía.
 */
const csp = [
  "default-src 'self'",
  // Next.js inserta scripts en línea para hidratar; sin un proxy con nonces hace falta 'unsafe-inline'.
  "script-src 'self' 'unsafe-inline' https://cdnjs.cloudflare.com",
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  "font-src 'self' https://fonts.gstatic.com",
  "img-src 'self' data: blob:",
  "media-src 'self' blob: data:",
  `connect-src 'self' ${SUPABASE}`,
  "object-src 'none'",
  "base-uri 'none'",
  "form-action 'none'",
  "frame-ancestors 'none'",
].join("; ");

const nextConfig: NextConfig = {
  async headers() {
    if (process.env.NODE_ENV !== "production") return [];
    return [
      {
        source: "/:path*",
        headers: [
          { key: "Content-Security-Policy", value: csp },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "no-referrer" },
          // camera=(self): necesaria para escanear el QR de asistencia
          { key: "Permissions-Policy", value: "camera=(self), microphone=(), geolocation=()" },
          { key: "Strict-Transport-Security", value: "max-age=31536000; includeSubDomains" },
        ],
      },
    ];
  },
};

export default nextConfig;
