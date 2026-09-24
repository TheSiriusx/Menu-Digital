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
  "mt-1 w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-base dark:border-zinc-700 dark:bg-zinc-900";

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

  const seccion = (productos: Producto[]) => (
    <ul className="divide-y divide-zinc-100 dark:divide-zinc-900">
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
      <main className={`px-4 ${lineas.length > 0 ? "pb-28" : "pb-16"}`}>
        {todos.length === 0 && (
          <p className="py-12 text-center text-zinc-600 dark:text-zinc-400">
            Este menú todavía no tiene productos.
          </p>
        )}

        {categoriasConProductos.map((c) => (
          <section key={c.id} id={`cat-${c.id}`} className="scroll-mt-14 pt-6">
            <h2 className="border-b-2 border-(--acento) pb-1 text-lg font-semibold">{c.nombre}</h2>
            {seccion(c.productos)}
          </section>
        ))}

        {sinCategoria.length > 0 && <section className="pt-6">{seccion(sinCategoria)}</section>}
      </main>

      {lineas.length > 0 && (
        <div className="fixed inset-x-0 bottom-0 z-20 border-t border-zinc-200 bg-white/95 px-4 py-3 backdrop-blur dark:border-zinc-800 dark:bg-black/95">
          <button
            type="button"
            onClick={() => dialogo.current?.showModal()}
            className="mx-auto flex w-full max-w-2xl items-center justify-between rounded-full bg-(--acento) px-5 py-3 font-medium text-white"
          >
            <span>Ver pedido ({cantidadTotal(lineas)})</span>
            <span>
              {formatUsd(total)}
              {tasa > 0 && ` · ${formatBs(usdToBs(total, tasa))}`}
            </span>
          </button>
        </div>
      )}

      <dialog
        ref={dialogo}
        aria-label="Tu pedido"
        onClick={(e) => e.target === dialogo.current && dialogo.current?.close()}
        className="m-0 mt-auto max-h-[92dvh] w-full max-w-none overflow-y-auto rounded-t-2xl bg-white p-0 text-zinc-900 backdrop:bg-black/50 sm:m-auto sm:max-w-lg sm:rounded-2xl dark:bg-zinc-950 dark:text-zinc-50"
      >
        <form onSubmit={enviar} className="p-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold">Tu pedido</h2>
            <button
              type="button"
              onClick={() => dialogo.current?.close()}
              className="rounded-full px-3 py-1 text-sm text-zinc-600 dark:text-zinc-400"
            >
              Cerrar
            </button>
          </div>

          <ul className="mt-2 divide-y divide-zinc-100 dark:divide-zinc-900">
            {lineas.map((l) => (
              <li key={l.producto.id} className="flex items-center justify-between gap-3 py-3">
                <div className="min-w-0">
                  <p className="font-medium leading-tight">{l.producto.nombre}</p>
                  <p className="text-sm text-zinc-500 dark:text-zinc-400">
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

          <p className="mt-2 flex justify-between border-t border-zinc-200 pt-3 font-semibold dark:border-zinc-800">
            <span>Total</span>
            <span>
              {formatUsd(total)}
              {tasa > 0 && ` · ${formatBs(usdToBs(total, tasa))}`}
            </span>
          </p>

          <div className="mt-4 space-y-3">
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
              <div className="mt-1 flex gap-4">
                {(
                  [
                    ["retiro", "Retiro en el local"],
                    ["domicilio", "Entrega a domicilio"],
                  ] as const
                ).map(([valor, etiqueta]) => (
                  <label key={valor} className="flex items-center gap-2 text-sm">
                    <input
                      type="radio"
                      name="entrega"
                      checked={datos.entrega === valor}
                      onChange={() => setDatos({ ...datos, entrega: valor })}
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
              className="mt-4 w-full rounded-full bg-(--acento) px-5 py-3 font-medium text-white"
            >
              Pedir por WhatsApp
            </button>
          ) : (
            <p className="mt-4 rounded-lg bg-zinc-100 p-3 text-sm text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300">
              Este local todavía no tiene WhatsApp configurado para recibir pedidos.
            </p>
          )}
        </form>
      </dialog>
    </>
  );
}
