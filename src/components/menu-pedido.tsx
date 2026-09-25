"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { Cantidad, ProductoCard } from "@/components/producto-card";
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
};

const campo =
  "mt-1.5 w-full rounded-xl border border-field bg-surface px-3.5 py-2.5 text-base outline-offset-0 focus-visible:outline-2";

export function MenuPedido({ negocio, categorias, sinCategoria }: Props) {
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
    <ul className="mt-4 grid gap-x-3 gap-y-5 sm:grid-cols-2">
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

  return (
    <>
      <main className={`px-4 ${lineas.length > 0 ? "pb-32" : "pb-16"}`}>
        {todos.length === 0 && (
          <p className="py-16 text-center text-muted">Este menú todavía no tiene productos.</p>
        )}

        {categoriasConProductos.map((c) => (
          <section key={c.id} id={`cat-${c.id}`} className="scroll-mt-16 pt-8">
            <h2 className="text-xl font-semibold tracking-tight">{c.nombre}</h2>
            {lista(c.productos)}
          </section>
        ))}

        {sinCategoria.length > 0 && <section className="pt-8">{lista(sinCategoria)}</section>}
      </main>

      {lineas.length > 0 && (
        <div className="pointer-events-none fixed inset-x-0 bottom-0 z-20 px-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
          <button
            type="button"
            onClick={abrirPedido}
            className="pointer-events-auto mx-auto flex w-full max-w-md items-center justify-between rounded-full bg-(--acento) px-5 py-3.5 font-medium text-(--sobre-acento) shadow-xl"
          >
            <span className="flex items-center gap-2">
              <span className="flex h-6 min-w-6 items-center justify-center rounded-full bg-(--sobre-acento) px-1.5 text-xs font-semibold text-(--acento)">
                {cantidadTotal(lineas)}
              </span>
              Ver pedido
            </span>
            <span className="tabular-nums">
              {formatUsd(total)}
              {tasa > 0 && ` · ${formatBs(usdToBs(total, tasa))}`}
            </span>
          </button>
        </div>
      )}

      <dialog
        ref={dialogo}
        tabIndex={-1}
        aria-label="Tu pedido"
        onClick={(e) => e.target === dialogo.current && dialogo.current?.close()}
        className="m-0 mt-auto max-h-[92dvh] w-full max-w-none overflow-y-auto rounded-t-3xl bg-background p-0 text-foreground outline-none backdrop:bg-black/50 sm:m-auto sm:max-w-lg sm:rounded-3xl"
      >
        <form onSubmit={enviar} className="p-5">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold tracking-tight">Tu pedido</h2>
            <button
              type="button"
              onClick={() => dialogo.current?.close()}
              className="rounded-full px-3 py-1.5 text-sm text-muted"
            >
              Cerrar
            </button>
          </div>

          <ul className="mt-3 divide-y divide-line">
            {lineas.map((l) => (
              <li key={l.producto.id} className="flex items-center justify-between gap-3 py-3">
                <div className="min-w-0">
                  <p className="font-medium leading-tight">{l.producto.nombre}</p>
                  <p className="text-sm text-muted tabular-nums">
                    {formatUsd(l.subtotalUsd)}
                    {tasa > 0 && ` · ${formatBs(usdToBs(l.subtotalUsd, tasa))}`}
                  </p>
                </div>
                <Cantidad
                  nombre={l.producto.nombre}
                  cantidad={l.cantidad}
                  onCambiar={(delta) => cambiar(l.producto.id, delta)}
                />
              </li>
            ))}
          </ul>

          <div className="mt-2 flex items-baseline justify-between border-t border-line pt-4">
            <span className="text-muted">Total</span>
            <span className="text-xl font-semibold tabular-nums">
              {formatUsd(total)}
              {tasa > 0 && <span className="ml-2 text-sm font-normal text-muted">{formatBs(usdToBs(total, tasa))}</span>}
            </span>
          </div>

          <div className="mt-5 space-y-4">
            <label className="block text-sm font-medium">
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
              <legend className="text-sm font-medium">¿Cómo lo recibes?</legend>
              <div className="mt-1.5 grid grid-cols-2 gap-2">
                {(
                  [
                    ["retiro", "Retiro en el local"],
                    ["domicilio", "Entrega a domicilio"],
                  ] as const
                ).map(([valor, etiqueta]) => (
                  <label
                    key={valor}
                    className={`flex cursor-pointer items-center gap-2 rounded-xl border px-3 py-2.5 text-sm ${
                      datos.entrega === valor ? "border-(--acento) bg-surface font-medium" : "border-line"
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
              <label className="block text-sm font-medium">
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

            <label className="block text-sm font-medium">
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

          {puedePedir ? (
            <button
              type="submit"
              className="mt-6 w-full rounded-full bg-(--acento) px-5 py-3.5 font-medium text-(--sobre-acento) shadow-md"
            >
              Pedir por WhatsApp
            </button>
          ) : (
            <p className="mt-6 rounded-xl bg-surface p-3 text-sm text-muted">
              Este local todavía no tiene WhatsApp configurado para recibir pedidos.
            </p>
          )}
        </form>
      </dialog>
    </>
  );
}
