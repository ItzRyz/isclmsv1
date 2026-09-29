"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { renderSessionQr } from "./actions";

const ROTATE_MS = 60_000;

/** QR sesi + rotasi token tiap 60 detik. */
export function RotatingQr({
  sessionId,
  initial,
}: {
  sessionId: string;
  initial: string;
}) {
  const [img, setImg] = useState(initial);
  const [secs, setSecs] = useState(ROTATE_MS / 1000);
  const [error, setError] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  const refresh = useCallback(async () => {
    try {
      const { img: next } = await renderSessionQr(sessionId);
      setImg(next);
      setSecs(ROTATE_MS / 1000);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Gagal rotasi QR.");
    }
  }, [sessionId]);

  useEffect(() => {
    timer.current = setInterval(() => {
      setSecs((s) => {
        if (s <= 1) {
          void refresh();
          return ROTATE_MS / 1000;
        }
        return s - 1;
      });
    }, 1000);
    return () => {
      if (timer.current) clearInterval(timer.current);
    };
  }, [refresh]);

  return (
    <div className="flex flex-col items-center gap-2">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={img} alt="QR sesi absensi" width={320} height={320} />
      <span className="text-muted-foreground text-xs">
        Token baru dalam {secs} dtk
      </span>
      {error ? <span className="text-destructive text-sm">{error}</span> : null}
      <Button size="sm" variant="outline" onClick={() => void refresh()}>
        Rotasi sekarang
      </Button>
    </div>
  );
}
