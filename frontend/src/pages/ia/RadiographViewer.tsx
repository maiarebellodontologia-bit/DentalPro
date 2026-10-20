import React, { useRef, useState } from "react";
import { Finding, IAStatus, URGENCY_STYLE } from "../../services/iaApi";

interface Props {
  src: string;
  findings: Finding[];
  status: IAStatus;
  activeId?: number | null;
  onSelect?: (id: number) => void;
  // Quando definido, arrastar sobre a imagem desenha uma nova caixa.
  onDraw?: (box: { x: number; y: number; w: number; h: number }) => void;
}

export const RadiographViewer: React.FC<Props> = ({ src, findings, status, activeId, onSelect, onDraw }) => {
  const svgRef = useRef<SVGSVGElement>(null);
  const [drag, setDrag] = useState<{ x0: number; y0: number; x: number; y: number } | null>(null);
  const [bright, setBright] = useState(100);
  const [contrast, setContrast] = useState(100);
  const [invert, setInvert] = useState(false);

  const point = (e: React.PointerEvent) => {
    const r = svgRef.current!.getBoundingClientRect();
    return {
      x: Math.min(1, Math.max(0, (e.clientX - r.left) / r.width)),
      y: Math.min(1, Math.max(0, (e.clientY - r.top) / r.height)),
    };
  };

  const finish = () => {
    if (drag && onDraw) {
      const box = {
        x: Math.min(drag.x0, drag.x),
        y: Math.min(drag.y0, drag.y),
        w: Math.abs(drag.x - drag.x0),
        h: Math.abs(drag.y - drag.y0),
      };
      if (box.w > 0.01 && box.h > 0.01) onDraw(box);
    }
    setDrag(null);
  };

  const visible = findings.filter((f) => f.status !== "rejected");

  return (
    <div>
      <div className="relative bg-black rounded-lg overflow-hidden select-none">
        <img
          src={src}
          alt="Radiografia"
          className="w-full block"
          style={{ filter: `brightness(${bright}%) contrast(${contrast}%)${invert ? " invert(1)" : ""}` }}
          draggable={false}
        />
        <svg
          ref={svgRef}
          viewBox="0 0 1 1"
          preserveAspectRatio="none"
          className={`absolute inset-0 w-full h-full ${onDraw ? "cursor-crosshair" : ""}`}
          onPointerDown={(e) => {
            if (!onDraw) return;
            const p = point(e);
            (e.target as Element).setPointerCapture?.(e.pointerId);
            setDrag({ x0: p.x, y0: p.y, ...p });
          }}
          onPointerMove={(e) => drag && setDrag({ ...drag, ...point(e) })}
          onPointerUp={finish}
        >
          {visible.map((f, i) => {
            const urg = status.findingTypes[f.type]?.urgency ?? "info";
            const active = f.id === activeId;
            return (
              <g key={f.id} onClick={() => onSelect?.(f.id)} className="cursor-pointer">
                <rect
                  x={f.x}
                  y={f.y}
                  width={f.w}
                  height={f.h}
                  fill={active ? `${URGENCY_STYLE[urg].box}33` : "transparent"}
                  stroke={URGENCY_STYLE[urg].box}
                  strokeWidth={active ? 3 : 2}
                  strokeDasharray={f.status === "suggested" ? "6 4" : undefined}
                  vectorEffect="non-scaling-stroke"
                />
              </g>
            );
          })}
          {drag && (
            <rect
              x={Math.min(drag.x0, drag.x)}
              y={Math.min(drag.y0, drag.y)}
              width={Math.abs(drag.x - drag.x0)}
              height={Math.abs(drag.y - drag.y0)}
              fill="#3b82f633"
              stroke="#3b82f6"
              strokeWidth={2}
              vectorEffect="non-scaling-stroke"
            />
          )}
        </svg>
        {visible.map((f, i) => {
          const urg = status.findingTypes[f.type]?.urgency ?? "info";
          return (
            <span
              key={f.id}
              className="absolute pointer-events-none text-[11px] font-bold text-white px-1.5 rounded -translate-y-full"
              style={{ left: `${f.x * 100}%`, top: `${f.y * 100}%`, background: URGENCY_STYLE[urg].box }}
            >
              {i + 1}
            </span>
          );
        })}
      </div>
      <div className="flex flex-wrap items-center gap-4 mt-3 text-sm text-gray-600">
        <label className="flex items-center gap-2">
          Brilho
          <input type="range" min={50} max={180} value={bright} onChange={(e) => setBright(+e.target.value)} />
        </label>
        <label className="flex items-center gap-2">
          Contraste
          <input type="range" min={50} max={250} value={contrast} onChange={(e) => setContrast(+e.target.value)} />
        </label>
        <button
          type="button"
          aria-pressed={invert}
          onClick={() => setInvert(!invert)}
          className={`px-3 py-1 rounded border ${invert ? "bg-gray-800 text-white" : "border-gray-300"}`}
        >
          Inverter
        </button>
      </div>
    </div>
  );
};

// Lê a imagem escolhida e devolve data URL e dimensões.
export const readImage = (file: File) =>
  new Promise<{ image: string; width: number; height: number }>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => resolve({ image: reader.result as string, width: img.naturalWidth, height: img.naturalHeight });
      img.onerror = reject;
      img.src = reader.result as string;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
