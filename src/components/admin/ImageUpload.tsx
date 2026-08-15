"use client";

import React, { useRef, useState, useCallback } from "react";
import Image from "next/image";
import { Upload, X, Loader2, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";

interface UploadedImage {
  url: string;
  name: string;
  size: number;
}

interface ImageUploadProps {
  maxImages?: number;
  onImagesChange: (images: UploadedImage[]) => void;
  initialImages?: UploadedImage[];
  label?: string;
  description?: string;
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
  const [uploadProgress, setUploadProgress] = useState<Record<string, number>>({});
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const dragCounterRef = useRef(0);

  const canAddMore = images.length < maxImages;

  const handleUpload = useCallback(
    async (files: File[]) => {
      setError(null);

      // Validate file types and count
      const validImages = files.filter((file) => {
        if (!file.type.startsWith("image/")) {
          setError("Only image files are allowed");
          return false;
        }
        if (file.size > 5 * 1024 * 1024) {
          // 5MB limit
          setError("File size must be less than 5MB");
          return false;
        }
        return true;
      });

      if (validImages.length === 0) return;

      const availableSlots = maxImages - images.length;
      const filesToUpload = validImages.slice(0, availableSlots);

      setUploading(true);

      try {
        for (const file of filesToUpload) {
          const formData = new FormData();
          formData.append("file", file);

          const progressKey = file.name + Date.now();
          setUploadProgress((prev) => ({ ...prev, [progressKey]: 0 }));

          const xhr = new XMLHttpRequest();

          // Track upload progress
          xhr.upload.addEventListener("progress", (e) => {
            if (e.lengthComputable) {
              const percentComplete = Math.round((e.loaded / e.total) * 100);
              setUploadProgress((prev) => ({
                ...prev,
                [progressKey]: percentComplete,
              }));
            }
          });

          // Handle completion
          await new Promise<void>((resolve, reject) => {
            xhr.addEventListener("load", () => {
              if (xhr.status === 200) {
                const response = JSON.parse(xhr.responseText);
                const newImage: UploadedImage = {
                  url: response.url,
                  name: file.name,
                  size: file.size,
                };
                setImages((prev) => [...prev, newImage]);
                setUploadProgress((prev) => {
                  const updated = { ...prev };
                  delete updated[progressKey];
                  return updated;
                });
                resolve();
              } else {
                reject(new Error("Upload failed"));
              }
            });

            xhr.addEventListener("error", () => {
              reject(new Error("Upload error"));
            });

            xhr.open("POST", "/api/upload");
            xhr.send(formData);
          });
        }

        // Notify parent component after all uploads complete
        setImages((updatedImages) => {
          onImagesChange(updatedImages);
          return updatedImages;
        });
      } catch (err) {
        setError(`Upload failed: ${err instanceof Error ? err.message : "Unknown error"}`);
        console.error("Upload error:", err);
      } finally {
        setUploading(false);
      }
    },
    [images.length, maxImages, onImagesChange]
  );

  const handleDragEnter = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounterRef.current++;
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
      // Reset input
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  const handleRemoveImage = (index: number) => {
    const newImages = images.filter((_, i) => i !== index);
    setImages(newImages);
    onImagesChange(newImages);
  };

  return (
    <div className="space-y-4">
      <div className="space-y-1.5">
        <label className="text-sm font-semibold block">{label}</label>
        <p className="text-xs text-muted-foreground">{description}</p>
      </div>

      {/* Image Previews Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {images.map((image, index) => (
          <div
            key={`${image.name}-${index}`}
            className="relative aspect-square border border-border bg-muted rounded-lg overflow-hidden group"
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
              onClick={() => handleRemoveImage(index)}
              className="absolute top-1 right-1 bg-destructive text-destructive-foreground rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity"
              aria-label="Remove image"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        ))}

        {/* Upload Dropzone (shown if can add more) */}
        {canAddMore && (
          <div
            onDragEnter={handleDragEnter}
            onDragLeave={handleDragLeave}
            onDragOver={handleDragOver}
            onDrop={handleDrop}
            className="aspect-square border-2 border-dashed border-muted-foreground rounded-lg bg-muted hover:border-foreground hover:bg-accent transition-colors cursor-pointer flex items-center justify-center"
          >
            <input
              ref={fileInputRef}
              type="file"
              multiple
              accept="image/*"
              onChange={handleFileSelect}
              disabled={uploading}
              className="hidden"
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
              className="w-full h-full flex flex-col items-center justify-center gap-2 p-4"
            >
              {uploading ? (
                <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
              ) : (
                <>
                  <Upload className="w-6 h-6 text-muted-foreground" />
                  <span className="text-xs font-medium text-muted-foreground text-center">
                    {images.length}/{maxImages}
                  </span>
                </>
              )}
            </button>
          </div>
        )}
      </div>

      {/* Upload Progress Bars */}
      {Object.keys(uploadProgress).length > 0 && (
        <div className="space-y-2">
          {Object.entries(uploadProgress).map(([key, progress]) => (
            <div key={key} className="space-y-1">
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>Uploading...</span>
                <span>{progress}%</span>
              </div>
              <div className="h-2 bg-muted rounded-full overflow-hidden">
                <div
                  className="h-full bg-foreground transition-all duration-200"
                  style={{ width: `${progress}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Error Message */}
      {error && (
        <div className="flex items-center gap-2 p-3 bg-destructive/10 border border-destructive/30 rounded-lg">
          <AlertCircle className="w-4 h-4 text-destructive flex-shrink-0" />
          <p className="text-sm text-destructive">{error}</p>
        </div>
      )}

      {/* Full */}
      {!canAddMore && (
        <p className="text-xs text-muted-foreground text-center py-2">
          Maximum of {maxImages} images reached
        </p>
      )}
    </div>
  );
}
