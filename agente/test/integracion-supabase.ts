// Prueba contra el Supabase REAL (no corre con `npm test`). Necesita SUPABASE_URL y SUPABASE_SERVICE_KEY y que el local
// de prueba tenga la instancia INSTANCIA. Solo usa números 999 (no existen). Uso: ver pruebas/agente-supabase.py
import assert from "node:assert/strict";
import { Supabase } from "../src/clientes.ts";
import { registrarPedido } from "../src/pedidos.ts";

const INSTANCIA = process.env.INSTANCIA ?? "menu-nueva-victoria";
const sb = new Supabase(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_KEY!);
const res: boolean[] = [];
const ok = (c: boolean, m: string) => { res.push(c); console.log((c ? "OK    " : "FALLA ") + m); };

const ctx = await sb.contexto(INSTANCIA);
ok(!!ctx && ctx.negocio.slug === "nueva-victoria" && ctx.config.pago_momento === "al_registrar", "contexto: local y configuración");
ok((await sb.contexto("no-existe")) === null, "contexto: instancia desconocida -> null");
const menu = await sb.menu(INSTANCIA);
ok(menu.length === 16 && menu.every((p) => /^[0-9a-f]{8}$/.test(p.codigo) && !("stock" in p)), `menú: ${menu.length} productos, sin stock`);
const canilla = menu.find((p) => p.nombre === "Pan canilla")!;
const contacto = { id: 1, instancia: INSTANCIA, telefono: "999000000011", lid: null, nombre: "Prueba Agente", jid: "999000000011@s.whatsapp.net" };
const pedir = (origen: string, cantidad = 2) => registrarPedido(sb, ctx!, contacto, {
  items: [{ codigo: canilla.codigo, cantidad }], entrega: "retiro", direccion: null, notas: null, nombre: "Prueba Agente", origen, slug: "nueva-victoria",
}, new Date(), null);

const r1 = await pedir("integ-1");
ok(r1.creado && /Total: \$1,00/.test(r1.respuesta) && /🛒 Nuevo pedido/.test(r1.avisoDueno ?? ""), "pedido real registrado con el total de la base");
const r2 = await pedir("integ-1");
ok(r2.creado && /Ya tenía registrado/.test(r2.respuesta) && r2.avisoDueno === null, "mismo mensaje: no duplica");
const r3 = await registrarPedido(sb, ctx!, contacto, { items: [{ codigo: canilla.codigo, cantidad: 1 }], entrega: "retiro", direccion: null, notas: null, nombre: null, origen: "integ-2", slug: "otro-local" }, new Date(), null);
ok(!r3.creado && /otro menú/.test(r3.respuesta), "mensaje manipulado (otro local): rechazado");

const mios = await sb.pedidosCliente(INSTANCIA, "999000000011");
ok(mios.length === 1 && mios[0].estado === "nuevo" && mios[0].items[0].nombre === "Pan canilla", "pedidos del cliente");
ok((await sb.pedidosCliente(INSTANCIA, "999000000099")).length === 0, "otro teléfono no ve nada");
const ajeno = await sb.cancelarPedido(INSTANCIA, "999000000099", mios[0].codigo);
ok(!ajeno.ok && ajeno.error === "pedido_no_encontrado", "no puede cancelar el pedido de otro cliente");
const hoy = await sb.pedidosHoy(INSTANCIA);
ok(hoy.some((p) => p.codigo === mios[0].codigo), "pedidos de hoy (comando del dueño)");
const can = await sb.cancelarPedido(INSTANCIA, "999000000011", mios[0].codigo.toUpperCase());
ok(can.ok, "cancelar su propio pedido nuevo");

const avisos = await sb.avisosTomar(50);
ok(!avisos.some((a) => a.clave === "estado:cancelado"), "cancelar desde el agente NO encola aviso de estado (ya se lo dijo)");
const apag = await sb.encendido(INSTANCIA, "apagar", 2);
ok(apag.ok && !!(apag as { pausado_hasta: string | null }).pausado_hasta, "apagar 2h");
ok((await sb.encendido(INSTANCIA, "encender", null)).ok, "encender");

console.log(`\n${res.filter(Boolean).length} de ${res.length} pruebas correctas`);
process.exit(res.every(Boolean) ? 0 : 1);
