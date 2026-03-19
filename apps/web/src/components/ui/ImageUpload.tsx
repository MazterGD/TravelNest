"use client";

import React, { useState } from "react";
import { FaCamera, FaTimes } from "react-icons/fa";

interface ImageUploadProps {
  label: string;
  value: File | null;
  onChange: (file: File | null) => void;
  preview?: string; // URL for preview
  maxSize?: number; // in MB
  required?: boolean;
  helperText?: string;
  error?: string;
  aspectRatio?: "square" | "video" | "wide"; // aspect-[1/1], aspect-video, aspect-[16/9]
}

export const ImageUpload: React.FC<ImageUploadProps> = ({
  label,
  value: _value,
  onChange,
  preview,
  maxSize = 5,
  required = false,
  helperText,
  error,
  aspectRatio = "video",
}) => {
  const [dragActive, setDragActive] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(preview || null);
  void _value;

  const aspectClasses = {
    square: "aspect-square",
    video: "aspect-video",
    wide: "aspect-[16/9]",
  };

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFile(e.dataTransfer.files[0]);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      handleFile(e.target.files[0]);
    }
  };

  const handleFile = (file: File) => {
    // Check file size
    if (file.size > maxSize * 1024 * 1024) {
      alert(`Image size must be less than ${maxSize}MB`);
      return;
    }

    // Check if it's an image
    if (!file.type.startsWith("image/")) {
      alert("Please upload an image file");
      return;
    }

    // Create preview
    const url = URL.createObjectURL(file);
    setPreviewUrl(url);
    onChange(file);
  };

  const handleRemove = () => {
    if (previewUrl && !preview) {
      URL.revokeObjectURL(previewUrl);
    }
    setPreviewUrl(null);
    onChange(null);
  };

  return (
    <div className="w-full">
      {label && (
        <label className="mb-2 block text-sm font-medium text-foreground">
          {label}
          {required && <span className="ml-1 text-error">*</span>}
        </label>
      )}

      <div
        onDragEnter={handleDrag}
        onDragLeave={handleDrag}
        onDragOver={handleDrag}
        onDrop={handleDrop}
        className={`
          group relative overflow-hidden rounded-lg border-2 border-dashed transition-colors
          ${aspectClasses[aspectRatio]}
          ${dragActive ? "border-primary bg-primary/10" : error ? "border-error-border bg-error-bg" : "border-border bg-muted hover:border-muted-foreground"}
        `}
      >
        {previewUrl ? (
          <>
            <img
              src={previewUrl}
              alt="Preview"
              className="h-full w-full object-cover"
            />
            <button
              type="button"
              onClick={handleRemove}
              className="absolute right-2 top-2 rounded-full bg-error p-2 text-white opacity-0 shadow-lg transition-opacity group-hover:opacity-100"
            >
              <FaTimes className="h-4 w-4" />
            </button>
          </>
        ) : (
          <label className="flex h-full w-full cursor-pointer flex-col items-center justify-center">
            <input
              type="file"
              onChange={handleChange}
              accept="image/*"
              className="hidden"
            />
            <FaCamera className="mb-3 h-10 w-10 text-muted-foreground" />
            <div className="mb-1 font-medium text-foreground">
              Click to upload or drag and drop
            </div>
            <p className="text-xs text-muted-foreground">
              PNG, JPG, GIF up to {maxSize}MB
            </p>
          </label>
        )}
      </div>

      {error && <p className="mt-1 text-sm text-error">{error}</p>}
      {helperText && !error && (
        <p className="mt-1 text-sm text-muted-foreground">{helperText}</p>
      )}
    </div>
  );
};
