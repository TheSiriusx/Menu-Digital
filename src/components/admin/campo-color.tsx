"use client";

import { useState } from "react";

// Selector de color que envía un #RRGGBB (o vacío = color por defecto) en el campo "color".
export function CampoColor({ inicial, defecto }: { inicial: string | null; defecto: string }) {
  const [color, setColor] = useState<string>(inicial ?? "");

  return (
    <div className="mt-1.5 flex items-center gap-3">
      <input
        type="color"
        aria-label="Elegir color"
        value={color || defecto}
        onChange={(e) => setColor(e.target.value)}
        className="h-11 w-14 cursor-pointer rounded-xl border border-field bg-surface p-1"
      />
      <input type="hidden" name="color" value={color} />
      <span className="text-sm tabular-nums text-muted">{color || "Color por defecto"}</span>
      {color && (
        <button type="button" onClick={() => setColor("")} className="rounded-full px-3 py-1 text-sm text-muted underline">
          Restablecer
        </button>
      )}
    </div>
  );
}
