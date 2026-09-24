// Solo la clave pública: la seguridad la da RLS en la base de datos. Nunca la service_role.
export const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
export const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

// La app no tiene cliente de Supabase en el navegador (todo va por Server Actions), así que
// la sesión se guarda en cookies que JavaScript no puede leer. @supabase/ssr las deja
// legibles por defecto porque asume que sí hay uno.
export const OPCIONES_COOKIE = {
  httpOnly: true,
  sameSite: "lax",
  secure: process.env.NODE_ENV === "production",
  path: "/",
} as const;
