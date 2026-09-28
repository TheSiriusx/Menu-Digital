import type { Metadata } from "next";
import { connection } from "next/server";
import { Fraunces, Work_Sans } from "next/font/google";
import "./globals.css";

// Se descargan en el build y se sirven desde el propio dominio (compatible con la CSP, sin Google en cada visita).
const fraunces = Fraunces({ variable: "--font-fraunces", subsets: ["latin"], axes: ["opsz"] });
const workSans = Work_Sans({ variable: "--font-work-sans", subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Starck Labs — Menús",
  description: "Menús digitales con pedido por WhatsApp",
};

export default async function RootLayout({ children }: LayoutProps<"/">) {
  // Toda ruta se genera en cada petición: la CSP lleva un nonce distinto por visita (src/proxy.ts) y
  // una página fabricada en el build, como el "no encontrado" genérico, no podría llevarlo.
  await connection();
  return (
    <html
      lang="es"
      className={`${fraunces.variable} ${workSans.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
