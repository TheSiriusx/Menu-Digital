import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { OPCIONES_COOKIE, SUPABASE_ANON_KEY, SUPABASE_URL } from "@/lib/supabase/env";

// Puerta rápida: refresca la sesión y manda a /login a quien entre a /admin sin sesión.
// NO es la seguridad real: cada página y cada acción vuelven a comprobar la sesión, y la
// base de datos aplica RLS igualmente.
export async function proxy(request: NextRequest) {
  let respuesta = NextResponse.next({ request });

  const supabase = createServerClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    cookieOptions: OPCIONES_COOKIE,
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll: (lista) => {
        lista.forEach(({ name, value }) => request.cookies.set(name, value));
        respuesta = NextResponse.next({ request });
        lista.forEach(({ name, value, options }) => respuesta.cookies.set(name, value, options));
      },
    },
  });

  // getUser valida el token contra Supabase (no confía en la cookie tal cual).
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { pathname } = request.nextUrl;
  if (!user && pathname.startsWith("/admin")) {
    return NextResponse.redirect(new URL("/login", request.url));
  }
  if (user && pathname === "/login") {
    return NextResponse.redirect(new URL("/admin", request.url));
  }

  return respuesta;
}

export const config = {
  matcher: ["/admin/:path*", "/login"],
};
