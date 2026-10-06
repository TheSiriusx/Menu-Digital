import type { Metadata } from "next";
import { MarcoSuperadmin } from "@/components/superadmin/marco";
import { obtenerSesion } from "@/lib/admin";

export const metadata: Metadata = { title: "Super admin", robots: { index: false, follow: false } };

// Solo el marco. Cada página y cada acción comprueban el rol por su cuenta.
export default async function SuperadminLayout({ children }: { children: React.ReactNode }) {
  const { supabase, rol } = await obtenerSesion();
  if (rol !== "superadmin") return <div className="flex flex-1 flex-col bg-panel px-4">{children}</div>;

  const { count } = await supabase.from("negocios").select("id", { count: "exact", head: true });
  return <MarcoSuperadmin locales={count ?? 0}>{children}</MarcoSuperadmin>;
}
