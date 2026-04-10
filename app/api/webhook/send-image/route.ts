import { NextResponse } from "next/server";

const WEBHOOK_URL = "https://hook.eu1.make.com/pm2q6hkt3njna966t5sb3bjzb4146vf5";

function currentDateMDY() {
  const d = new Date();
  const month = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  const year = d.getUTCFullYear();
  return `${month}/${day}/${year}`;
}

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as { fileUrl?: string; date?: string };
    const fileUrl = String(body?.fileUrl || "").trim();
    const date = String(body?.date || currentDateMDY()).trim();

    if (!fileUrl) {
      return NextResponse.json({ error: "fileUrl is required." }, { status: 400 });
    }

    const webhookRes = await fetch(WEBHOOK_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ date, fileUrl }),
    });

    if (!webhookRes.ok) {
      return NextResponse.json(
        { error: "Webhook request failed.", status: webhookRes.status },
        { status: 502 }
      );
    }

    return NextResponse.json({ ok: true, status: webhookRes.status });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unable to send webhook request.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
