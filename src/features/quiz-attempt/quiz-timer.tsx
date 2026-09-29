"use client";

import { useEffect, useState } from "react";

function fmt(ms: number): string {
  const s = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  const pad = (n: number): string => String(n).padStart(2, "0");
  return h > 0 ? `${h}:${pad(m)}:${pad(sec)}` : `${pad(m)}:${pad(sec)}`;
}

export function QuizTimer({
  deadlineMs,
  onExpire,
}: {
  deadlineMs: number | null;
  onExpire: () => void;
}) {
  const [left, setLeft] = useState<number | null>(null);
  const [fired, setFired] = useState(false);

  useEffect(() => {
    if (deadlineMs === null) return;
    // Timer client butuh waktu sekarang sekali saat mount.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLeft(deadlineMs - Date.now());
    const t = setInterval(() => {
      const rest = deadlineMs - Date.now();
      setLeft(rest);
      if (rest <= 0 && !fired) {
        setFired(true);
        clearInterval(t);
        onExpire();
      }
    }, 1000);
    return () => clearInterval(t);
  }, [deadlineMs, fired, onExpire]);

  if (left === null)
    return (
      <span className="text-muted-foreground text-sm">Tanpa batas waktu</span>
    );
  return (
    <span
      className={`font-mono text-lg font-semibold ${left < 60000 ? "text-destructive" : ""}`}
    >
      {fmt(left)}
    </span>
  );
}
