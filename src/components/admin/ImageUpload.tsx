"use client";

import React, { useRef, useState, useCallback, useId } from "react";
import Image from "next/image";
import { Upload, X, Loader2, AlertCircle, CheckCircle2 } from "lucide-react";
import { optimizeImageForUpload } from "@/lib/imageOptimization";

export interface UploadedImage {
  url: string;
  name: string;
  size: number;
  id?: string;
  originalSize?: number;
  compressionRatio?: number;
}

interface ImageUploadProps {
  maxImages?: number;
  onImagesChange: (images: UploadedImage[]) => void;
  initialImages?: UploadedImage[];
  label?: string;
  description?: string;
}

/**
 * Uploads a file with XMLHttpRequest to report authentic upload progress percentage.
 */
function uploadWithProgress(
  file: File,
  onProgress: (percent: number) => void
): Promise<{ success: boolean; url: string; filename: string; size: number }> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    const formData = new FormData();
    formData.append("file", file);

    xhr.upload.addEventListener("progress", (event) => {
      if (event.lengthComputable) {
        const percent = Math.round((event.loaded / event.total) * 100);
        onProgress(percent);
      }
    });

    xhr.addEventListener("load", () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        try {
          const json = JSON.parse(xhr.responseText);
          resolve(json);
        } catch {
          reject(new Error("Invalid JSON response from server"));
        }
      } else {
        try {
          const errData = JSON.parse(xhr.responseText);
          reject(new Error(errData.error || `Upload failed with HTTP ${xhr.status}`));
        } catch {
          reject(new Error(`Upload failed with HTTP ${xhr.status}`));
        }
      }
    });

    xhr.addEventListener("error", () => {
      reject(new Error("Network error occurred during upload"));
    });

    xhr.addEventListener("abort", () => {
      reject(new Error("Upload aborted"));
    });

    xhr.open("POST", "/api/upload");
    xhr.send(formData);
  });
}

