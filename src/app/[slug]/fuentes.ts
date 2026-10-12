import { Fraunces, Work_Sans } from "next/font/google";

// Fuentes del menú público de cada local: su carta conserva el estilo propio (Fraunces para títulos, Work Sans para
// el texto); Pidelo no se impone sobre la marca del negocio. Solo se cargan en las páginas del menú.
const fraunces = Fraunces({ variable: "--font-fraunces", subsets: ["latin"], axes: ["opsz"] });
const workSans = Work_Sans({ variable: "--font-work-sans", subsets: ["latin"] });

export const fuentesMenu = `${fraunces.variable} ${workSans.variable}`;
