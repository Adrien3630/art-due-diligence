"use client";

import { useCallback, useRef, useState } from "react";

/*
  Zone de dépôt de la photo de l'œuvre.
  L'image est lue en data-URL côté navigateur (FileReader) et n'est JAMAIS
  envoyée sur le réseau : elle sert d'aperçu et figure dans le rapport PDF
  généré localement. Aucune analyse automatique n'est faite sur l'image —
  on ne prétend pas authentifier l'œuvre.
*/

export function ImageDropzone({
  value,
  fileName,
  onChange,
  label = "Photographie de l'œuvre",
  hint = "ou cliquez pour parcourir · JPEG, PNG · reste sur cet appareil",
  required = false,
}: {
  value: string | null;
  fileName: string | null;
  onChange: (dataUrl: string | null, name: string | null) => void;
  label?: string;
  hint?: string;
  required?: boolean;
}) {
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const readFile = useCallback(
    (file: File) => {
      if (!file.type.startsWith("image/")) return;
      const reader = new FileReader();
      reader.onload = () => onChange(reader.result as string, file.name);
      reader.readAsDataURL(file);
    },
    [onChange],
  );

  return (
    <div>
      <span className="label-eyebrow block mb-1.5">
        {label}
        {required && <span className="ml-1 text-risk-high">*</span>}
      </span>

      {value ? (
        <div className="group relative overflow-hidden rounded-lg border border-line bg-surface-2">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={value}
            alt={label}
            className="block max-h-72 w-full object-contain"
          />
          <div className="flex items-center justify-between border-t border-line px-3 py-2">
            <span className="truncate text-[0.72rem] text-muted">
              {fileName ?? "image"}
            </span>
            <button
              type="button"
              onClick={() => onChange(null, null)}
              className="text-[0.72rem] text-ink-soft underline-offset-2 hover:text-risk-high hover:underline"
            >
              Retirer
            </button>
          </div>
        </div>
      ) : (
        <div
          onDragOver={(e) => {
            e.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragging(false);
            const file = e.dataTransfer.files?.[0];
            if (file) readFile(file);
          }}
          onClick={() => inputRef.current?.click()}
          className={[
            "flex cursor-pointer flex-col items-center justify-center rounded-lg border border-dashed px-6 py-12 text-center transition-colors",
            dragging
              ? "border-gold bg-surface-2"
              : "border-line-strong bg-surface hover:border-gold/60",
          ].join(" ")}
        >
          <div className="font-serif text-3xl text-line-strong">⌖</div>
          <p className="mt-3 text-sm text-ink-soft">Glissez le fichier ici</p>
          <p className="mt-1 text-[0.72rem] text-muted">{hint}</p>
          <input
            ref={inputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) readFile(file);
            }}
          />
        </div>
      )}
    </div>
  );
}
