import React, { useRef, useState, useCallback } from "react";

interface FileUploadProps {
  accept: string;
  maxSizeMB: number;
  label: string;
  value?: File | null;
  currentUrl?: string;
  onChange: (file: File | null) => void;
}

export function FileUpload({
  accept,
  maxSizeMB,
  label,
  value,
  currentUrl,
  onChange,
}: FileUploadProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const validateAndSet = useCallback(
    (file: File) => {
      setError(null);
      const maxBytes = maxSizeMB * 1024 * 1024;
      if (file.size > maxBytes) {
        setError(`File too large. Max size: ${maxSizeMB}MB`);
        return;
      }
      const acceptedTypes = accept.split(",").map((t) => t.trim());
      const parts = file.name.split(".");
      const ext = parts.length > 1 ? "." + parts.pop()!.toLowerCase() : "";
      const matches = acceptedTypes.some(
        (t) =>
          (ext && t.toLowerCase() === ext) ||
          (file.type && t === file.type) ||
          (file.type && t.endsWith("/*") && file.type.startsWith(t.replace("/*", "/")))
      );
      if (!ext || !matches) {
        setError(`Invalid file type. Accepted: ${accept}`);
        return;
      }
      onChange(file);
    },
    [accept, maxSizeMB, onChange]
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragOver(false);
      const file = e.dataTransfer.files[0];
      if (file) validateAndSet(file);
    },
    [validateAndSet]
  );

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) validateAndSet(file);
  };

  const fileName = value?.name;

  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
      <div
        className={`border-2 border-dashed rounded-lg p-4 sm:p-6 text-center cursor-pointer transition-colors ${
          dragOver
            ? "border-primary-500 bg-primary-50"
            : "border-gray-300 hover:border-gray-400"
        }`}
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
        onClick={() => inputRef.current?.click()}
      >
        <input
          ref={inputRef}
          type="file"
          accept={accept}
          onChange={handleChange}
          className="hidden"
        />
        {fileName ? (
          <div className="flex items-center justify-center gap-2">
            <svg className="h-5 w-5 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
            <span className="text-sm text-gray-700">{fileName}</span>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onChange(null);
                if (inputRef.current) inputRef.current.value = "";
              }}
              className="text-gray-400 hover:text-gray-600 ml-2"
            >
              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        ) : currentUrl ? (
          <p className="text-sm text-gray-500">
            Current file set. Drop a new file or click to replace.
          </p>
        ) : (
          <div>
            <svg className="mx-auto h-8 w-8 text-gray-400 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
            </svg>
            <p className="text-sm text-gray-500">
              Drag & drop or click to upload
            </p>
            <p className="text-xs text-gray-400 mt-1">Max {maxSizeMB}MB</p>
          </div>
        )}
      </div>
      {error && <p className="mt-1 text-xs text-red-500">{error}</p>}
    </div>
  );
}
