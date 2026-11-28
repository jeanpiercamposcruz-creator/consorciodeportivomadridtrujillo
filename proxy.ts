import { NextRequest, NextResponse } from "next/server";

const SUPABASE = process.env.NEXT_PUBLIC_SUPABASE_URL;

if (!SUPABASE) {
  throw new Error("Falta NEXT_PUBLIC_SUPABASE_URL. Configuración detenida.");
}

/**
 * CSP estricta por solicitud. Next.js lee el nonce del CSP reenviado en la
 * petición y lo añade a los scripts que genera durante el render dinámico.
 * En desarrollo no se aplica, para no romper HMR/WebSocket.
 */
export function proxy(request: NextRequest) {
  if (process.env.NODE_ENV !== "production") {
    return NextResponse.next();
  }

  const nonce = btoa(crypto.randomUUID());
  const csp = [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'`,
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "font-src 'self' https://fonts.gstatic.com",
    "img-src 'self' data: blob:",
    "media-src 'self' blob: data:",
    `connect-src 'self' ${SUPABASE} https://vitals.vercel-insights.com`,
    "object-src 'none'",
    "base-uri 'none'",
    "form-action 'none'",
    "frame-ancestors 'none'",
    "upgrade-insecure-requests",
  ].join("; ");

  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-nonce", nonce);
  // Next.js debe recibir también la política en la petición para aplicar el nonce
  // a los scripts SSR; establecerla solo en la respuesta no es suficiente.
  requestHeaders.set("Content-Security-Policy", csp);

  const response = NextResponse.next({
    request: { headers: requestHeaders },
  });

  response.headers.set("Content-Security-Policy", csp);
  response.headers.set("X-Frame-Options", "DENY");
  response.headers.set("X-Content-Type-Options", "nosniff");
  response.headers.set("Referrer-Policy", "no-referrer");
  response.headers.set("Permissions-Policy", "camera=(self), microphone=(), geolocation=()");
  response.headers.set("Strict-Transport-Security", "max-age=31536000; includeSubDomains");

  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
