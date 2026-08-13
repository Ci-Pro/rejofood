"use client";

import { useState, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ImagePlus, X, Loader2, AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

interface ImageUploaderProps {
  /** Current image URL (if any) */
  value: string | null;
  /** Callback when image uploaded/removed */
  onChange: (url: string | null) => void;
  /** Upload folder (e.g., "menu", "logo") */
  folder?: string;
  /** Shape: "square" for menu items, "rounded" for logos */
  shape?: "square" | "rounded";
  /** Size in px */
  size?: number;
  /** Label text */
  label?: string;
}

export function ImageUploader({
  value,
  onChange,
  folder = "menu",
  shape = "square",
  size = 96,
  label = "Foto",
}: ImageUploaderProps) {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFile = useCallback(async (file: File) => {
    setError(null);

    // Validate
    if (!file.type.startsWith("image/")) {
      setError("File harus berupa gambar.");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setError("Ukuran maksimal 5MB.");
      return;
    }

    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("folder", folder);

      const res = await fetch("/api/upload", {
        method: "POST",
        body: formData,
      });
      const data = await res.json();
      if (!res.ok) {
        if (data.code === "CLOUDINARY_NOT_CONFIGURED") {
          setError("Upload belum dikonfigurasi. Hubungi admin.");
          toast.error("Cloudinary belum di-setup. Image upload tidak tersedia.");
        } else {
          setError(data?.error || "Gagal upload.");
          toast.error(data?.error || "Gagal upload image.");
        }
        return;
      }
      onChange(data.url);
      toast.success("Image berhasil diupload.");
    } catch {
      setError("Koneksi bermasalah.");
      toast.error("Koneksi bermasalah.");
    } finally {
      setUploading(false);
    }
  }, [folder, onChange]);

  function handleInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
    // Reset input so same file can be selected again
    e.target.value = "";
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file) handleFile(file);
  }

  function handleRemove() {
    onChange(null);
  }

  return (
    <div className="flex flex-col gap-2">
      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/gif"
        onChange={handleInputChange}
        className="hidden"
      />

      <div className="flex items-center gap-3">
        {/* Image preview / upload zone */}
        <div
          onClick={() => !uploading && inputRef.current?.click()}
          onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={handleDrop}
          className={cn(
            "relative flex shrink-0 cursor-pointer items-center justify-center overflow-hidden border-2 border-dashed transition-premium press-feedback",
            shape === "rounded" ? "rounded-full" : "rounded-xl",
            dragOver ? "border-saffron bg-saffron/5" : "border-border bg-muted/30 hover:border-saffron/40",
            uploading && "cursor-wait",
          )}
          style={{ width: size, height: size }}
        >
          {value ? (
            <>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={value}
                alt="Preview"
                className="h-full w-full object-cover"
                style={{ borderRadius: shape === "rounded" ? "9999px" : undefined }}
              />
              {/* Overlay on hover */}
              <div className="absolute inset-0 flex items-center justify-center bg-black/50 opacity-0 transition-opacity hover:opacity-100">
                <ImagePlus className="h-5 w-5 text-white" />
              </div>
            </>
          ) : uploading ? (
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          ) : (
            <div className="flex flex-col items-center gap-1">
              <ImagePlus className="h-5 w-5 text-muted-foreground" />
              <span className="text-[0.55rem] text-muted-foreground">Upload</span>
            </div>
          )}
        </div>

        {/* Info + actions */}
        <div className="flex-1">
          <p className="text-xs font-600 text-foreground">{label}</p>
          <p className="text-[0.65rem] text-muted-foreground">
            {value ? "Klik untuk ganti · " : ""}JPG/PNG/WebP · maks 5MB
          </p>
          {value && (
            <button
              type="button"
              onClick={handleRemove}
              className="mt-1 flex items-center gap-1 text-[0.65rem] font-600 text-destructive hover:underline"
            >
              <X className="h-2.5 w-2.5" />
              Hapus foto
            </button>
          )}
        </div>
      </div>

      <AnimatePresence>
        {error && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="flex items-center gap-1.5 rounded-lg border border-destructive/30 bg-destructive/5 p-2 text-[0.65rem] text-destructive"
          >
            <AlertCircle className="h-3 w-3 shrink-0" />
            {error}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
