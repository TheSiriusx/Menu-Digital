import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { ImageResponse } from "next/og";
import { COLORES } from "@/lib/colores-marca";
import { ESLOGAN, MARCA } from "@/lib/marca";

// Imagen al compartir un enlace de Pidelo (WhatsApp, redes): fondo brand, imagotipo reverso y el eslogan en
// Fredoka 600 color accent. Se genera una vez en el build. Los menús de los locales no la usan: llevan su propia
// metadata (src/app/[slug]/page.tsx).
export const alt = `${MARCA}: ${ESLOGAN}`;
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function Imagen() {
  const [fredoka, imagotipo] = await Promise.all([
    readFile(join(process.cwd(), "src/assets/fredoka-600.ttf")),
    readFile(join(process.cwd(), "public/brand/imagotipo-reverso.svg")),
  ]);
  const logo = `data:image/svg+xml;base64,${imagotipo.toString("base64")}`;

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: 56,
          background: COLORES.brand,
        }}
      >
        <img src={logo} alt="" width={560} height={Math.round(560 / (411.79 / 155))} />
        <div style={{ fontFamily: "Fredoka", fontSize: 72, color: COLORES.accent, lineHeight: 1 }}>{ESLOGAN}</div>
      </div>
    ),
    { ...size, fonts: [{ name: "Fredoka", data: fredoka, style: "normal", weight: 600 }] },
  );
}
