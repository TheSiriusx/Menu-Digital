// Página de prueba de la Fase 0: se consulta Supabase en cada visita.
export const dynamic = "force-dynamic";

async function checkSupabase(): Promise<{ ok: boolean; detalle: string }> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
  try {
    const res = await fetch(`${url}/auth/v1/health`, {
      headers: { apikey: key },
      cache: "no-store",
    });
    return { ok: res.ok, detalle: `HTTP ${res.status}` };
  } catch (e) {
    return { ok: false, detalle: e instanceof Error ? e.message : "error de red" };
  }
}

export default async function Home() {
  const estado = await checkSupabase();

  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-4 px-4 py-16 text-center">
      <h1 className="text-3xl font-semibold tracking-tight">Starck Labs — Menús</h1>
      <p className="text-zinc-600 dark:text-zinc-400">Esqueleto de la plataforma (Fase 0).</p>
      <p
        className={`rounded-full px-4 py-2 text-sm font-medium ${
          estado.ok
            ? "bg-green-100 text-green-800 dark:bg-green-950 dark:text-green-300"
            : "bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300"
        }`}
      >
        Conexión a Supabase: {estado.ok ? "OK" : "ERROR"} ({estado.detalle})
      </p>
    </main>
  );
}
