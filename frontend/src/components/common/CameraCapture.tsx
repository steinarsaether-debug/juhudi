import { useRef, useState, useCallback, useEffect } from 'react';
import { Camera, Upload, X, RefreshCw, MapPin } from 'lucide-react';

export interface CapturedPhoto {
  dataUrl: string;         // compressed JPEG data URL
  base64: string;          // raw base64 (no prefix)
  mimeType: 'image/jpeg';
  gpsLat: number | null;
  gpsLng: number | null;
  capturedAt: string;      // ISO timestamp
  fileSizeKb: number;
}

interface CameraCaptureProps {
  onCapture: (photo: CapturedPhoto) => void;
  onCancel?: () => void;
  label?: string;
  maxKb?: number;          // default 800
}

const MAX_DIMENSION = 1280; // px

function compressImage(
  sourceUrl: string,
  maxKb: number,
): Promise<{ dataUrl: string; base64: string; sizeKb: number }> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      let { width, height } = img;
      if (width > MAX_DIMENSION || height > MAX_DIMENSION) {
        const scale = Math.min(MAX_DIMENSION / width, MAX_DIMENSION / height);
        width = Math.round(width * scale);
        height = Math.round(height * scale);
      }
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d')!;
      ctx.drawImage(img, 0, 0, width, height);

      // Try quality levels until we're under maxKb
      let quality = 0.85;
      let dataUrl = canvas.toDataURL('image/jpeg', quality);
      while (dataUrl.length / 1.37 / 1024 > maxKb && quality > 0.2) {
        quality -= 0.1;
        dataUrl = canvas.toDataURL('image/jpeg', quality);
      }
      const base64 = dataUrl.split(',')[1];
      const sizeKb = Math.round(dataUrl.length / 1.37 / 1024);
      resolve({ dataUrl, base64, sizeKb });
    };
    img.onerror = reject;
    img.src = sourceUrl;
  });
}

