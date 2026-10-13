import type { MetadataRoute } from "next";
import { COLORES } from "@/lib/colores-marca";
import { DESCRIPCION, MARCA } from "@/lib/marca";

// Pidelo como app instalable (PWA): los dueños la agregan desde el navegador, sin tiendas. Abre en su panel
// (/admin, que lleva al login si no hay sesión). El navegador pide este archivo SIN cookies: el proxy no lo protege.
// Si cambia un ícono, cambia también el nombre del archivo (-v1 → -v2) para que nadie se quede con el viejo.
export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/admin",
    name: MARCA,
    short_name: MARCA,
    description: DESCRIPCION,
    lang: "es",
    start_url: "/admin",
    scope: "/",
    display: "standalone",
    background_color: COLORES.surface100,
    theme_color: COLORES.brand,
    icons: [
      { src: "/pwa/icono-192-v1.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/pwa/icono-512-v1.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/pwa/icono-maskable-512-v1.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
