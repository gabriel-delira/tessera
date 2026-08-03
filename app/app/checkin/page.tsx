"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { useAuth } from "@/app/components/AuthProvider";
import { Button } from "../components/ui/Button";
import { Badge } from "../components/ui/Badge";
import { Icon } from "../components/ui/Icon";
import { TextareaField } from "../components/ui/Field";
import { EmptyState } from "../components/ui/EmptyState";

interface CheckinResult {
  ok: boolean;
  tokenId?: number;
  ticketNumber?: number;
  seat?: string | null;
  event?: { title: string; venue: string; city: string; eventDate: string };
  error?: string;
}

export default function CheckinPage() {
  const { ready, authenticated, login, getAccessToken } = useAuth();
  const [payload, setPayload]   = useState("");
  const [result, setResult]     = useState<CheckinResult | null>(null);
  const [loading, setLoading]   = useState(false);

  // Camera scanning state
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [cameraActive, setCameraActive] = useState(false);
  const [cameraError, setCameraError]   = useState("");
  const scanInterval = useRef<ReturnType<typeof setInterval> | null>(null);

  const submit = useCallback(async (qrPayload: string) => {
    if (!qrPayload.trim()) return;
    setLoading(true);
    setResult(null);
    const token = await getAccessToken();
    const r = await fetch("/api/checkin", {
      method:  "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body:    JSON.stringify({ qrPayload: qrPayload.trim() }),
    });
    const data = await r.json();
    setResult(data);
    setLoading(false);
    if (data.ok) setPayload("");
  }, [getAccessToken]);

  const startCamera = useCallback(async () => {
    setCameraError("");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play();
        setCameraActive(true);
      }
    } catch {
      setCameraError("Não foi possível acessar a câmera. Use o campo de texto para colar o payload.");
    }
  }, []);

  const stopCamera = useCallback(() => {
    if (videoRef.current?.srcObject) {
      (videoRef.current.srcObject as MediaStream).getTracks().forEach((t) => t.stop());
      videoRef.current.srcObject = null;
    }
    if (scanInterval.current) clearInterval(scanInterval.current);
    setCameraActive(false);
  }, []);

  // Try to decode QR from canvas every 500ms using the BarcodeDetector API (where supported)
  useEffect(() => {
    if (!cameraActive) return;
    if (!("BarcodeDetector" in window)) return;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const detector = new (window as any).BarcodeDetector({ formats: ["qr_code"] });

    scanInterval.current = setInterval(async () => {
      if (!videoRef.current || !canvasRef.current) return;
      const ctx = canvasRef.current.getContext("2d");
      if (!ctx) return;
      canvasRef.current.width  = videoRef.current.videoWidth;
      canvasRef.current.height = videoRef.current.videoHeight;
      ctx.drawImage(videoRef.current, 0, 0);
      try {
        const barcodes = await detector.detect(canvasRef.current);
        if (barcodes.length > 0) {
          const raw = barcodes[0].rawValue as string;
          if (raw.startsWith("tessera:")) {
            stopCamera();
            await submit(raw);
          }
        }
      } catch { /* detector not ready yet */ }
    }, 500);

    return () => { if (scanInterval.current) clearInterval(scanInterval.current); };
  }, [cameraActive, stopCamera, submit]);

  useEffect(() => () => stopCamera(), [stopCamera]);

  if (!ready) return <p className="p-8 text-text-muted">Carregando…</p>;

  if (!authenticated) {
    return (
      <div className="mx-auto max-w-md px-6 py-20">
        <EmptyState
          icon="scanner"
          title="Faça login para acessar o scanner de check-in."
          action={<Button onClick={login}>Entrar</Button>}
        />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-lg px-6 py-10">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="font-display text-2xl text-text">Check-in</h1>
        <Badge variant="info">Staff</Badge>
      </div>

      {/* Camera scanner */}
      <div className="mb-6">
        {!cameraActive ? (
          <button
            onClick={startCamera}
            className="w-full rounded-xl border-2 border-dashed border-border-strong py-10 text-sm text-text-muted transition-colors hover:border-ouro-400 hover:text-text"
          >
            <Icon name="scanner" className="mx-auto mb-2 h-8 w-8" />
            Abrir câmera para escanear QR
          </button>
        ) : (
          <div className="relative overflow-hidden rounded-xl bg-noite-900">
            {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
            <video ref={videoRef} className="w-full" playsInline />
            <canvas ref={canvasRef} className="hidden" />
            <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
              <div className="h-56 w-56 rounded-2xl border-4 border-luz-500 opacity-70" />
            </div>
            <button
              onClick={stopCamera}
              className="absolute right-3 top-3 h-11 rounded-md bg-noite-900/80 px-4 text-sm font-semibold text-text"
            >
              Fechar câmera
            </button>
          </div>
        )}
        {cameraError && <p className="mt-2 text-xs text-erro-on-dark">{cameraError}</p>}
        {cameraActive && !("BarcodeDetector" in window) && (
          <p className="mt-2 text-xs text-ouro-400">
            Câmera ativa, mas detecção automática de QR não suportada neste navegador. Cole o payload abaixo.
          </p>
        )}
      </div>

      {/* Manual input fallback */}
      <div className="mb-6 flex flex-col gap-3">
        <TextareaField
          label="Ou cole o payload do QR manualmente:"
          rows={3}
          className="font-mono"
          placeholder="tessera:v1:0:12345678:abcd1234abcd1234"
          value={payload}
          onChange={(e) => setPayload(e.target.value)}
        />
        <Button onClick={() => submit(payload)} disabled={loading || !payload.trim()} className="w-full">
          {loading ? "Validando…" : "Validar QR"}
        </Button>
      </div>

      {/* Result */}
      {result && (
        <div
          className={`rounded-xl border p-5 ${
            result.ok
              ? "border-sucesso-on-dark/40 bg-sucesso-on-dark/10"
              : "border-erro-on-dark/40 bg-erro-on-dark/10"
          }`}
        >
          {result.ok ? (
            <>
              <p className="mb-1 flex items-center gap-2 text-lg font-bold text-sucesso-on-dark">
                <Icon name="check" />
                Entrada liberada
              </p>
              <p className="text-sm text-text">{result.event?.title}</p>
              <p className="mt-1 text-xs text-text-muted">
                Ingresso #{result.ticketNumber}{result.seat ? ` · Assento ${result.seat}` : ""} · Token #{result.tokenId}
              </p>
              <p className="text-xs text-text-muted">
                {result.event?.venue}, {result.event?.city} · {result.event?.eventDate && new Date(result.event.eventDate).toLocaleString("pt-BR")}
              </p>
            </>
          ) : (
            <p className="flex items-center gap-2 text-lg font-bold text-erro-on-dark">
              <Icon name="x" />
              {result.error ?? "Entrada negada"}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
