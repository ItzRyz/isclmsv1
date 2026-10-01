/**
 * P1-807: klien email transaksional Sender (server-only).
 * POST https://api.sender.net/v2/message/send, Bearer SENDER_API_KEY.
 * Tanpa kredensial -> skip diam-diam (kembali { skipped: true }).
 * Satu retry untuk kegagalan jaringan/5xx.
 */
export type SendEmailInput = {
  to: string;
  name?: string;
  subject: string;
  text: string;
  html?: string;
};

export type SendResult =
  | { ok: true; skipped: false }
  | { ok: false; skipped: false; error: string }
  | { ok: true; skipped: true };

async function postOnce(
  input: SendEmailInput,
  apiKey: string,
  from: string,
): Promise<void> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 10000);
  try {
    const res = await fetch("https://api.sender.net/v2/message/send", {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        from: { email: from, name: "Study Club LMS" },
        to: { email: input.to, ...(input.name ? { name: input.name } : {}) },
        subject: input.subject,
        text: input.text,
        ...(input.html ? { html: input.html } : {}),
      }),
      signal: controller.signal,
    });
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      throw new Error(`Sender ${res.status}: ${body.slice(0, 200)}`);
    }
  } finally {
    clearTimeout(timer);
  }
}

export async function sendEmail(input: SendEmailInput): Promise<SendResult> {
  const apiKey = process.env["SENDER_API_KEY"];
  const from = process.env["SENDER_FROM_EMAIL"];
  if (!apiKey || !from) return { ok: true, skipped: true };
  try {
    await postOnce(input, apiKey, from);
    return { ok: true, skipped: false };
  } catch (first) {
    await new Promise((r) => setTimeout(r, 2000));
    try {
      await postOnce(input, apiKey, from);
      return { ok: true, skipped: false };
    } catch (second) {
      const msg = second instanceof Error ? second.message : String(first);
      return { ok: false, skipped: false, error: msg };
    }
  }
}
