import type { Metadata, Viewport } from "next";
import { connection } from "next/server";
import { RegistroPWA } from "@/components/pwa/registro-pwa";
import { COLORES } from "@/lib/colores-marca";
import { DESCRIPCION, MARCA } from "@/lib/marca";
import { urlBaseFija } from "@/lib/sitio";
import { clasesFuentes } from "./fuentes";
import "./globals.css";

// Metadatos de todo el sitio. El título de cada página va como «{título} | Pidelo»; og:url y la base de las URL
// relativas salen de NEXT_PUBLIC_BASE_URL (si no está puesta, se omiten).
const base = urlBaseFija();
export const metadata: Metadata = {
  ...(base && { metadataBase: new URL(base) }),
  title: { default: MARCA, template: `%s | ${MARCA}` },
  description: DESCRIPCION,
  applicationName: MARCA,
  openGraph: { siteName: MARCA, title: MARCA, description: DESCRIPCION, type: "website", locale: "es_VE", ...(base && { url: base }) },
  // App instalada en el iPhone: se abre a pantalla completa, con su nombre y la barra de estado normal.
  appleWebApp: { capable: true, title: MARCA, statusBarStyle: "default" },
};

// viewport-fit=cover: la página llega hasta los bordes del teléfono y body respeta el notch y la barra de inicio
// con los márgenes seguros (globals.css).
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: COLORES.brand,
};

export default async function RootLayout({ children }: LayoutProps<"/">) {
  // Toda ruta se genera en cada petición: la CSP lleva un nonce distinto por visita (src/proxy.ts) y
  // una página fabricada en el build, como el "no encontrado" genérico, no podría llevarlo.
  await connection();
  return (
    <html
      lang="es"
      className={`${clasesFuentes} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        {children}
        <RegistroPWA />
      </body>
    </html>
  );
}
