"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { Cantidad, Miniatura, ProductoCard } from "@/components/producto-card";
import {
  cantidadTotal,
  construirMensaje,
  lineasDelCarrito,
  normalizarTelefono,
  totalUsd,
  urlWhatsApp,
  type DatosPedido,
} from "@/lib/pedido";
import { formatBs, formatUsd, usdToBs } from "@/lib/precios";
import { useCarrito } from "@/lib/use-carrito";
import type { CategoriaConProductos, Producto } from "@/types/menu";

type Props = {
  negocio: { slug: string; nombre: string; telefono_whatsapp: string | null; tasa_bs: number };
  categorias: CategoriaConProductos[];
  sinCategoria: Producto[];
  soloRetiro?: boolean;
};

const campo =
  "mt-1.5 w-full rounded-[10px] border border-line bg-background px-3.5 py-2.5 text-base font-normal outline-offset-0 focus-visible:border-(--acento) focus-visible:outline-2";

export function MenuPedido({ negocio, categorias, sinCategoria, soloRetiro = false }: Props) {
  const { carrito, cambiar, vaciar } = useCarrito(negocio.slug);
  const dialogo = useRef<HTMLDialogElement>(null);
  const [datos, setDatos] = useState<DatosPedido>({
    nombre: "",
    entrega: "retiro",
    direccion: "",
    notas: "",
  });

  const categoriasConProductos = categorias.filter((c) => c.productos.length > 0);
  const todos = [...categoriasConProductos.flatMap((c) => c.productos), ...sinCategoria];
  const lineas = lineasDelCarrito(carrito, todos);
  const total = totalUsd(lineas);
  const tasa = negocio.tasa_bs;
  const puedePedir = normalizarTelefono(negocio.telefono_whatsapp) !== null;

  // Si se quita el último producto con el pedido abierto, se cierra solo.
  useEffect(() => {
    if (lineas.length === 0) dialogo.current?.close();
  }, [lineas.length]);

  // El foco va al propio diálogo (no al primer botón), para que "Cerrar" no aparezca con aro.
  function abrirPedido() {
    dialogo.current?.showModal();
    dialogo.current?.focus();
  }

  function enviar(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const url = urlWhatsApp(negocio.telefono_whatsapp, construirMensaje(negocio, lineas, datos));
    if (!url) return;

    const ventana = window.open(url, "_blank");
    if (ventana) ventana.opener = null;
    else window.location.href = url; // el navegador bloqueó la ventana nueva

    vaciar();
    dialogo.current?.close();
  }

  const lista = (productos: Producto[]) => (
    <ul className="space-y-2.5">
      {productos.map((p) => (
        <ProductoCard
          key={p.id}
          producto={p}
          tasaBs={tasa}
          cantidad={carrito[p.id] ?? 0}
          onCambiar={(delta) => cambiar(p.id, delta)}
        />
      ))}
    </ul>
  );
  const articulos = cantidadTotal(lineas);

  return (
    <>
      <main className={`px-5 ${lineas.length > 0 ? "pb-36" : "pb-16"}`}>
        {todos.length === 0 && <p className="py-16 text-center text-muted">Este menú todavía no tiene productos.</p>}

        {categoriasConProductos.map((c) => (
          <section key={c.id} id={`cat-${c.id}`} className="scroll-mt-16 pt-4">
            <h2 className="mb-2 mt-1 text-xs font-semibold uppercase tracking-[0.06em] text-muted">{c.nombre}</h2>
            {lista(c.productos)}
          </section>
        ))}

        {sinCategoria.length > 0 && <section className="pt-6">{lista(sinCategoria)}</section>}
      </main>

      {lineas.length > 0 && (
        <div className="fixed inset-x-0 bottom-0 z-20 mx-auto max-w-xl border-t border-line bg-card px-5 pt-3.5 pb-[max(1.25rem,env(safe-area-inset-bottom))] shadow-[0_-6px_20px_rgb(36_32_27/0.06)]">
          <button
            type="button"
            onClick={abrirPedido}
            className="flex w-full items-center justify-between rounded-[14px] bg-(--acento) px-4.5 py-3.5 text-(--sobre-acento)"
          >
            <span className="text-sm font-medium">
              {articulos} {articulos === 1 ? "artículo" : "artículos"}
            </span>
            <span className="flex items-center gap-2 text-[15px] font-semibold tabular-nums">
              Ver mi pedido · {formatUsd(total)}
              <svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="M9 18l6-6-6-6" /></svg>
            </span>
          </button>
        </div>
      )}

      <dialog
        ref={dialogo}
        tabIndex={-1}
        aria-label="Tu pedido"
        className="m-0 h-dvh max-h-none w-full max-w-none bg-background p-0 text-foreground outline-none backdrop:bg-black/40 sm:mx-auto sm:max-w-xl"
      >
        <form onSubmit={enviar} className="flex h-full flex-col">
          <div className="flex items-center gap-3.5 px-5 pt-6 pb-3">
            <button
              type="button"
              onClick={() => dialogo.current?.close()}
              aria-label="Volver al menú"
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-line bg-card"
            >
              <svg aria-hidden="true" width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.3" strokeLinecap="round" strokeLinejoin="round"><path d="M15 18l-6-6 6-6" /></svg>
            </button>
            <h2 className="font-titulo text-xl font-semibold">Tu pedido</h2>
          </div>

          <div className="flex-1 space-y-2.5 overflow-y-auto px-5 pt-2 pb-5">
            <ul className="space-y-2.5">
              {lineas.map((l) => (
                <li key={l.producto.id} className="flex items-center gap-3 rounded-[14px] border border-line bg-card p-3">
                  <Miniatura producto={l.producto} tam="h-[52px] w-[52px]" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[14.5px] font-semibold">{l.producto.nombre}</p>
                    <p className="mt-0.5 text-[12.5px] text-muted tabular-nums">
                      {l.cantidad} × {formatUsd(l.producto.precio_usd)}
                    </p>
                    <div className="mt-1.5">
                      <Cantidad nombre={l.producto.nombre} cantidad={l.cantidad} onCambiar={(delta) => cambiar(l.producto.id, delta)} compacto />
                    </div>
                  </div>
                  <span className="shrink-0 text-[14.5px] font-semibold text-(--acento-texto) tabular-nums">{formatUsd(l.subtotalUsd)}</span>
                </li>
              ))}
            </ul>

            <div className="rounded-[14px] border border-line bg-card p-4">
              <div className="flex justify-between py-1 text-[13.5px] text-muted">
                <span>Subtotal</span>
                <span className="tabular-nums">{formatUsd(total)}</span>
              </div>
              {tasa > 0 && (
                <div className="flex justify-between py-1 text-[13.5px] text-muted">
                  <span>Tasa del día</span>
                  <span className="tabular-nums">{formatBs(tasa)} / $</span>
                </div>
              )}
              <div className="my-2.5 h-px bg-line" />
              <div className="flex items-baseline justify-between">
                <span className="text-[15px] font-semibold">Total</span>
                <span className="text-right">
                  <span className="block font-titulo text-[22px] font-semibold text-(--acento-texto) tabular-nums">{formatUsd(total)}</span>
                  {tasa > 0 && <span className="block text-xs text-muted tabular-nums">{formatBs(usdToBs(total, tasa))}</span>}
                </span>
              </div>
            </div>

            <div className="space-y-4 rounded-[14px] border border-line bg-card p-4">
              <label className="block text-[13px] font-semibold">
                Tu nombre
                <input
                  required
                  maxLength={60}
                  autoComplete="name"
                  value={datos.nombre}
                  onChange={(e) => setDatos({ ...datos, nombre: e.target.value })}
                  className={campo}
                />
              </label>

              <fieldset>
                <legend className="text-[13px] font-semibold">¿Cómo lo recibes?</legend>
                <div className={`mt-1.5 grid gap-2 ${soloRetiro ? "grid-cols-1" : "grid-cols-2"}`}>
                  {(
                    [
                      ["retiro", "Retiro en el local"],
                      ["domicilio", "Entrega a domicilio"],
                    ] as const
                  ).filter(([valor]) => !soloRetiro || valor === "retiro").map(([valor, etiqueta]) => (
                    <label
                      key={valor}
                      className={`flex cursor-pointer items-center gap-2 rounded-[10px] border px-3 py-2.5 text-sm ${
                        datos.entrega === valor ? "border-(--acento) bg-(--acento-suave) font-semibold" : "border-line"
                      }`}
                    >
                      <input
                        type="radio"
                        name="entrega"
                        checked={datos.entrega === valor}
                        onChange={() => setDatos({ ...datos, entrega: valor })}
                        className="accent-(--acento)"
                      />
                      {etiqueta}
                    </label>
                  ))}
                </div>
              </fieldset>

              {datos.entrega === "domicilio" && (
                <label className="block text-[13px] font-semibold">
                  Dirección de entrega
                  <input
                    required
                    maxLength={200}
                    autoComplete="street-address"
                    value={datos.direccion}
                    onChange={(e) => setDatos({ ...datos, direccion: e.target.value })}
                    className={campo}
                  />
                </label>
              )}

              <label className="block text-[13px] font-semibold">
                Notas (opcional)
                <textarea
                  rows={2}
                  maxLength={300}
                  value={datos.notas}
                  onChange={(e) => setDatos({ ...datos, notas: e.target.value })}
                  className={campo}
                />
              </label>
            </div>

            <p className="px-1 text-xs leading-relaxed text-muted">
              Al enviar, se abrirá WhatsApp con tu pedido ya escrito para que {negocio.nombre} lo confirme.
            </p>
          </div>

          <div className="border-t border-line bg-card px-5 pt-3.5 pb-[max(1.25rem,env(safe-area-inset-bottom))]">
            {puedePedir ? (
              <button
                type="submit"
                className="flex w-full items-center justify-center gap-2.5 rounded-[14px] bg-exito p-[15px] text-[15px] font-semibold text-white"
              >
                <svg aria-hidden="true" width="19" height="19" viewBox="0 0 24 24" fill="currentColor"><path d="M12.04 2c-5.5 0-9.96 4.46-9.96 9.96 0 1.76.46 3.4 1.26 4.83L2 22l5.34-1.29a9.9 9.9 0 0 0 4.7 1.19h.01c5.5 0 9.96-4.46 9.96-9.96S17.54 2 12.04 2Zm5.8 14.1c-.24.68-1.4 1.3-1.94 1.38-.5.08-1.13.11-1.82-.11a16 16 0 0 1-1.66-.61c-2.93-1.27-4.84-4.2-4.99-4.4-.15-.19-1.2-1.6-1.2-3.05s.75-2.16 1.02-2.45c.26-.29.58-.36.77-.36h.55c.18 0 .42-.03.64.5.24.58.82 2 .89 2.15.08.15.13.32.02.51-.1.19-.15.31-.3.48-.15.17-.31.38-.44.51-.15.15-.3.31-.13.6.17.3.77 1.28 1.66 2.08 1.14 1.02 2.1 1.34 2.4 1.5.3.15.47.13.64-.08.18-.2.75-.87.95-1.17.2-.3.4-.25.68-.15.28.1 1.77.83 2.07.98.3.15.5.22.57.35.08.13.08.75-.16 1.43Z" /></svg>
                Enviar pedido por WhatsApp
              </button>
            ) : (
              <p className="rounded-[10px] bg-surface p-3 text-sm text-muted">
                Este local todavía no tiene WhatsApp configurado para recibir pedidos.
              </p>
            )}
          </div>
        </form>
      </dialog>
    </>
  );
}
