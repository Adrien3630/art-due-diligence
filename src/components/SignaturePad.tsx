"use client";

/*
  Pavé de signature manuscrite — 100 % local (#8).

  Le responsable de conformité signe au doigt / à la souris ; le tracé est
  converti en data-URL PNG et joint à la décision, puis au rapport PDF. Rien ne
  quitte la machine. Purement présentationnel : l'état (data-URL) est remonté au
  parent via `onChange`.
*/

import { useRef, useState } from "react";

export function SignaturePad({
  value,
  onChange,
}: {
  value?: string;
  onChange: (dataUrl: string | undefined) => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drawing = useRef(false);
  const [dirty, setDirty] = useState(false);

  function pos(e: React.PointerEvent<HTMLCanvasElement>) {
    const c = canvasRef.current!;
    const r = c.getBoundingClientRect();
    return { x: ((e.clientX - r.left) / r.width) * c.width, y: ((e.clientY - r.top) / r.height) * c.height };
  }

  function start(e: React.PointerEvent<HTMLCanvasElement>) {
    drawing.current = true;
    const ctx = canvasRef.current!.getContext("2d")!;
    const { x, y } = pos(e);
    ctx.beginPath();
    ctx.moveTo(x, y);
    canvasRef.current!.setPointerCapture(e.pointerId);
  }

  function move(e: React.PointerEvent<HTMLCanvasElement>) {
    if (!drawing.current) return;
    const ctx = canvasRef.current!.getContext("2d")!;
    ctx.lineWidth = 2;
    ctx.lineCap = "round";
    ctx.strokeStyle = "#17140f";
    const { x, y } = pos(e);
    ctx.lineTo(x, y);
    ctx.stroke();
    setDirty(true);
  }

  function end() {
    if (!drawing.current) return;
    drawing.current = false;
    if (dirty) onChange(canvasRef.current!.toDataURL("image/png"));
  }

  function clear() {
    const c = canvasRef.current!;
    c.getContext("2d")!.clearRect(0, 0, c.width, c.height);
    setDirty(false);
    onChange(undefined);
  }

  return (
    <div>
      <span className="label-eyebrow mb-1.5 block">Signature (facultative)</span>
      <div className="rounded-md border border-line bg-surface-2">
        <canvas
          ref={canvasRef}
          width={480}
          height={120}
          className="h-[120px] w-full touch-none rounded-md"
          onPointerDown={start}
          onPointerMove={move}
          onPointerUp={end}
          onPointerLeave={end}
        />
      </div>
      <div className="mt-1 flex items-center justify-between">
        <span className="text-[0.68rem] text-muted">
          Tracée et conservée sur cet appareil ; jointe au PDF.
        </span>
        {(dirty || value) && (
          <button
            type="button"
            onClick={clear}
            className="text-[0.7rem] text-muted underline-offset-2 hover:text-risk-high hover:underline"
          >
            Effacer
          </button>
        )}
      </div>
    </div>
  );
}