export default function CameraCapture({ onCapture, onCancel, label = 'Take Photo', maxKb = 800 }: CameraCaptureProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [mode, setMode] = useState<'idle' | 'preview' | 'captured'>('idle');
  const [captured, setCaptured] = useState<CapturedPhoto | null>(null);
  const [gps, setGps] = useState<{ lat: number; lng: number } | null>(null);
  const [gpsError, setGpsError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [cameraSupported, setCameraSupported] = useState(true);

  // Attempt GPS early
  useEffect(() => {
    if (!navigator.geolocation) { setGpsError('GPS not available'); return; }
    navigator.geolocation.getCurrentPosition(
      (pos) => setGps({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      () => setGpsError('GPS unavailable – location not recorded'),
      { enableHighAccuracy: true, timeout: 8000 },
    );
  }, []);

  const stopStream = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
  }, []);

  const openCamera = useCallback(async () => {
    setError(null);
    if (!navigator.mediaDevices?.getUserMedia) {
      setCameraSupported(false);
      fileInputRef.current?.click();
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment', width: { ideal: 1920 }, height: { ideal: 1080 } },
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      setMode('preview');
    } catch {
      setCameraSupported(false);
      fileInputRef.current?.click();
    }
  }, []);

  const shoot = useCallback(async () => {
    if (!videoRef.current) return;
    const canvas = document.createElement('canvas');
    canvas.width = videoRef.current.videoWidth;
    canvas.height = videoRef.current.videoHeight;
    canvas.getContext('2d')!.drawImage(videoRef.current, 0, 0);
    const rawUrl = canvas.toDataURL('image/jpeg', 0.95);
    stopStream();

    const { dataUrl, base64, sizeKb } = await compressImage(rawUrl, maxKb);
    const photo: CapturedPhoto = {
      dataUrl, base64, mimeType: 'image/jpeg',
      gpsLat: gps?.lat ?? null,
      gpsLng: gps?.lng ?? null,
      capturedAt: new Date().toISOString(),
      fileSizeKb: sizeKb,
    };
    setCaptured(photo);
    setMode('captured');
  }, [gps, maxKb, stopStream]);

  const handleFileInput = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (ev) => {
      const rawUrl = ev.target?.result as string;
      const { dataUrl, base64, sizeKb } = await compressImage(rawUrl, maxKb);
      const photo: CapturedPhoto = {
        dataUrl, base64, mimeType: 'image/jpeg',
        gpsLat: gps?.lat ?? null,
        gpsLng: gps?.lng ?? null,
        capturedAt: new Date().toISOString(),
        fileSizeKb: sizeKb,
      };
      setCaptured(photo);
      setMode('captured');
    };
    reader.readAsDataURL(file);
  }, [gps, maxKb]);

  const retake = useCallback(() => {
    setCaptured(null);
    setMode('idle');
  }, []);

  const confirm = useCallback(() => {
    if (captured) onCapture(captured);
  }, [captured, onCapture]);

  // Cleanup on unmount
  useEffect(() => () => stopStream(), [stopStream]);

  return (
    <div className="rounded-xl border border-gray-200 bg-gray-50 overflow-hidden">
      {/* GPS status bar */}
      <div className={`flex items-center gap-1.5 px-3 py-1.5 text-xs ${gps ? 'bg-green-50 text-green-700' : gpsError ? 'bg-yellow-50 text-yellow-700' : 'bg-gray-100 text-gray-500'}`}>
        <MapPin className="h-3 w-3 flex-shrink-0" />
        {gps
          ? `GPS: ${gps.lat.toFixed(5)}, ${gps.lng.toFixed(5)}`
          : gpsError ?? 'Acquiring GPS…'}
      </div>

      {/* Hidden file input fallback */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={handleFileInput}
      />

      {/* Camera preview */}
      {mode === 'preview' && (
        <div className="relative bg-black">
          <video ref={videoRef} className="w-full max-h-72 object-contain" playsInline muted />
          <div className="absolute bottom-3 left-0 right-0 flex justify-center gap-4">
            <button
              onClick={() => { stopStream(); setMode('idle'); }}
              className="rounded-full bg-white/20 p-2 text-white backdrop-blur-sm hover:bg-white/30"
            >
              <X className="h-5 w-5" />
            </button>
            <button
              onClick={shoot}
              className="rounded-full bg-white p-4 shadow-lg hover:bg-gray-100"
            >
              <Camera className="h-6 w-6 text-gray-800" />
            </button>
          </div>
        </div>
      )}

      {/* Captured preview */}
      {mode === 'captured' && captured && (
        <div className="relative">
          <img src={captured.dataUrl} alt="Captured" className="w-full max-h-72 object-contain bg-black" />
          <div className="p-3 flex items-center justify-between bg-white border-t border-gray-200">
            <div className="text-xs text-gray-500">
              {captured.fileSizeKb} KB
              {captured.gpsLat && <span className="ml-2">📍 GPS tagged</span>}
            </div>
            <div className="flex gap-2">
              <button onClick={retake} className="btn-secondary text-xs py-1.5 flex items-center gap-1">
                <RefreshCw className="h-3.5 w-3.5" /> Retake
              </button>
              <button onClick={confirm} className="btn-primary text-xs py-1.5">
                Use Photo
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Idle state */}
      {mode === 'idle' && (
        <div className="p-6 text-center space-y-3">
          {error && <p className="text-xs text-red-600">{error}</p>}
          <div className="flex gap-3 justify-center">
            <button
              onClick={openCamera}
              className="btn-primary flex items-center gap-2"
            >
              <Camera className="h-4 w-4" />
              {label}
            </button>
            <button
              onClick={() => fileInputRef.current?.click()}
              className="btn-secondary flex items-center gap-2"
            >
              <Upload className="h-4 w-4" />
              Upload
            </button>
          </div>
          {!cameraSupported && (
            <p className="text-xs text-gray-400">Camera not available – using file upload</p>
          )}
          {onCancel && (
            <button onClick={onCancel} className="text-xs text-gray-400 hover:text-gray-600">
              Cancel
            </button>
          )}
        </div>
      )}
    </div>
  );
}
