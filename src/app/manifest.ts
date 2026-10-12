import type { MetadataRoute } from "next";
import { COLORES } from "@/lib/colores-marca";
import { DESCRIPCION, MARCA } from "@/lib/marca";

// Nombre e íconos cuando alguien agrega Pidelo a la pantalla de inicio del celular.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: MARCA,
    short_name: MARCA,
    description: DESCRIPCION,
    lang: "es",
    start_url: "/",
    display: "standalone",
    background_color: COLORES.surface100,
    theme_color: COLORES.brand,
    icons: [
      { src: "/icon.svg", sizes: "any", type: "image/svg+xml" },
      { src: "/icono-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icono-512.png", sizes: "512x512", type: "image/png" },
    ],
  };
}