export function ImageUpload({
  maxImages = 4,
  onImagesChange,
  initialImages = [],
  label = "Upload Images",
  description = `Drag and drop up to ${maxImages} images, or click to select`,
}: ImageUploadProps) {
  const [images, setImages] = useState<UploadedImage[]>(initialImages);
  const [uploading, setUploading] = useState(false);
  const [optimizing, setOptimizing] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<Record<string, number>>({});
  const [error, setError] = useState<string | null>(null);
  const [savingsInfo, setSavingsInfo] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const dragCounterRef = useRef(0);
  const dragTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const componentId = useId();

  const canAddMore = images.length < maxImages;

  /**
   * Clear error message with delay
   */
  const clearError = useCallback(() => {
    const timer = setTimeout(() => setError(null), 5000);
    return () => clearTimeout(timer);
  }, []);

  const handleUpload = useCallback(
    async (files: File[]) => {
      setError(null);
      setSavingsInfo(null);

      // Validate file types and initial raw size limit (15MB raw before WebP compression)
      const validImages = files.filter((file) => {
        if (!file.type.startsWith("image/")) {
          setError("Only image files (JPEG, PNG, WebP, GIF) are allowed.");
          return false;
        }
        if (file.size > 15 * 1024 * 1024) {
          setError("Raw file size must be less than 15MB.");
          return false;
        }
        return true;
      });

      if (validImages.length === 0) return;

      const availableSlots = maxImages - images.length;
      const filesToUpload = validImages.slice(0, availableSlots);

      setUploading(true);
      const newImages: UploadedImage[] = [];

      try {
        for (const rawFile of filesToUpload) {
          const progressKey = `${rawFile.name}-${Date.now()}`;
          setUploadProgress((prev) => ({ ...prev, [progressKey]: 0 }));

          // Step 1: Client-Side WebP Compression & Dimension Optimization
          setOptimizing(true);
          const { file: optimizedFile, originalSize, optimizedSize, compressionRatio } =
            await optimizeImageForUpload(rawFile, {
              maxWidth: 1600,
              maxHeight: 1600,
              quality: 0.85,
            });
          setOptimizing(false);

          if (compressionRatio > 10) {
            const kbSaved = Math.round((originalSize - optimizedSize) / 1024);
            setSavingsInfo(`Optimized: Saved ${kbSaved} KB (${compressionRatio}% reduction)`);
          }

          // Step 2: Upload with real-time XMLHttpRequest progress
          try {
            const data = await uploadWithProgress(optimizedFile, (percent) => {
              setUploadProgress((prev) => ({ ...prev, [progressKey]: percent }));
            });

            const newImage: UploadedImage = {
              url: data.url,
              name: rawFile.name,
              size: data.size,
              originalSize,
              compressionRatio,
              id: `${componentId}-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`,
            };
            newImages.push(newImage);

            setUploadProgress((prev) => {
              const updated = { ...prev };
              delete updated[progressKey];
              return updated;
            });
          } catch (err) {
            const errorMsg = err instanceof Error ? err.message : "Unknown error";
            setError(`Failed to upload ${rawFile.name}: ${errorMsg}`);
            throw err;
          }
        }

        // Update images state with new uploads
        setImages((prevImages) => {
          const combined = [...prevImages, ...newImages];
          setTimeout(() => onImagesChange(combined), 0);
          return combined;
        });
      } catch (err) {
        console.error("Upload error:", err);
        clearError();
      } finally {
        setUploading(false);
        setOptimizing(false);
      }
    },
    [images, maxImages, onImagesChange, componentId, clearError]
  );

  const handleDragEnter = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounterRef.current++;

    if (dragTimeoutRef.current) {
      clearTimeout(dragTimeoutRef.current);
    }

    if (e.dataTransfer.items && e.dataTransfer.items.length > 0 && canAddMore) {
      e.currentTarget.classList.add("border-foreground", "bg-accent");
    }
  };

  const handleDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounterRef.current--;

    if (dragCounterRef.current === 0) {
      e.currentTarget.classList.remove("border-foreground", "bg-accent");
    }
  };

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounterRef.current = 0;
    e.currentTarget.classList.remove("border-foreground", "bg-accent");

    if (canAddMore && e.dataTransfer.files) {
      const files = Array.from(e.dataTransfer.files);
      handleUpload(files);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const files = Array.from(e.target.files);
      handleUpload(files);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  const handleRemoveImage = (imageId: string | number) => {
    const targetImage = images.find((img, i) => (img.id ? img.id === imageId : i === imageId));
    const newImages = images.filter((img, i) => (img.id ? img.id !== imageId : i !== imageId));
    setImages(newImages);
    onImagesChange(newImages);

    // Asynchronously trigger server deletion for uploaded images if stored locally
    if (targetImage && targetImage.url.startsWith("/uploads/")) {
      const filename = targetImage.url.replace("/uploads/", "");
      fetch(`/api/upload?filename=${encodeURIComponent(filename)}`, { method: "DELETE" }).catch(
        () => {}
      );
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="space-y-1">
          <label className="text-sm font-semibold block">{label}</label>
          <p className="text-xs text-muted-foreground">{description}</p>
        </div>
        {savingsInfo && (
          <span className="inline-flex items-center gap-1 text-[11px] font-medium text-success-text bg-success-surface border border-success-border px-2 py-0.5 rounded">
            <CheckCircle2 className="w-3 h-3" />
            {savingsInfo}
          </span>
        )}
      </div>

      {/* Image Previews Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {images.map((image, index) => {
          const stableId = image.id || index;
          return (
            <div
              key={stableId}
              className="relative aspect-square border border-border bg-muted rounded-lg overflow-hidden group shadow-sm"
            >
              <Image
                src={image.url}
                alt={`Upload ${index + 1}`}
                fill
                className="object-cover"
                sizes="(max-width: 640px) 50vw, 150px"
              />
              <button
                type="button"
                onClick={() => handleRemoveImage(stableId)}
                className="absolute top-1.5 right-1.5 bg-destructive text-destructive-foreground rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity shadow-md"
                aria-label="Remove image"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          );
        })}

        {/* Upload Dropzone */}
        {canAddMore && (
          <div
            onDragEnter={handleDragEnter}
            onDragLeave={handleDragLeave}
            onDragOver={handleDragOver}
            onDrop={handleDrop}
            className="aspect-square border-2 border-dashed border-muted-foreground/40 rounded-lg bg-muted/50 hover:border-foreground hover:bg-accent transition-colors cursor-pointer flex items-center justify-center"
          >
            <input
              ref={fileInputRef}
              type="file"
              multiple
              accept="image/jpeg,image/png,image/webp,image/gif"
              onChange={handleFileSelect}
              disabled={uploading}
              className="hidden"
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
              className="w-full h-full flex flex-col items-center justify-center gap-2 p-4 text-center"
            >
              {uploading ? (
                <div className="flex flex-col items-center gap-1.5">
                  <Loader2 className="w-6 h-6 animate-spin text-foreground" />
                  <span className="text-[11px] text-muted-foreground">
                    {optimizing ? "Optimizing..." : "Uploading..."}
                  </span>
                </div>
              ) : (
                <>
                  <Upload className="w-5 h-5 text-muted-foreground" />
                  <span className="text-xs font-semibold text-foreground">Add Photo</span>
                  <span className="text-[11px] text-muted-foreground">
                    {images.length}/{maxImages} max
                  </span>
                </>
              )}
            </button>
          </div>
        )}
      </div>

      {/* Real-time Upload Progress Bars */}
      {Object.keys(uploadProgress).length > 0 && (
        <div className="space-y-2">
          {Object.entries(uploadProgress).map(([key, progress]) => (
            <div key={key} className="space-y-1">
              <div className="flex justify-between text-xs text-muted-foreground">
                <span className="font-mono">{key.split("-")[0]}</span>
                <span className="font-semibold">{progress}%</span>
              </div>
              <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                <div
                  className="h-full bg-primary transition-all duration-150"
                  style={{ width: `${progress}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Error Message */}
      {error && (
        <div className="flex items-center gap-2 p-3 bg-destructive/10 border border-destructive/30 rounded-lg animate-in">
          <AlertCircle className="w-4 h-4 text-destructive flex-shrink-0" />
          <p className="text-xs text-destructive font-medium">{error}</p>
        </div>
      )}
    </div>
  );
}
