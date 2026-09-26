# Agente de WhatsApp para panaderías. Se construye desde la raíz del repositorio (usa src/lib/ del menú web):
#   docker compose build   (desde agente/, el compose ya apunta al contexto correcto)
FROM node:24-alpine
WORKDIR /app
COPY src/lib/pedido-agente.ts src/lib/asistente.ts src/lib/precios.ts src/lib/
RUN echo '{"type":"module"}' > src/package.json
COPY agente/package.json agente/
COPY agente/src agente/src
RUN mkdir -p agente/datos && chown -R node:node agente/datos
WORKDIR /app/agente
USER node
ENV NODE_ENV=production AGENTE_BD=datos/agente.db PUERTO=3000
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --retries=3 CMD wget -qO- http://127.0.0.1:3000/salud || exit 1
CMD ["node", "--disable-warning=ExperimentalWarning", "src/main.ts"]
