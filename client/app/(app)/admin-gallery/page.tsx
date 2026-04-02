"use client";

import { useEffect, useState } from "react";
import { useAppSelector } from "@/redux/hooks";
import api from "@/lib/axios";

// ── Types ─────────────────────────────────────────────────────────────────────

interface AdminPhoto {
  id: string;
  user_id: string;
  original_name: string;
  mime_type: string;
  size_bytes: number;
  cloudinary_url: string;
  cloudinary_public_id: string;
  created_at: string;
  owner_email: string;
  owner_first_name: string;
  owner_last_name: string;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

// ── Preview modal ─────────────────────────────────────────────────────────────

function AdminPreviewModal({
  photo,
  onClose,
}: {
  photo: AdminPhoto;
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
          className="max-h-[80vh] rounded-lg object-contain"
        />
        <div className="mt-2 rounded-lg bg-white/90 px-4 py-3">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm font-medium text-zinc-800">{photo.original_name}</div>
              <div className="text-xs text-zinc-500">
                {formatSize(photo.size_bytes)} — Uploaded by{" "}
                <strong>{photo.owner_first_name} {photo.owner_last_name}</strong> ({photo.owner_email})
              </div>
              <div className="text-xs text-zinc-400">{formatDate(photo.created_at)}</div>
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

export default function AdminGalleryPage() {
  const token = useAppSelector((s) => s.auth.accessToken) ?? "";
  const user = useAppSelector((s) => s.auth.user);
  const [photos, setPhotos] = useState<AdminPhoto[]>([]);
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [preview, setPreview] = useState<AdminPhoto | null>(null);
  const [filterEmail, setFilterEmail] = useState("");

  const fetchPhotos = async () => {
    setLoading(true);
    try {
      const { data } = await api.get("/admin/photos", {
        headers: { Authorization: `Bearer ${token}` },
        params: { page, limit: 20 },
      });
      setPhotos(data.photos);
      setTotal(data.total);
    } catch {
      setPhotos([]);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchPhotos();
  }, [page]);

  const filtered = filterEmail
    ? photos.filter((p) =>
        p.owner_email.toLowerCase().includes(filterEmail.toLowerCase()) ||
        `${p.owner_first_name} ${p.owner_last_name}`.toLowerCase().includes(filterEmail.toLowerCase())
      )
    : photos;

  if (user?.role !== "admin") {
    return (
      <div>
        <h1 className="text-2xl font-semibold">All Photos</h1>
        <div className="mt-6 rounded-2xl border border-zinc-200 bg-white p-8 text-center">
          <div className="text-lg font-medium text-zinc-800">Admin Access Required</div>
          <p className="mt-2 text-sm text-zinc-500">Only administrators can view all user photos.</p>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">All Photos</h1>
          <p className="mt-1 text-sm text-zinc-600">
            View, preview, and download photos from all users. ({total} total)
          </p>
        </div>
        <input
          type="text"
          value={filterEmail}
          onChange={(e) => setFilterEmail(e.target.value)}
          placeholder="Filter by email or name..."
          className="rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm outline-none focus:border-zinc-400"
        />
      </div>

      {loading ? (
        <div className="rounded-2xl border border-zinc-200 bg-white p-12 text-center text-sm text-zinc-500">
          Loading photos...
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded-2xl border border-zinc-200 bg-white p-12 text-center">
          <div className="text-lg font-medium text-zinc-800">No photos found</div>
          <p className="mt-2 text-sm text-zinc-500">
            {filterEmail ? "No photos match this filter." : "No users have uploaded photos yet."}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
          {filtered.map((photo) => (
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

              <div className="border-t border-zinc-100 px-3 py-2">
                <div className="truncate text-xs font-medium text-zinc-700">
                  {photo.original_name}
                </div>
                <div className="truncate text-[10px] text-zinc-500">
                  {photo.owner_first_name} {photo.owner_last_name}
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-[10px] text-zinc-400">
                    {formatSize(photo.size_bytes)}
                  </span>
                  <a
                    href={photo.cloudinary_url}
                    download={photo.original_name}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="rounded p-0.5 text-zinc-400 hover:text-zinc-700"
                    title="Download"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                    </svg>
                  </a>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {total > 20 && (
        <div className="mt-6 flex items-center justify-center gap-2">
          <button
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page === 1}
            className="rounded-lg border border-zinc-200 bg-white px-3 py-1.5 text-sm disabled:opacity-50"
          >
            Previous
          </button>
          <span className="text-sm text-zinc-600">
            Page {page} of {Math.ceil(total / 20)}
          </span>
          <button
            onClick={() => setPage((p) => p + 1)}
            disabled={page >= Math.ceil(total / 20)}
            className="rounded-lg border border-zinc-200 bg-white px-3 py-1.5 text-sm disabled:opacity-50"
          >
            Next
          </button>
        </div>
      )}

      {preview && (
        <AdminPreviewModal photo={preview} onClose={() => setPreview(null)} />
      )}
    </div>
  );
}
