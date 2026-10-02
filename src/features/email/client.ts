/**
 * P1-807: klien email transaksional Resend (server-only).
 * POST https://api.resend.com/emails, Bearer RESEND_API_KEY.
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
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        from,
        to: input.to,
        subject: input.subject,
        text: input.text,
        ...(input.html ? { html: input.html } : {}),
      }),
      signal: controller.signal,
    });
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      throw new Error(`Resend ${res.status}: ${body.slice(0, 200)}`);
    }
  } finally {
    clearTimeout(timer);
  }
}

export async function sendEmail(input: SendEmailInput): Promise<SendResult> {
  const apiKey = process.env["RESEND_API_KEY"];
  const from = process.env["RESEND_FROM_EMAIL"];
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
