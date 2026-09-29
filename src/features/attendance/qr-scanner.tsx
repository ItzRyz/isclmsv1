"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Html5Qrcode } from "html5-qrcode";
import { Button } from "@/components/ui/button";
import { checkIn, idCardCheckIn } from "./actions";

type Parsed =
  | { kind: "session"; sessionId: string; token: string }
  | { kind: "member"; userId: string }
  | { kind: "unknown" };

function parsePayload(text: string): Parsed {
  try {
    const o = JSON.parse(text) as Record<string, unknown>;
    if (
      o["v"] === 1 &&
      typeof o["sessionId"] === "string" &&
      typeof o["token"] === "string"
    ) {
      return { kind: "session", sessionId: o["sessionId"], token: o["token"] };
    }
    if (typeof o["member"] === "string")
      return { kind: "member", userId: o["member"] };
  } catch {
    // bukan JSON — abaikan
  }
  return { kind: "unknown" };
}

function getPosition(): Promise<{ lat: number; lng: number } | null> {
  if (!("geolocation" in navigator)) return Promise.resolve(null);
  return new Promise((resolve) => {
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      () => resolve(null),
      { timeout: 10000 },
    );
  });
}

/**
 * P1-604: scanner kamera. Mode mandiri (scan QR sesi -> check-in +
 * geolokasi) atau mode mentor (scan kartu anggota -> catat ke sesi).
 */
export function QrScanner({
  mode,
  sessionId,
}: {
  mode: "self" | "mentor";
  sessionId?: string;
}) {
  const [active, setActive] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const scannerRef = useRef<Html5Qrcode | null>(null);

  const handleScan = useCallback(
    async (text: string): Promise<void> => {
      const parsed = parsePayload(text);
      setBusy(true);
      setError(null);
      try {
        if (mode === "self" && parsed.kind === "session") {
          const pos = await getPosition();
          const res = await checkIn({
            session_id: parsed.sessionId,
            token: parsed.token,
            latitude: pos?.lat ?? null,
            longitude: pos?.lng ?? null,
          });
          setResult(`Check-in ${res.status}.`);
          setActive(false);
        } else if (mode === "mentor" && parsed.kind === "member" && sessionId) {
          const res = await idCardCheckIn({
            session_id: sessionId,
            member_user_id: parsed.userId,
          });
          setResult(`Tercatat ${res.status}. Pindai berikutnya…`);
        } else {
          setError("QR tidak dikenali untuk mode ini.");
        }
      } catch (e) {
        setError(e instanceof Error ? e.message : "Gagal memproses QR.");
      } finally {
        setBusy(false);
      }
    },
    [mode, sessionId],
  );

  useEffect(() => {
    if (!active) return;
    const scanner = new Html5Qrcode("qr-reader");
    scannerRef.current = scanner;
    let cancelled = false;
    scanner
      .start(
        { facingMode: "environment" },
        { fps: 10, qrbox: { width: 250, height: 250 } },
        (text) => {
          if (cancelled) return;
          void handleScan(text);
        },
        undefined,
      )
      .catch((e: unknown) =>
        setError(
          e instanceof Error
            ? `Kamera: ${e.message}`
            : "Kamera ditolak/tidak tersedia. Izinkan akses kamera.",
        ),
      );
    return () => {
      cancelled = true;
      scanner.stop().catch(() => undefined);
      try {
        scanner.clear();
      } catch {
        // Abaikan: scanner mungkin sudah dibersihkan.
      }
    };
  }, [active, handleScan]);

  return (
    <div className="flex flex-col gap-2">
      {!active ? (
        <Button size="sm" variant="outline" onClick={() => setActive(true)}>
          {mode === "self" ? "Pindai QR sesi" : "Pindai kartu anggota"}
        </Button>
      ) : (
        <>
          <div
            id="qr-reader"
            className="w-full max-w-sm overflow-hidden rounded-md"
          />
          <Button size="sm" variant="ghost" onClick={() => setActive(false)}>
            Tutup kamera
          </Button>
        </>
      )}
      {busy ? (
        <span className="text-muted-foreground text-sm">Memproses…</span>
      ) : null}
      {error ? <span className="text-destructive text-sm">{error}</span> : null}
      {result ? <span className="text-primary text-sm">{result}</span> : null}
    </div>
  );
}
