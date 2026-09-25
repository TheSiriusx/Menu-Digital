// Pruebas de src/lib/fechas.ts. Uso: node scripts/probar-fechas.mjs
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import ts from "typescript";

const raiz = fileURLToPath(new URL("..", import.meta.url));
const tmp = mkdtempSync(join(tmpdir(), "fechas-"));
writeFileSync(`${tmp}/fechas.mjs`, ts.transpileModule(readFileSync(`${raiz}src/lib/fechas.ts`, "utf8"), { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText);
const F = await import(pathToFileURL(`${tmp}/fechas.mjs`));

let bien = 0, mal = 0;
const igual = (a, b, m) => { const c = JSON.stringify(a) === JSON.stringify(b); if (c) bien++; else mal++; console.log((c ? "OK    " : "FALLA ") + m + (c ? "" : `  -> obtenido ${JSON.stringify(a)}, esperado ${JSON.stringify(b)}`)); };

console.log("--- hoy en Venezuela (UTC-4) ---");
igual(F.hoyCaracas(new Date("2026-09-25T03:30:00Z")), "2026-09-24", "03:30 UTC del 25 todavía es el día 24 en Caracas");
igual(F.hoyCaracas(new Date("2026-09-25T04:00:00Z")), "2026-09-25", "04:00 UTC = medianoche en Caracas: ya es el 25");
igual(F.hoyCaracas(new Date("2026-01-01T02:00:00Z")), "2025-12-31", "cruce de año: 02:00 UTC del 1 de enero es 31 de diciembre en Caracas");

console.log("--- aritmética de fechas ---");
igual(F.sumarDias("2026-09-25", 7), "2026-10-02", "sumar 7 días cruza de mes");
igual(F.sumarDias("2026-03-01", -1), "2026-02-28", "restar un día a 1 de marzo (año no bisiesto)");
igual(F.sumarDias("2028-03-01", -1), "2028-02-29", "año bisiesto");
igual(F.sumarDias("2026-12-31", 1), "2027-01-01", "cruce de año");
igual(F.inicioSemana("2026-09-25"), "2026-09-21", "el viernes 25 de septiembre pertenece a la semana del lunes 21");
igual(F.inicioSemana("2026-09-21"), "2026-09-21", "el lunes es su propio inicio de semana");
igual(F.inicioSemana("2026-09-27"), "2026-09-21", "el domingo cierra la semana que empezó el lunes");
igual(F.inicioSemana("2026-01-01"), "2025-12-29", "la semana puede empezar en el año anterior");
igual(F.inicioMes("2026-09-25"), "2026-09-01", "inicio de mes");
igual(F.sumarMeses("2026-01-01", -1), "2025-12-01", "restar un mes cruza de año");
igual(F.sumarMeses("2026-09-01", -11), "2025-10-01", "11 meses atrás");
igual(F.sumarMeses("2026-11-01", 3), "2027-02-01", "sumar meses cruza de año");

console.log("--- validación ---");
igual([F.esFecha("2026-09-25"), F.esFecha("2026-02-30"), F.esFecha("2026-13-01"), F.esFecha("25/09/2026"), F.esFecha(""), F.esFecha(null), F.esFecha("2026-9-5"), F.esFecha("2026-09-25; drop")], [true, false, false, false, false, false, false, false], "esFecha acepta solo AAAA-MM-DD reales");

console.log("--- periodos para el gráfico ---");
igual(F.periodos("2026-09-20", "2026-09-25", "day").length, 6, "6 días entre el 20 y el 25");
igual(F.periodos("2026-08-31", "2026-09-02", "day"), ["2026-08-31", "2026-09-01", "2026-09-02"], "días cruzando de mes");
igual(F.periodos("2026-09-15", "2026-10-05", "week"), ["2026-09-14", "2026-09-21", "2026-09-28", "2026-10-05"], "semanas (empiezan en lunes)");
igual(F.periodos("2026-07-15", "2026-09-25", "month"), ["2026-07-01", "2026-08-01", "2026-09-01"], "meses");

console.log("--- rango de cada vista ---");
igual(F.rangoVista("dias", "2026-09-25"), { desde: "2026-09-12", hasta: "2026-09-25", grano: "day" }, "14 días terminando hoy");
const s = F.rangoVista("semanas", "2026-09-25");
igual([s.desde, F.periodos(s.desde, s.hasta, "week").length], ["2026-07-06", 12], "12 semanas, empezando en lunes");
const m = F.rangoVista("meses", "2026-09-25");
igual([m.desde, F.periodos(m.desde, m.hasta, "month").length], ["2025-10-01", 12], "12 meses");
igual(F.rangoVista("dias", "2026-09-25").desde <= F.sumarDias("2026-09-25", -6), true, "los 14 días cubren los últimos 7 (para la tarjeta de 7 días)");

console.log("--- límites del día para filtrar pedidos ---");
igual([F.inicioDiaISO("2026-09-24"), F.finDiaISO("2026-09-24")], ["2026-09-24T00:00:00-04:00", "2026-09-24T23:59:59.999-04:00"], "un día de Venezuela como instantes exactos");
igual(new Date(F.inicioDiaISO("2026-09-24")).toISOString(), "2026-09-24T04:00:00.000Z", "medianoche de Caracas = 04:00 UTC");

console.log("--- etiquetas ---");
igual(F.fechaCorta("2026-09-05"), "5 sep", "fecha corta");
igual(F.fechaCorta("2025-12-05", "2026"), "5 dic 2025", "con año si no es el actual");
igual(F.etiquetaPeriodo("2026-09-21", "week", "2026"), "sem 21 sep", "etiqueta de semana");
igual(F.etiquetaPeriodo("2025-10-01", "month", "2026"), "oct 25", "etiqueta de mes de otro año");
igual(F.fechaHora("2026-09-25T03:30:00Z").includes("24") && F.fechaHora("2026-09-25T03:30:00Z").includes("sep"), true, "fecha y hora mostradas en hora de Venezuela (día 24)");

console.log(`\n${bien} de ${bien + mal} pruebas correctas`);
process.exit(mal ? 1 : 0);
