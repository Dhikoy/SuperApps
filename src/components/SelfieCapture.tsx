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
      <div className="space-y-2">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={captured} alt="Selfie" className="w-full rounded-2xl border border-slate-200 aspect-[4/3] object-cover" />
        <button type="button" onClick={onRetake} className="w-full py-1.5 text-sm font-medium text-slate-500 hover:text-slate-700">
          Ambil ulang foto
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {cameraError ? (
        <p className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-xl p-3">{cameraError}</p>
      ) : (
        <div className="overflow-hidden rounded-2xl bg-black aspect-[4/3]">
          <video ref={videoRef} autoPlay playsInline muted className="h-full w-full object-cover mirror" />
        </div>
      )}

      <button
        type="button"
        onClick={handleCapture}
        disabled={!!cameraError || !stream}
        className="btn-primary w-full !py-4 text-base active:scale-[0.98]"
      >
        📸 Ambil Foto
      </button>
    </div>
  );
}
