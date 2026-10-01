import type { Metadata } from "next";
import { connection } from "next/server";
import { DESCRIPCION, MARCA } from "@/lib/marca";
import { urlBaseFija } from "@/lib/sitio";
import { clasesFuentes } from "./fuentes";
import "./globals.css";

// Metadatos de todo el sitio. El título de cada página va como «{título} | Pídelo»; og:url y la base de las URL
// relativas salen de NEXT_PUBLIC_BASE_URL (si no está puesta, se omiten).
const base = urlBaseFija();
export const metadata: Metadata = {
  ...(base && { metadataBase: new URL(base) }),
  title: { default: MARCA, template: `%s | ${MARCA}` },
  description: DESCRIPCION,
  applicationName: MARCA,
  openGraph: { siteName: MARCA, title: MARCA, description: DESCRIPCION, type: "website", locale: "es_VE", ...(base && { url: base }) },
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
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
