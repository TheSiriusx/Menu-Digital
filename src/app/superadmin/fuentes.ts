import { Inter, Plus_Jakarta_Sans } from "next/font/google";

// Fuentes del super admin («Warm Culinary Modernism»): Plus Jakarta Sans para títulos y etiquetas, Inter para
// el texto y las cifras. Se sirven desde el propio dominio, como las del resto del sitio.
const jakarta = Plus_Jakarta_Sans({ variable: "--font-jakarta", subsets: ["latin"], weight: ["500", "600", "700"] });
const inter = Inter({ variable: "--font-inter", subsets: ["latin"] });

export const fuentesSuperadmin = `${jakarta.variable} ${inter.variable}`;
