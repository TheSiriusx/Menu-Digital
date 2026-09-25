import type { Metadata } from "next";
import { connection } from "next/server";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

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
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
