"use client";

import { useEffect, useState } from "react";
import api from "@/lib/axios";

// ── Authenticated image component ─────────────────────────────────────────────

interface AuthImageProps {
  photoId: string;
  token: string;
  alt: string;
  className?: string;
}

export function AuthImage({ photoId, token, alt, className }: AuthImageProps) {
  const [src, setSrc] = useState<string | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    let revoked = false;
    let blobUrl: string | null = null;

    async function load() {
      try {
        const res = await fetch(`${api.defaults.baseURL}/photos/${photoId}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!res.ok) {
          setError(true);
          return;
        }
        const blob = await res.blob();
        if (revoked) return;
        blobUrl = URL.createObjectURL(blob);
        setSrc(blobUrl);
      } catch {
        setError(true);
      }
    }

    load();

    return () => {
      revoked = true;
      if (blobUrl) URL.revokeObjectURL(blobUrl);
    };
  }, [photoId, token]);

  if (error) {
    return (
      <div className={`flex items-center justify-center bg-zinc-100 ${className ?? ""}`}>
        <span className="text-xs text-zinc-400">Failed to load</span>
      </div>
    );
  }

  if (!src) {
    return <div className={`animate-pulse bg-zinc-100 ${className ?? ""}`} />;
  }

  return <img src={src} alt={alt} className={className} />;
}

// ── Authenticated download button ─────────────────────────────────────────────

interface AuthDownloadProps {
  photoId: string;
  filename: string;
  token: string;
  children: React.ReactNode;
  className?: string;
}

export function AuthDownload({ photoId, filename, token, children, className }: AuthDownloadProps) {
  const [downloading, setDownloading] = useState(false);

  const handleDownload = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (downloading) return;

    setDownloading(true);
    try {
      const res = await fetch(`${api.defaults.baseURL}/photos/${photoId}/download`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) return;

      const blob = await res.blob();
      const url = URL.createObjectURL(blob);

      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch {
      // silent fail
    }
    setDownloading(false);
  };

  return (
    <button onClick={handleDownload} className={className} disabled={downloading}>
      {downloading ? "..." : children}
    </button>
  );
}
