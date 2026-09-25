import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // No anunciar la tecnología en cada respuesta.
  poweredByHeader: false,

  // Rutas del panel anterior (marcadores y QR ya compartidos): llevan a su pestaña nueva.
  async redirects() {
    return [
      { source: "/admin/categorias", destination: "/admin/menu", permanent: false },
      { source: "/admin/ajustes", destination: "/admin/configuracion", permanent: false },
      { source: "/admin/qr", destination: "/admin/configuracion", permanent: false },
      { source: "/superadmin/locales/:slug/categorias", destination: "/superadmin/locales/:slug/menu", permanent: false },
      { source: "/superadmin/locales/:slug/ajustes", destination: "/superadmin/locales/:slug/configuracion", permanent: false },
      { source: "/superadmin/locales/:slug/qr", destination: "/superadmin/locales/:slug/configuracion", permanent: false },
    ];
  },

  // Cabeceras de seguridad estáticas. La CSP (que lleva un nonce distinto por petición) la pone
  // src/proxy.ts. HSTS lo añade Vercel.
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=(), usb=()" },
          // Igual que frame-ancestors 'none' de la CSP, para navegadores que no la entienden.
          { key: "X-Frame-Options", value: "DENY" },
        ],
      },
    ];
  },
};

export default nextConfig;
