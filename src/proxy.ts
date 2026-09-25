import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { OPCIONES_COOKIE, SUPABASE_ANON_KEY, SUPABASE_URL } from "@/lib/supabase/env";

// Política de seguridad de contenido (CSP), con un nonce nuevo en cada petición. El navegador solo
// ejecuta los scripts que lleven ese nonce, así que un script inyectado (XSS) no corre ni puede
// enviar datos fuera. Además impide que otra web embeba la nuestra (frame-ancestors).
function politicaCSP(nonce: string): string {
  const desarrollo = process.env.NODE_ENV === "development";
  const enVercel = process.env.VERCEL === "1"; // https garantizado; en local (http) no se fuerza
  const storage = new URL(SUPABASE_URL).origin; // las fotos y logos viven en nuestro Storage

  return [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${desarrollo ? " 'unsafe-eval'" : ""}`,
    `style-src 'self' 'nonce-${nonce}'`,
    // Atributos style="--acento: …" (color del local). Un atributo de estilo no puede ejecutar código.
    "style-src-attr 'unsafe-inline'",
    `img-src 'self' data: blob: ${storage}`,
    "font-src 'self'",
    "connect-src 'self'",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
    ...(enVercel ? ["upgrade-insecure-requests"] : []),
  ].join("; ");
}

// 1) Pone la CSP con nonce en toda página. 2) Puerta rápida de login: refresca la sesión y manda a
// /login a quien entre a /admin o /superadmin sin sesión. NO es la seguridad real: cada página y cada
// acción vuelven a comprobar la sesión, y la base de datos aplica RLS igualmente.
export async function proxy(request: NextRequest) {
  const nonce = btoa(crypto.randomUUID());
  const csp = politicaCSP(nonce);

  // Next lee el nonce de la CSP de la petición para marcar sus propios scripts.
  const nueva = () => {
    const cabeceras = new Headers(request.headers);
    cabeceras.set("x-nonce", nonce);
    cabeceras.set("Content-Security-Policy", csp);
    const r = NextResponse.next({ request: { headers: cabeceras } });
    r.headers.set("Content-Security-Policy", csp);
    return r;
  };
  let respuesta = nueva();

  const { pathname } = request.nextUrl;
  const esPanel = pathname.startsWith("/admin") || pathname.startsWith("/superadmin");
  const esLogin = pathname === "/login" || pathname.startsWith("/login/");
  if (!esPanel && !esLogin) return respuesta; // el menú público no consulta a Supabase aquí

  const supabase = createServerClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    cookieOptions: OPCIONES_COOKIE,
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll: (lista) => {
        lista.forEach(({ name, value }) => request.cookies.set(name, value));
        respuesta = nueva();
        lista.forEach(({ name, value, options }) => respuesta.cookies.set(name, value, options));
      },
    },
  });

  // getUser valida el token contra Supabase (no confía en la cookie tal cual).
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const redirigir = (ruta: string) => {
    const r = NextResponse.redirect(new URL(ruta, request.url));
    respuesta.cookies.getAll().forEach((c) => r.cookies.set(c)); // conserva la sesión refrescada
    return r;
  };

  if (!user && esPanel) return redirigir("/login");
  if (user && pathname === "/login") return redirigir("/admin");

  return respuesta;
}

export const config = {
  // Todas las páginas, menos archivos estáticos y las precargas de navegación de Next.
  matcher: [
    {
      source: "/((?!_next/static|_next/image|favicon.ico|robots.txt|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
      missing: [
        { type: "header", key: "next-router-prefetch" },
        { type: "header", key: "purpose", value: "prefetch" },
      ],
    },
  ],
};
