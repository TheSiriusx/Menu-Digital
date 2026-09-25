import type { MetadataRoute } from "next";

// Los menús se pueden indexar; el panel y el login no. No hay sitemap a propósito: listaría
// públicamente a todos los clientes.
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [{ userAgent: "*", allow: "/", disallow: ["/admin", "/superadmin", "/login"] }],
  };
}
