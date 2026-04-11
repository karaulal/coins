import { NextResponse } from "next/server";

const WEBHOOK_URL = "https://hook.eu1.make.com/pm2q6hkt3njna966t5sb3bjzb4146vf5";

function currentDateMDY() {
  const d = new Date();
  const month = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  const year = d.getUTCFullYear();
  return `${month}/${day}/${year}`;
}

function currentPlus5Minutes() {
  return new Date(Date.now() + 5 * 60 * 1000);
}

function timeSheets12h(d: Date) {
  const hour24 = d.getUTCHours();
  const hour12 = hour24 % 12 || 12;
  const suffix = hour24 >= 12 ? "PM" : "AM";
  const hour = String(hour12).padStart(2, "0");
  const minute = String(d.getUTCMinutes()).padStart(2, "0");
  const second = String(d.getUTCSeconds()).padStart(2, "0");
  return `${hour}:${minute}:${second} ${suffix}`;
}

export async function POST(req: Request) {
  try {
    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
    const fileUrl = String(body?.fileUrl || "").trim();
    const date = String(body?.date || currentDateMDY()).trim();
    const plus5 = currentPlus5Minutes();
    const time = timeSheets12h(plus5);

    if (!fileUrl) {
      return NextResponse.json({ error: "fileUrl is required." }, { status: 400 });
    }

    const webhookRes = await fetch(WEBHOOK_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        date,
        fileUrl,
        time,
        topCoinLines: Array.isArray(body?.topCoinLines) ? body.topCoinLines : [],
        topCoins: Array.isArray(body?.topCoins) ? body.topCoins : [],
        tweetText: typeof body?.tweetText === "string" ? body.tweetText : "",
      }),
    });

    if (!webhookRes.ok) {
      return NextResponse.json(
        { error: "Webhook request failed.", status: webhookRes.status },
        { status: 502 }
      );
    }

    return NextResponse.json({ ok: true, status: webhookRes.status, time });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unable to send webhook request.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
