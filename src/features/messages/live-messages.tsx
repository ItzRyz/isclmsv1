"use client";

import { useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";

export type LiveMessage = {
  id: string;
  sender_id: string;
  body: string;
  created_at: string;
};

/**
 * P1-805: realtime pesan — data tetap persist-first (server action),
 * channel hanya menempelkan baris baru. RLS member-only tetap berlaku.
 */
export function LiveMessages({
  conversationId,
  initial,
  me,
  names,
}: {
  conversationId: string;
  initial: LiveMessage[];
  me: string;
  names: Record<string, string>;
}) {
  const [messages, setMessages] = useState<LiveMessage[]>(initial);
  const bottomRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel(`messages:${conversationId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "messages",
          filter: `conversation_id=eq.${conversationId}`,
        },
        (payload) => {
          const row = payload.new as LiveMessage;
          setMessages((prev) =>
            prev.some((m) => m.id === row.id) ? prev : [...prev, row],
          );
        },
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [conversationId]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages]);

  return (
    <div className="flex flex-col gap-2">
      {messages.map((m) => (
        <div
          key={m.id}
          className={`max-w-[80%] rounded-md p-2 text-sm ${
            m.sender_id === me
              ? "bg-primary text-primary-foreground self-end"
              : "bg-muted self-start"
          }`}
        >
          <div className="text-xs opacity-70">{names[m.sender_id] ?? "—"}</div>
          <p className="whitespace-pre-wrap">{m.body}</p>
        </div>
      ))}
      <div ref={bottomRef} />
    </div>
  );
}
