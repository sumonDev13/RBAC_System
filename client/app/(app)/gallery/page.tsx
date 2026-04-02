"use client";

import { useEffect, useRef, useState } from "react";
import { useAppDispatch, useAppSelector } from "@/redux/hooks";
import {
  fetchMyPhotosThunk,
  uploadPhotosThunk,
  deletePhotoThunk,
  type Photo,
} from "@/redux/slices/photosSlice";

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

// ── Preview modal ─────────────────────────────────────────────────────────────

function PreviewModal({
  photo,
  onClose,
}: {
  photo: Photo;
  onClose: () => void;
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
      onClick={onClose}
    >
      <div
        className="relative max-h-[90vh] max-w-4xl"
        onClick={(e) => e.stopPropagation()}
      >
        <img
          src={photo.cloudinary_url}
          alt={photo.original_name}
          className="max-h-[85vh] rounded-lg object-contain"
        />
        <div className="mt-2 flex items-center justify-between rounded-lg bg-white/90 px-4 py-2">
          <div>
            <div className="text-sm font-medium text-zinc-800">{photo.original_name}</div>
            <div className="text-xs text-zinc-500">{formatSize(photo.size_bytes)}</div>
          </div>
          <a
            href={photo.cloudinary_url}
            download={photo.original_name}
            target="_blank"
            rel="noopener noreferrer"
            className="rounded-lg bg-zinc-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-zinc-800"
            onClick={(e) => e.stopPropagation()}
          >
            Download
          </a>
        </div>
        <button
          onClick={onClose}
          className="absolute -right-2 -top-2 flex h-8 w-8 items-center justify-center rounded-full bg-white text-zinc-600 shadow-lg hover:bg-zinc-100"
        >
          ✕
        </button>
      </div>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function GalleryPage() {
  const dispatch = useAppDispatch();
  const { items, loading, uploading } = useAppSelector((s) => s.photos);
  const fileRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<Photo | null>(null);
  const [dragOver, setDragOver] = useState(false);

  useEffect(() => {
    dispatch(fetchMyPhotosThunk());
  }, [dispatch]);

  const handleFiles = (files: FileList | null) => {
    if (!files || files.length === 0) return;
    dispatch(uploadPhotosThunk(Array.from(files)));
    if (fileRef.current) fileRef.current.value = "";
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    handleFiles(e.dataTransfer.files);
  };

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">My Gallery</h1>
          <p className="mt-1 text-sm text-zinc-600">
            Upload, preview, and manage your photos.
          </p>
        </div>
        <button
          onClick={() => fileRef.current?.click()}
          disabled={uploading}
          className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
        >
          {uploading ? "Uploading..." : "Upload Photos"}
        </button>
        <input
          ref={fileRef}
          type="file"
          multiple
          accept="image/*"
          className="hidden"
          onChange={(e) => handleFiles(e.target.files)}
        />
      </div>

      {/* Drop zone */}
      <div
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
        className={`mb-6 rounded-2xl border-2 border-dashed p-8 text-center transition-colors ${
          dragOver ? "border-zinc-400 bg-zinc-50" : "border-zinc-200 bg-white"
        }`}
      >
        <div className="text-sm text-zinc-500">
          Drag &amp; drop images here, or click <strong>Upload Photos</strong>
        </div>
        <div className="mt-1 text-xs text-zinc-400">
          JPEG, PNG, GIF, WebP, SVG — max 10MB each, up to 5 files
        </div>
      </div>

      {loading && items.length === 0 ? (
        <div className="rounded-2xl border border-zinc-200 bg-white p-12 text-center text-sm text-zinc-500">
          Loading photos...
        </div>
      ) : items.length === 0 ? (
        <div className="rounded-2xl border border-zinc-200 bg-white p-12 text-center">
          <div className="mb-2 text-lg font-medium text-zinc-800">No photos yet</div>
          <p className="text-sm text-zinc-500">Upload your first photo to get started.</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
          {items.map((photo) => (
            <div
              key={photo.id}
              className="group relative overflow-hidden rounded-2xl border border-zinc-200 bg-white"
            >
              <button
                onClick={() => setPreview(photo)}
                className="aspect-square w-full overflow-hidden"
              >
                <img
                  src={photo.cloudinary_url}
                  alt={photo.original_name}
                  className="h-full w-full object-cover transition-transform group-hover:scale-105"
                />
              </button>

              <div className="flex items-center justify-between border-t border-zinc-100 px-3 py-2">
                <div className="min-w-0">
                  <div className="truncate text-xs font-medium text-zinc-700">
                    {photo.original_name}
                  </div>
                  <div className="text-[10px] text-zinc-400">
                    {formatSize(photo.size_bytes)}
                  </div>
                </div>
                <button
                  onClick={() => {
                    if (confirm("Delete this photo?")) {
                      dispatch(deletePhotoThunk(photo.id));
                    }
                  }}
                  className="rounded-md p-1 text-zinc-400 hover:bg-red-50 hover:text-red-500"
                  title="Delete"
                >
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {preview && (
        <PreviewModal photo={preview} onClose={() => setPreview(null)} />
      )}
    </div>
  );
}
