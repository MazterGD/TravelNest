"use client";

import { useRef, useState } from "react";
import { Upload, CheckCircle, X, FileText } from 'lucide-react';
import { cn } from "@/lib/utils/cn";
import { useTranslations } from "next-intl";

export interface UploadedFile {
  file: File;
  preview?: string;
}

export interface ExistingFile {
  url: string;
  fileName: string;
  fileSize?: number;
  status?: string;
}

interface FileUploadProps {
  label: string;
  required?: boolean;
  accept?: string;
  maxSize?: number; // in MB
  value?: UploadedFile | null;
  existingFile?: ExistingFile | null;
  onChange: (file: UploadedFile | null) => void;
  error?: string;
  helpText?: string;
  className?: string;
}

export function FileUpload({
  label,
  required = false,
  accept = ".pdf,.jpg,.jpeg,.png",
  maxSize = 5,
  value,
  existingFile,
  onChange,
  error,
  helpText,
  className,
}: FileUploadProps) {
  const t = useTranslations("fileUpload");
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragActive, setDragActive] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);

  const handleFileSelect = (file: File | null) => {
    setLocalError(null);

    if (!file) {
      onChange(null);
      return;
    }

    // Validate file size
    if (file.size > maxSize * 1024 * 1024) {
      setLocalError(t("errors.maxSize", { maxSize }));
      return;
    }

    // Validate file type
    const allowedTypes = accept.split(",").map((t) => t.trim().toLowerCase());
    const fileExtension = `.${file.name.split(".").pop()?.toLowerCase()}`;
    const fileMimeType = file.type.toLowerCase();

    const isValidType = allowedTypes.some((type) => {
      if (type.startsWith(".")) {
        return fileExtension === type;
      }
      return fileMimeType.includes(type.replace("*", ""));
    });

    if (!isValidType) {
      setLocalError(t("errors.invalidType", { types: accept }));
      return;
    }

    // Create preview for images
    let preview: string | undefined;
    if (file.type.startsWith("image/")) {
      preview = URL.createObjectURL(file);
    }

    onChange({ file, preview });
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
      handleFileSelect(e.dataTransfer.files[0]);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      handleFileSelect(e.target.files[0]);
    }
  };

  const handleRemove = () => {
    if (value?.preview) {
      URL.revokeObjectURL(value.preview);
    }
    onChange(null);
    if (inputRef.current) {
      inputRef.current.value = "";
    }
  };

  const displayError = error || localError;
  const isImage = value?.file.type.startsWith("image/");
  const isExistingImage = existingFile?.fileName
    ? /\.(jpg|jpeg|png|webp|gif)$/i.test(existingFile.fileName)
    : false;

  const statusLabel = (status?: string) => {
    if (!status) return null;
    const s = status.toUpperCase();
    if (s === "VERIFIED")
      return (
        <span className="flex items-center gap-1 rounded-lg bg-[var(--color-success-bg)] px-2 py-0.5 text-xs font-medium text-[var(--color-success-text)]">
          <CheckCircle className="h-3 w-3" />
          {t("verified")}
        </span>
      );
    if (s === "REJECTED")
      return (
        <span className="rounded-lg bg-[var(--color-error-bg)] px-2 py-0.5 text-xs font-medium text-[var(--color-error-text)]">
          {t("rejected")}
        </span>
      );
    return (
      <span className="rounded-lg bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
        {t("pending")}
      </span>
    );
  };

  return (
    <div className={cn("w-full", className)}>
      <div className="flex items-center justify-between mb-3">
        <label className="text-lg font-semibold text-foreground">
          {label} {required && "*"}
        </label>
        {(value || existingFile) && (
          <span className="flex items-center gap-2 text-sm text-success">
            <CheckCircle className="w-4 h-4" />
            {t("uploaded")}
          </span>
        )}
      </div>

      <div
        className={cn(
          "rounded-[20px] border-2 border-dashed p-6 transition-all",
          dragActive
            ? "border-primary bg-primary/5"
            : displayError
              ? "border-error-border bg-error-bg"
              : "border-border hover:border-primary/50",
        )}
        onDragEnter={handleDrag}
        onDragLeave={handleDrag}
        onDragOver={handleDrag}
        onDrop={handleDrop}
      >
        {value ? (
          <div className="flex items-center gap-4">
            {/* File Preview */}
            <div className="flex-shrink-0">
              {isImage && value.preview ? (
                <div className="h-16 w-16 overflow-hidden rounded-lg bg-muted">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={value.preview}
                    alt="Preview"
                    className="w-full h-full object-cover"
                  />
                </div>
              ) : (
                <div className="flex h-16 w-16 items-center justify-center rounded-lg bg-muted">
                  <FileText className="w-8 h-8 text-muted-foreground" />
                </div>
              )}
            </div>

            {/* File Info */}
            <div className="flex-1 min-w-0">
              <p className="truncate font-medium text-foreground">
                {value.file.name}
              </p>
              <p className="text-sm text-muted-foreground">
                {(value.file.size / 1024 / 1024).toFixed(2)} MB
              </p>
            </div>

            {/* Remove Button */}
            <button
              type="button"
              onClick={handleRemove}
              className="rounded-xl bg-error-bg p-3 text-error hover:bg-error-bg/80 transition-all"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        ) : existingFile ? (
          <div className="space-y-3">
            {/* Existing file display */}
            <div className="flex items-center gap-4 rounded-xl border border-border bg-card p-3">
              <div className="flex-shrink-0">
                {isExistingImage ? (
                  <div className="h-16 w-16 overflow-hidden rounded-lg bg-muted">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={existingFile.url}
                      alt={existingFile.fileName}
                      className="w-full h-full object-cover"
                    />
                  </div>
                ) : (
                  <div className="flex h-16 w-16 items-center justify-center rounded-lg bg-muted">
                    <FileText className="w-8 h-8 text-muted-foreground" />
                  </div>
                )}
              </div>
              <div className="flex-1 min-w-0">
                <p className="truncate font-medium text-foreground">
                  {existingFile.fileName}
                </p>
                <div className="flex items-center gap-2 mt-1">
                  {existingFile.fileSize != null && (
                    <span className="text-sm text-muted-foreground">
                      {(existingFile.fileSize / 1024 / 1024).toFixed(2)} MB
                    </span>
                  )}
                  {statusLabel(existingFile.status)}
                </div>
              </div>
            </div>
            {/* Replace option */}
            <label className="flex flex-col items-center cursor-pointer">
              <div className="flex w-full items-center justify-center gap-3 rounded-xl border border-border bg-muted px-6 py-3 transition-all hover:bg-muted/80">
                <Upload className="h-5 w-5 text-muted-foreground" />
                <span className="text-sm font-medium text-muted-foreground">
                  {t("replace")}
                </span>
              </div>
              <input
                ref={inputRef}
                type="file"
                accept={accept}
                onChange={handleInputChange}
                className="hidden"
              />
            </label>
          </div>
        ) : (
          <label className="flex flex-col items-center cursor-pointer">
            <div className="flex w-full items-center justify-center gap-3 rounded-xl border border-border bg-muted px-6 py-4 transition-all hover:bg-muted/80">
              <Upload className="h-6 w-6 text-muted-foreground" />
              <span className="font-medium text-muted-foreground">
                {t("prompt")}
              </span>
            </div>
            <input
              ref={inputRef}
              type="file"
              accept={accept}
              onChange={handleInputChange}
              className="hidden"
              required={required && !value && !existingFile}
            />
          </label>
        )}
      </div>

      {displayError && (
        <p className="mt-2 text-sm text-error">{displayError}</p>
      )}

      {helpText && !displayError && (
        <p className="mt-2 text-sm text-muted-foreground">{helpText}</p>
      )}
    </div>
  );
}

// Multi-file upload for documents
interface DocumentUploadGroupProps {
  documents: {
    key: string;
    label: string;
    required: boolean;
    helpText?: string;
  }[];
  values: Record<string, UploadedFile | null>;
  onChange: (key: string, file: UploadedFile | null) => void;
  errors?: Record<string, string>;
}

export function DocumentUploadGroup({
  documents,
  values,
  onChange,
  errors,
}: DocumentUploadGroupProps) {
  const t = useTranslations("fileUpload");

  return (
    <div className="space-y-6">
      {documents.map((doc) => (
        <FileUpload
          key={doc.key}
          label={doc.label}
          required={doc.required}
          value={values[doc.key]}
          onChange={(file) => onChange(doc.key, file)}
          error={errors?.[doc.key]}
          helpText={doc.helpText || t("helpText")}
        />
      ))}
    </div>
  );
}
