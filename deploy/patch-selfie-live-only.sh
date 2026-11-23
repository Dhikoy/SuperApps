#!/usr/bin/env bash
# Patch SelfieCapture: hanya kamera live, hapus upload galeri + rebuild
# Jalankan di VPS: bash deploy/patch-selfie-live-only.sh
set -euo pipefail
cd /var/www/superappsBCI
pm2 stop superappsBCI 2>/dev/null || true

cat > src/components/SelfieCapture.tsx << 'ENDFILE'
"use client";

import { useEffect, useRef, useState } from "react";

type Props = {
  onCapture: (dataUrl: string) => void;
  captured: string | null;
  onRetake: () => void;
};

const MAX_WIDTH = 640;
const JPEG_QUALITY = 0.72;

function compressDataUrl(source: CanvasImageSource, width: number, height: number): string | null {
  const canvas = document.createElement("canvas");
  const scale = Math.min(1, MAX_WIDTH / width);
  canvas.width = Math.round(width * scale);
  canvas.height = Math.round(height * scale);
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;
  ctx.drawImage(source, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL("image/jpeg", JPEG_QUALITY);
}

export function SelfieCapture({ onCapture, captured, onRetake }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [cameraError, setCameraError] = useState("");

  useEffect(() => {
    if (captured) return;

    if (!window.isSecureContext) {
      setCameraError("Presensi selfie hanya bisa via kamera live. Akses aplikasi lewat HTTPS (https://appsbci.com).");
      return;
    }

    if (!navigator.mediaDevices?.getUserMedia) {
      setCameraError("Perangkat tidak mendukung kamera. Gunakan browser terbaru di HP/laptop.");
      return;
    }

    let active = true;
    navigator.mediaDevices
      .getUserMedia({ video: { facingMode: "user" }, audio: false })
      .then((mediaStream) => {
        if (!active) {
          mediaStream.getTracks().forEach((t) => t.stop());
          return;
        }
        setStream(mediaStream);
        if (videoRef.current) {
          videoRef.current.srcObject = mediaStream;
        }
      })
      .catch(() => {
        setCameraError("Tidak dapat mengakses kamera. Izinkan akses kamera di browser.");
      });

    return () => {
      active = false;
    };
  }, [captured]);

  useEffect(() => {
    return () => {
      stream?.getTracks().forEach((t) => t.stop());
    };
  }, [stream]);

  function handleCapture() {
    const video = videoRef.current;
    if (!video) return;

    const dataUrl = compressDataUrl(video, video.videoWidth || 640, video.videoHeight || 480);
    if (!dataUrl) return;

    stream?.getTracks().forEach((t) => t.stop());
    setStream(null);
    onCapture(dataUrl);
  }

  if (captured) {
    return (
      <div className="space-y-3">
        <p className="text-sm font-medium text-gray-700">Foto Selfie</p>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={captured} alt="Selfie" className="w-full rounded-lg border border-gray-200 max-h-64 object-cover" />
        <button type="button" onClick={onRetake} className="text-sm text-blue-600 hover:text-blue-800">
          Ambil ulang foto
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <p className="text-sm font-medium text-gray-700">
        Foto Selfie Live <span className="text-red-500">*</span>
      </p>
      <p className="text-xs text-slate-500">Hanya foto langsung dari kamera — upload galeri tidak diizinkan.</p>

      {cameraError ? (
        <p className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-lg p-3">{cameraError}</p>
      ) : (
        <div className="overflow-hidden rounded-lg border border-gray-200 bg-black aspect-[4/3]">
          <video ref={videoRef} autoPlay playsInline muted className="h-full w-full object-cover mirror" />
        </div>
      )}

      <button
        type="button"
        onClick={handleCapture}
        disabled={!!cameraError || !stream}
        className="w-full rounded-lg border border-gray-300 py-2.5 text-sm font-medium hover:bg-gray-50 disabled:opacity-50"
      >
        Ambil Foto Selfie
      </button>
    </div>
  );
}
ENDFILE

export SKIP_TYPECHECK=true
export NODE_OPTIONS="--max-old-space-size=1024"
npm run build

pm2 restart superappsBCI 2>/dev/null || pm2 start deploy/ecosystem.config.cjs
pm2 save 2>/dev/null || true
echo "Selesai — upload galeri dihapus. Kamera live butuh HTTPS (https://appsbci.com)."
