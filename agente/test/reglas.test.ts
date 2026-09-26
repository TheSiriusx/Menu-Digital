import { test } from "node:test";
import assert from "node:assert/strict";
import { comandoDueno, esConfirmacion, esNegacion, motivoHumano } from "../src/reglas.ts";
import { estaAbierto, fechaLegible, hora12, leerFechaHora, momento, proximaApertura, textoHorario } from "../src/horario.ts";
import { normalizar, precio } from "../src/texto.ts";

const H = {
  lunes: [{ desde: "06:00", hasta: "12:00" }, { desde: "14:00", hasta: "19:00" }],
  martes: [{ desde: "06:00", hasta: "19:00" }], miercoles: [{ desde: "06:00", hasta: "19:00" }],
  jueves: [{ desde: "06:00", hasta: "19:00" }], viernes: [{ desde: "06:00", hasta: "19:00" }],
  sabado: [{ desde: "06:00", hasta: "19:00" }], domingo: [],
};
// 2026-09-28 es lunes. Venezuela = UTC-4.
const caracas = (fecha: string, hora: string) => new Date(`${fecha}T${hora}:00-04:00`);

test("confirmaciones: solo un «sí» claro confirma", () => {
  for (const s of ["sí", "Si!", "SII", "dale", "ok", "Okey 👍", "👍", "Sí, confirmo", "listo gracias", "sí por favor", "Confirmo el pedido."]) {
    assert.equal(esConfirmacion(s), true, s);
  }
  for (const s of ["si pero sin azúcar", "sí, y agrega un café", "no", "quiero 2 canillas", "si quiero cambiar algo", "", "sí".repeat(30)]) {
    assert.equal(esConfirmacion(s), false, s);
  }
  assert.equal(esNegacion("No, gracias"), true);
  assert.equal(esNegacion("mejor no"), true);
  assert.equal(esNegacion("no tienen tequeños?"), false);
});

test("alergias e ingredientes van SIEMPRE a una persona", () => {
  for (const s of ["¿tiene gluten el pan?", "soy alérgica al maní", "Es apto para celíacos?", "qué ingredientes lleva", "tiene lactosa", "tengo diabetes, hay algo sin azúcar?"]) {
    assert.equal(motivoHumano(s), "alergia", s);
  }
  assert.equal(motivoHumano("quiero poner una queja"), "delicado");
  assert.equal(motivoHumano("el pan vino vencido"), "delicado");
  for (const s of ["hola, cuánto cuesta el pan", "quiero 2 canillas", "a qué hora abren", "manicura"]) assert.equal(motivoHumano(s), null, s);
});

test("comandos del dueño", () => {
  assert.deepEqual(comandoDueno("Ayuda"), { tipo: "ayuda" });
  assert.deepEqual(comandoDueno("pedidos"), { tipo: "pedidos" });
  assert.deepEqual(comandoDueno("apagar"), { tipo: "apagar", horas: null });
  assert.deepEqual(comandoDueno("Apagar 3h"), { tipo: "apagar", horas: 3 });
  assert.deepEqual(comandoDueno("apagar 12 horas"), { tipo: "apagar", horas: 12 });
  assert.deepEqual(comandoDueno("encender"), { tipo: "encender" });
  for (const s of ["nota: comprar harina", "pedidos pendientes de la semana", "apagar la luz", "hola"]) assert.equal(comandoDueno(s), null, s);
});

test("horario en hora de Venezuela", () => {
  assert.deepEqual(momento(new Date("2026-09-28T13:30:00Z")), { fecha: "2026-09-28", dia: "lunes", hhmm: "09:30" });
  assert.deepEqual(momento(new Date("2026-09-29T03:30:00Z")), { fecha: "2026-09-28", dia: "lunes", hhmm: "23:30" }, "23:30 del lunes en Caracas es martes en UTC");
  assert.equal(estaAbierto(H, caracas("2026-09-28", "10:00")), true);
  assert.equal(estaAbierto(H, caracas("2026-09-28", "13:00")), false, "cierre de mediodía");
  assert.equal(estaAbierto(H, caracas("2026-09-28", "19:00")), false, "a la hora de cierre ya está cerrado");
  assert.equal(estaAbierto(H, caracas("2026-09-27", "10:00")), false, "domingo cerrado");
  assert.deepEqual(proximaApertura(H, caracas("2026-09-28", "13:00")), { cuando: "hoy", hora: "2:00 pm" });
  assert.deepEqual(proximaApertura(H, caracas("2026-09-28", "20:00")), { cuando: "mañana", hora: "6:00 am" });
  assert.deepEqual(proximaApertura(H, caracas("2026-09-26", "20:00")), { cuando: "el lunes", hora: "6:00 am" }, "sábado de noche -> lunes (domingo cerrado)");
  assert.equal(proximaApertura({}, new Date()), null);
  assert.equal(hora12("00:30"), "12:30 am");
  assert.equal(hora12("12:00"), "12:00 pm");
  assert.equal(textoHorario(H), "Lunes: 6:00 am a 12:00 pm y 2:00 pm a 7:00 pm · Martes a sábado: 6:00 am a 7:00 pm · Domingo: cerrado");
  assert.equal(fechaLegible("2026-09-28T19:30:00Z"), "lunes 28/09, 3:30 pm");
  assert.equal(leerFechaHora("2026-10-03 15:00")?.toISOString(), "2026-10-03T19:00:00.000Z");
  assert.equal(leerFechaHora("2026-02-30 15:00"), null);
  assert.equal(leerFechaHora("mañana a las 3"), null);
});

test("texto y dinero", () => {
  assert.equal(normalizar("¡Café con LECHE, por favor!"), "cafe con leche por favor");
  assert.equal(precio(3.5, 50), "$3,50 (Bs 175,00)");
  assert.equal(precio(1234.5, 52.35), "$1.234,50 (Bs 64.626,08)");
  assert.equal(precio(2, 0), "$2,00");
});
