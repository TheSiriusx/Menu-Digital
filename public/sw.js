// Service worker de Pidelo, escrito a mano (sin librerías). Reglas:
//  · Páginas: primero la red. Sin señal, la última copia guardada o la página «sin conexión».
//    Solo se guardan páginas públicas (portada, login, menús de los locales): nunca el panel, el super admin ni
//    nada que dependa de la sesión.
//  · Estáticos con versión en el nombre (/_next/static/… y /pwa/*-vN.*): pueden salir de la caché.
//  · Nunca se guarda la API, la base de datos (Supabase y cualquier otro dominio), las acciones del servidor ni los
//    datos de navegación interna de Next (RSC).
//  · Las cachés llevan la versión en el nombre. Cuando cambie algo grande, sube VERSION (v1 → v2): al activarse,
//    este archivo borra las de versiones anteriores.
// Se sirve con Cache-Control: no-cache (next.config.ts) y se registra con updateViaCache: "none".

const VERSION = "v1";
const PAGINAS = `pidelo-paginas-${VERSION}`;
const ESTATICOS = `pidelo-estaticos-${VERSION}`;
const SIN_CONEXION = "/sin-conexion";
const ISOTIPO_SIN_CONEXION = "/pwa/sin-conexion-isotipo-v1.svg";
const MAX_PAGINAS = 40;

// Rutas con datos del usuario o que dependen de la sesión: nunca se guardan ni se sirven desde la caché.
const PRIVADA = /^\/(admin|superadmin|api|auth|sin-conexion|login\/(verificar|nueva-clave|recuperar\/confirmar))(\/|$)/;
const conVersion = (ruta) => ruta.startsWith("/_next/static/") || /^\/pwa\/[^/]+-v\d+\.[a-z0-9]+$/.test(ruta);

self.addEventListener("install", (evento) => {
  evento.waitUntil(
    (async () => {
      const paginas = await caches.open(PAGINAS);
      const estaticos = await caches.open(ESTATICOS);
      const respuesta = await fetch(SIN_CONEXION, { cache: "no-store" });
      if (!respuesta.ok) throw new Error(`No se pudo guardar ${SIN_CONEXION}`);
      const html = await respuesta.clone().text();
      await paginas.put(SIN_CONEXION, respuesta);
      await estaticos.add(ISOTIPO_SIN_CONEXION);

      // Los estilos y las fuentes de la página sin conexión, para que se vea bien sin señal.
      const hojas = new Set(html.match(/\/_next\/static\/[^"'\s)]+\.css/g) ?? []);
      await Promise.all(
        [...hojas].map(async (hoja) => {
          const css = await fetch(hoja);
          if (!css.ok) return;
          await estaticos.put(hoja, css.clone());
          const base = new URL(hoja, self.location.origin);
          const fuentes = new Set([...(await css.text()).matchAll(/url\(["']?([^"')]+\.woff2)["']?\)/g)].map((m) => new URL(m[1], base).pathname));
          await Promise.all([...fuentes].map((fuente) => estaticos.add(fuente).catch(() => {})));
        }),
      );
      await self.skipWaiting();
    })(),
  );
});

self.addEventListener("activate", (evento) => {
  evento.waitUntil(
    (async () => {
      const vigentes = [PAGINAS, ESTATICOS];
      for (const nombre of await caches.keys()) {
        if (nombre.startsWith("pidelo-") && !vigentes.includes(nombre)) await caches.delete(nombre);
      }
      await self.clients.claim();
    })(),
  );
});

self.addEventListener("fetch", (evento) => {
  const pedido = evento.request;
  if (pedido.method !== "GET") return; // acciones del servidor, formularios
  const url = new URL(pedido.url);
  if (url.origin !== self.location.origin) return; // Supabase, fotos, otros dominios
  if (pedido.headers.has("RSC") || url.searchParams.has("_rsc") || pedido.headers.has("Next-Router-Prefetch")) return;

  if (pedido.mode === "navigate") {
    evento.respondWith(pagina(pedido, url));
  } else if (conVersion(url.pathname)) {
    evento.respondWith(estatico(pedido));
  }
});

async function pagina(pedido, url) {
  const privada = PRIVADA.test(url.pathname);
  try {
    const respuesta = await fetch(pedido);
    if (!privada && respuesta.ok && !respuesta.redirected && respuesta.type === "basic") {
      const copia = respuesta.clone();
      caches.open(PAGINAS).then(async (cache) => {
        await cache.put(pedido, copia);
        const claves = await cache.keys();
        // La más vieja primero; la página sin conexión no se borra nunca.
        for (const clave of claves.filter((c) => new URL(c.url).pathname !== SIN_CONEXION).slice(0, -MAX_PAGINAS)) await cache.delete(clave);
      });
    }
    return respuesta;
  } catch {
    if (!privada) {
      const copia = await caches.match(pedido, { cacheName: PAGINAS, ignoreSearch: true });
      if (copia) return copia;
    }
    const sinConexion = await caches.match(SIN_CONEXION, { cacheName: PAGINAS });
    return sinConexion ?? new Response("Sin conexión. Revisa tu internet y vuelve a intentarlo.", { status: 503, headers: { "Content-Type": "text/plain; charset=utf-8" } });
  }
}

async function estatico(pedido) {
  const guardada = await caches.match(pedido, { cacheName: ESTATICOS });
  if (guardada) return guardada;
  const respuesta = await fetch(pedido);
  if (respuesta.ok && respuesta.type === "basic") {
    const copia = respuesta.clone();
    caches.open(ESTATICOS).then((cache) => cache.put(pedido, copia));
  }
  return respuesta;
}
