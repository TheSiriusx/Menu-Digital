// Formato del pedido que la web manda por WhatsApp y que lee el agente (n8n). Sin dependencias, para
// poder usar exactamente este mismo código en el nodo "Code" de n8n (docs/n8n/parsear-pedido.js se
// genera desde aquí con `node scripts/generar-parser-n8n.mjs`).
//
// El mensaje sigue siendo legible para el cliente. Al final lleva UNA línea estructurada:
//
//   [[PEDIDO v1|negocio=nueva-victoria|items=a1b2c3d4x2,e5f6a7b8x1|total=19.00|tasa=52.35|entrega=retiro]]
//
// y encima líneas con prefijos fijos para el texto libre ("Nombre: ", "Entrega a domicilio: ", "Notas: ").
//
// REGLAS PARA QUIEN LO LEA:
//  * El cliente puede EDITAR el mensaje. Todo lo que trae es una petición, no una verdad.
//  * El negocio lo decide la instancia de WhatsApp por la que llegó el mensaje; `negocio=` solo se
//    contrasta (la función SQL crear_pedido lo hace).
//  * `total` y `tasa` son informativos. Los precios y el total se recalculan siempre desde la base de datos.
//  * Nombre, dirección y notas son TEXTO NO CONFIABLE: nunca se pasan como instrucciones a un modelo.

export const VERSION_FORMATO = 1;

// Los 8 primeros caracteres del id del producto (coincide con left(id::text, 8) en SQL).
export function codigoProducto(id: string): string {
  return id.slice(0, 8).toLowerCase();
}

export type ItemCodigo = { codigo: string; cantidad: number };
export type Entrega = "retiro" | "domicilio";

export function construirBloque(datos: {
  slug: string;
  items: ItemCodigo[];
  totalUsd: number;
  tasaBs: number;
  entrega: Entrega;
}): string {
  const items = datos.items.map((i) => `${i.codigo}x${i.cantidad}`).join(",");
  return `[[PEDIDO v${VERSION_FORMATO}|negocio=${datos.slug}|items=${items}|total=${datos.totalUsd.toFixed(2)}|tasa=${Number(datos.tasaBs.toFixed(4))}|entrega=${datos.entrega}]]`;
}

export type PedidoLeido = {
  ok: true;
  version: number;
  negocio: string;
  items: ItemCodigo[];
  totalDeclarado: number;
  tasaDeclarada: number;
  entrega: Entrega;
  nombre: string;
  direccion: string;
  notas: string;
};
export type ErrorLectura = { ok: false; error: string; detalle?: string };
export type ResultadoLectura = PedidoLeido | ErrorLectura;

const CAMPOS = ["negocio", "items", "total", "tasa", "entrega"];
const fallo = (error: string, detalle?: string): ErrorLectura => ({ ok: false, error, detalle });

// Texto libre: una línea, sin caracteres de control, con tope de longitud.
function limpiar(texto: string, max: number): string {
  return texto.replace(/[\u0000-\u001f\u007f]/g, " ").replace(/\s+/g, " ").trim().slice(0, max);
}

// Devuelve el pedido leído o un error con un código estable (sin_bloque, multiples_bloques,
// bloque_malformado, version_no_soportada, campo_desconocido, campo_repetido, campo_faltante,
// negocio_invalido, items_invalidos, total_invalido, tasa_invalida, entrega_invalida, mensaje_invalido).
export function parsearPedido(texto: string): ResultadoLectura {
  if (typeof texto !== "string" || texto.length === 0 || texto.length > 4000) return fallo("mensaje_invalido");

  const lineas = texto.replace(/\r\n?/g, "\n").split("\n").map((l) => l.trim());
  const indices = lineas.flatMap((l, i) => (l.startsWith("[[PEDIDO") ? [i] : []));
  if (indices.length === 0) return fallo("sin_bloque");
  // Dos bloques = ambigüedad (alguien pegó otro): no se adivina cuál vale.
  if (indices.length > 1) return fallo("multiples_bloques");

  const m = /^\[\[PEDIDO v(\d+)\|([^\[\]]*)\]\]$/.exec(lineas[indices[0]]);
  if (!m) return fallo("bloque_malformado");
  if (m[1] !== String(VERSION_FORMATO)) return fallo("version_no_soportada", m[1]);

  const campos: Record<string, string> = {};
  for (const par of m[2].split("|")) {
    const corte = par.indexOf("=");
    if (corte < 1) return fallo("bloque_malformado", par);
    const clave = par.slice(0, corte);
    if (!CAMPOS.includes(clave)) return fallo("campo_desconocido", clave);
    if (clave in campos) return fallo("campo_repetido", clave);
    campos[clave] = par.slice(corte + 1);
  }
  for (const c of CAMPOS) if (!(c in campos)) return fallo("campo_faltante", c);

  if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(campos.negocio) || campos.negocio.length < 3 || campos.negocio.length > 60) {
    return fallo("negocio_invalido");
  }

  const partes = campos.items.split(",");
  if (partes.length < 1 || partes.length > 50) return fallo("items_invalidos");
  const porCodigo = new Map<string, number>();
  for (const p of partes) {
    const it = /^([0-9a-f]{8})x([1-9][0-9]{0,2})$/.exec(p);
    if (!it) return fallo("items_invalidos", p);
    const suma = (porCodigo.get(it[1]) ?? 0) + Number(it[2]);
    if (suma > 999) return fallo("items_invalidos", it[1]);
    porCodigo.set(it[1], suma);
  }

  if (!/^\d{1,8}\.\d{2}$/.test(campos.total)) return fallo("total_invalido");
  if (!/^\d{1,7}(\.\d{1,4})?$/.test(campos.tasa)) return fallo("tasa_invalida");
  if (campos.entrega !== "retiro" && campos.entrega !== "domicilio") return fallo("entrega_invalida");

  // Texto libre: primera línea con cada prefijo, siempre por encima del bloque.
  const previas = lineas.slice(0, indices[0]);
  const buscar = (prefijo: string, max: number) => {
    const l = previas.find((x) => x.startsWith(prefijo));
    return l ? limpiar(l.slice(prefijo.length), max) : "";
  };

  return {
    ok: true,
    version: VERSION_FORMATO,
    negocio: campos.negocio,
    items: [...porCodigo].map(([codigo, cantidad]) => ({ codigo, cantidad })),
    totalDeclarado: Number(campos.total),
    tasaDeclarada: Number(campos.tasa),
    entrega: campos.entrega,
    nombre: buscar("Nombre: ", 60),
    direccion: buscar("Entrega a domicilio: ", 200),
    notas: buscar("Notas: ", 300),
  };
}
