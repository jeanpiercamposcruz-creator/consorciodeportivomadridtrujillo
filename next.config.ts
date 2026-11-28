import type { NextConfig } from "next";

const SUPABASE = process.env.NEXT_PUBLIC_SUPABASE_URL;

if (!SUPABASE) {
  throw new Error("Falta NEXT_PUBLIC_SUPABASE_URL. Configuración detenida.");
}

// La CSP dinámica con nonce se genera por solicitud en proxy.ts.
const nextConfig: NextConfig = {};

export default nextConfig;
