import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "ERP Consorcio Deportivo Madrid Trujillo",
  description: "Sistema de gestión del Consorcio Deportivo Madrid Trujillo",
  // Sistema administrativo privado: que los buscadores no lo indexen.
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover", // el CSS usa env(safe-area-inset-*)
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        {/* Tipografías del diseño original (Barlow, Barlow Semi Condensed y Anton) */}
        {/* eslint-disable-next-line @next/next/no-page-custom-font */}
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Barlow:wght@400;500;600&family=Barlow+Semi+Condensed:wght@600;700&family=Anton&display=swap"
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
