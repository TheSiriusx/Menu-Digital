"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Icono, type NombreIcono } from "@/components/iconos";

type Enlace = { href: string; texto: string; icono: NombreIcono; activoEn: (ruta: string) => boolean; contador?: number };

function enlaces(locales: number): Enlace[] {
  return [
    { href: "/superadmin", texto: "Locales", icono: "tienda", contador: locales, activoEn: (r) => r === "/superadmin" || r.startsWith("/superadmin/locales") },
    { href: "/superadmin/analiticas", texto: "Analíticas", icono: "grafica", activoEn: (r) => r.startsWith("/superadmin/analiticas") },
    { href: "/superadmin/cuenta", texto: "Mi cuenta", icono: "cuenta", activoEn: (r) => r.startsWith("/superadmin/cuenta") },
    { href: "/superadmin/mfa", texto: "Seguridad", icono: "escudo", activoEn: (r) => r.startsWith("/superadmin/mfa") },
  ];
}

// Barra lateral (computadora): ítem activo con fondo terracota suave y una barrita a la izquierda.
export function NavLateral({ locales }: { locales: number }) {
  const ruta = usePathname();
  return (
    <nav aria-label="Super admin" className="flex flex-col gap-1">
      {enlaces(locales).map((e) => {
        const activo = e.activoEn(ruta);
        return (
          <Link
            key={e.href}
            href={e.href}
            aria-current={activo ? "page" : undefined}
            className={`relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-[13.5px] font-medium transition-colors ${
              activo ? "bg-(--acento-suave) font-semibold text-(--acento-texto)" : "text-muted hover:bg-surface hover:text-foreground"
            }`}
          >
            {activo && <span aria-hidden="true" className="absolute top-2 bottom-2 left-0 w-[3px] rounded-full bg-(--acento)" />}
            <Icono nombre={e.icono} />
            <span className="flex-1">{e.texto}</span>
            {e.contador !== undefined && e.contador > 0 && (
              <span className="rounded-full bg-(--acento) px-2 py-0.5 text-[11px] font-semibold text-(--sobre-acento)">{e.contador}</span>
            )}
          </Link>
        );
      })}
    </nav>
  );
}

// Pestañas fijas abajo (celular), como en el diseño móvil.
export function NavInferior({ locales }: { locales: number }) {
  const ruta = usePathname();
  return (
    <nav
      aria-label="Super admin (celular)"
      className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-background/95 pb-[env(safe-area-inset-bottom)] shadow-[0_-2px_12px_rgb(78_48_32/0.06)] backdrop-blur-xl lg:hidden print:hidden"
    >
      <div className="mx-auto flex h-16 max-w-xl items-center justify-around px-2">
        {enlaces(locales).map((e) => {
          const activo = e.activoEn(ruta);
          return (
            <Link
              key={e.href}
              href={e.href}
              aria-current={activo ? "page" : undefined}
              className={`flex min-h-11 min-w-16 flex-col items-center justify-center gap-0.5 text-[11px] ${activo ? "font-semibold text-(--acento-texto)" : "text-muted"}`}
            >
              <Icono nombre={e.icono} tamano={22} />
              {e.texto}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}

const PESTANAS_LOCAL: Record<string, string> = { "": "Dashboard", menu: "Editar menú", pedidos: "Pedidos", clientes: "Clientes", configuracion: "Configuración" };

// Migas de pan de la barra superior, sacadas de la ruta.
export function Migas() {
  const ruta = usePathname();
  const partes = ruta.replace(/^\/superadmin\/?/, "").split("/").filter(Boolean);
  const migas: { texto: string; href?: string }[] = [{ texto: "Super admin", href: "/superadmin" }];
  if (partes[0] === "locales" && partes[1]) {
    migas.push({ texto: "Locales", href: "/superadmin" }, { texto: `/${partes[1]}`, href: `/superadmin/locales/${partes[1]}` });
    migas.push({ texto: PESTANAS_LOCAL[partes[2] ?? ""] ?? partes[2] });
  } else {
    migas.push({ texto: { analiticas: "Analíticas", cuenta: "Mi cuenta", mfa: "Seguridad" }[partes[0] ?? ""] ?? "Locales" });
  }
  return (
    <nav aria-label="Ubicación" className="flex min-w-0 items-center gap-2 text-[13px]">
      {migas.map((m, i) => {
        const ultima = i === migas.length - 1;
        return (
          <span key={i} className="flex min-w-0 items-center gap-2">
            {i > 0 && <Icono nombre="chevron" tamano={14} className="text-muted" />}
            {m.href && !ultima ? (
              <Link href={m.href} className="truncate text-muted hover:text-foreground">{m.texto}</Link>
            ) : (
              <span aria-current={ultima ? "page" : undefined} className={`truncate ${ultima ? "font-medium text-foreground" : "text-muted"}`}>{m.texto}</span>
            )}
          </span>
        );
      })}
    </nav>
  );
}
