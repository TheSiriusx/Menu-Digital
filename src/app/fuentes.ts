import { Fraunces, Work_Sans } from "next/font/google";

// Se descargan en el build y se sirven desde el propio dominio (compatible con la CSP, sin Google en cada visita).
// Las usan el layout raíz y la pantalla de error global (que pinta su propio <html>).
const fraunces = Fraunces({ variable: "--font-fraunces", subsets: ["latin"], axes: ["opsz"] });
const workSans = Work_Sans({ variable: "--font-work-sans", subsets: ["latin"] });

export const clasesFuentes = `${fraunces.variable} ${workSans.variable}`;
