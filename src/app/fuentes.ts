import { Fredoka, Nunito } from "next/font/google";

// Fuentes de Pidelo: Fredoka 600 para titulares y el nombre de la marca, Nunito 400/700 para el texto corrido.
// Se descargan en el build y se sirven desde el propio dominio (compatible con la CSP, sin Google en cada visita).
// Las usan el layout raíz y la pantalla de error global (que pinta su propio <html>). El menú público de cada local
// conserva las suyas (src/app/[slug]/fuentes.ts).
const fredoka = Fredoka({ variable: "--font-fredoka", subsets: ["latin"], weight: ["600"] });
const nunito = Nunito({ variable: "--font-nunito", subsets: ["latin"], weight: ["400", "700"] });

export const clasesFuentes = `${fredoka.variable} ${nunito.variable}`;
