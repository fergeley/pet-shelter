"use client";

import React, { useCallback, useRef, useState } from "react";
import { AlertCircle, Loader2, QrCode, Upload, X } from "lucide-react";
import { isSafeQrImageUrl, QR_UPLOAD_MIME_TYPES } from "@/lib/domain/qrCode";

/** 2 MB. A QR photo has no business being larger, and /api/upload caps at 5 MB. */
const MAX_QR_FILE_SIZE = 2 * 1024 * 1024;

interface QrImageUploadProps {
  value: string;
  onChange: (url: string) => void;
  label: string;
  description?: string;
  disabled?: boolean;
}

/**
 * Uploads a donation QR image.
 *
 * Deliberately does NOT reuse `ImageUpload`. That component runs every file
 * through `optimizeImageForUpload`, which re-encodes to lossy WebP at quality
 * 0.85 and downscales to 1600px. Those are good defaults for a photo of a dog
 * and bad ones for a QR code: lossy artefacts soften the module edges that a
 * scanner thresholds on, and a downscale can merge adjacent modules outright.
 * The bytes the admin selected are uploaded unchanged.
 *
 * SVG is not accepted. An SVG served from our own origin under `/uploads/` can
 * carry an inline <script>, which would be stored XSS. Admins with an SVG-only
 * QR should paste the payload into the auto-generate field instead.
 */
export function QrImageUpload({
  value,
  onChange,
  label,
  description,
  disabled = false,
}: QrImageUploadProps) {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFile = useCallback(
    async (file: File) => {
      setError(null);

      if (!(QR_UPLOAD_MIME_TYPES as readonly string[]).includes(file.type)) {
        setError(
          file.type === "image/svg+xml"
            ? "SVG uploads are not accepted. Paste the payment string into Auto-Generate instead."
            : "QR code must be a PNG, JPEG, or WebP image."
        );
        return;
      }

      if (file.size > MAX_QR_FILE_SIZE) {
        setError(`QR image must be under ${MAX_QR_FILE_SIZE / (1024 * 1024)} MB.`);
        return;
      }

      setUploading(true);
      try {
        const body = new FormData();
        body.append("file", file);

        const res = await fetch("/api/upload", { method: "POST", body });
        const json = await res.json();

        if (!res.ok) {
          throw new Error(json?.error || `Upload failed with HTTP ${res.status}`);
        }
        if (typeof json?.url !== "string" || !isSafeQrImageUrl(json.url)) {
          throw new Error("Upload returned an unusable image location.");
        }

        onChange(json.url);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Upload failed.");
      } finally {
        setUploading(false);
      }
    },
    [onChange]
  );

  const handleSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) void handleFile(file);
    if (inputRef.current) inputRef.current.value = "";
  };

  const handleClear = () => {
    setError(null);
    onChange("");
  };

  const hasImage = value.trim() !== "" && isSafeQrImageUrl(value);

  return (
    <div className="space-y-2">
      <div className="flex items-start justify-between gap-3">
        <div className="space-y-0.5">
          <span className="text-sm font-semibold block text-foreground">{label}</span>
          {description && <p className="text-xs text-muted-foreground">{description}</p>}
        </div>
        {hasImage && !disabled && (
          <button
            type="button"
            onClick={handleClear}
            className="inline-flex items-center gap-1 text-[11px] font-semibold text-destructive hover:underline shrink-0"
          >
            <X className="size-3" /> Remove
          </button>
        )}
      </div>

      <div className="flex items-center gap-4">
        <div className="size-28 shrink-0 border border-border rounded-lg bg-white flex items-center justify-center overflow-hidden relative">
          {hasImage ? (
            // Plain <img> for the same reasons as the public panel: no lossy
            // re-encoding of a QR, and no remotePatterns gate on the host.
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={value}
              alt={`${label} preview`}
              className="absolute inset-0 size-full object-contain p-1"
            />
          ) : (
            <QrCode className="size-8 text-muted-foreground/50" aria-hidden="true" />
          )}
        </div>

        <div className="space-y-2 min-w-0">
          <input
            ref={inputRef}
            type="file"
            accept={QR_UPLOAD_MIME_TYPES.join(",")}
            onChange={handleSelect}
            disabled={disabled || uploading}
            className="hidden"
          />
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            disabled={disabled || uploading}
            className="inline-flex items-center gap-2 px-3 py-2 text-xs font-semibold border border-border rounded-lg bg-card hover:bg-accent transition-colors disabled:opacity-50"
          >
            {uploading ? (
              <>
                <Loader2 className="size-3.5 animate-spin" /> Uploading…
              </>
            ) : (
              <>
                <Upload className="size-3.5" /> {hasImage ? "Replace image" : "Upload QR image"}
              </>
            )}
          </button>
          <p className="text-[11px] text-muted-foreground">
            PNG, JPEG or WebP, under 2 MB. Uploaded as-is — no compression, so the
            code stays scannable.
          </p>
          {hasImage && (
            <p className="text-[11px] font-mono text-muted-foreground truncate" title={value}>
              {value}
            </p>
          )}
        </div>
      </div>

      {error && (
        <div className="flex items-start gap-2 p-2.5 bg-destructive/10 border border-destructive/30 rounded-lg">
          <AlertCircle className="size-3.5 text-destructive shrink-0 mt-0.5" />
          <p className="text-[11px] text-destructive font-medium">{error}</p>
        </div>
      )}
    </div>
  );
}
