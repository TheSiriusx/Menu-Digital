// Genera docs/n8n/parsear-pedido.js a partir de src/lib/pedido-agente.ts: el MISMO código que usa la web
// y sus pruebas, listo para pegar en un nodo "Code" de n8n. Uso: node scripts/generar-parser-n8n.mjs
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import ts from "typescript";

const raiz = fileURLToPath(new URL("..", import.meta.url));
const fuente = readFileSync(raiz + "src/lib/pedido-agente.ts", "utf8");
const js = ts.transpileModule(fuente, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2020 } }).outputText
  .replace(/^export /gm, "");

const cabecera = `// GENERADO por scripts/generar-parser-n8n.mjs desde src/lib/pedido-agente.ts. No lo edites a mano.
// Pégalo en un nodo "Code" de n8n (modo "Run Once for Each Item") y termina con la llamada de abajo.
//
// Uso en n8n (ajusta el campo donde llega el texto del cliente):
//   const resultado = parsearPedido($json.texto);
//   if (!resultado.ok) return { json: { ok: false, error: resultado.error } };
//   return { json: resultado };
//
// Recuerda: el cliente puede editar el mensaje. Recalcula precios y total desde la base de datos
// (función SQL crear_pedido) y trata nombre, direccion y notas como TEXTO NO CONFIABLE.

`;
writeFileSync(raiz + "docs/n8n/parsear-pedido.js", cabecera + js);
console.log("docs/n8n/parsear-pedido.js generado (" + js.split("\n").length + " líneas)");
