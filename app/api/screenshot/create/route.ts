import { NextResponse } from "next/server";
import { adminStorage } from "@/lib/firebase-admin";

type ScreenshotCoin = {
  id: string;
  symbol: string;
  name: string;
  image: string;
  currentPrice: number;
  marketCapRank: number | null;
  totalVolume: number;
  priceChange24hPct: number | null;
  priceChange7dPct: number | null;
};

type MarketCoin = {
  id: string;
  symbol: string;
  name: string;
  image: string;
  currentPrice: number;
  marketCapRank: number | null;
  totalVolume: number;
  priceChange24hPct: number | null;
  priceChange7dPct: number | null;
};

function normalizeBaseUrl(value: string) {
  return String(value || "").trim().replace(/\/+$/, "");
}

function resolveRenderBaseUrl(url: URL): string {
  const host = String(url.host || "").toLowerCase();
  if (host.includes("localhost") || host.startsWith("127.0.0.1")) {
    const envBase =
      normalizeBaseUrl(process.env.APP_BASE_URL || "") ||
      normalizeBaseUrl(process.env.PUBLIC_BASE_URL || "") ||
      normalizeBaseUrl(process.env.NEXT_PUBLIC_SITE_URL || "") ||
      normalizeBaseUrl(process.env.NEXT_PUBLIC_APP_URL || "");

    if (envBase) return envBase;
  }

  return `${url.protocol}//${url.host}`;
}

async function getImageFromScreenshotService(
  renderUrl: string,
  options?: { width?: number; height?: number; delayMs?: number }
): Promise<{ bytes: Buffer; contentType: string }> {
  const controller = new AbortController();
  const timeoutHandle = setTimeout(() => controller.abort(), 90_000);
  const width = Math.max(540, Math.trunc(Number(options?.width || 540)));
  const height = Math.max(730, Math.trunc(Number(options?.height || 730)));
  const delayMs = Math.max(0, Math.trunc(Number(options?.delayMs ?? 2000)));

  let response: Response;
  try {
    const service = "https://bubble2-797487328877.europe-west1.run.app/screenshot";
    response = await fetch(service, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "image/png",
      },
      body: JSON.stringify({
        url: renderUrl,
        width,
        height,
        fullPage: false,
        type: "png",
        waitUntil: "networkidle",
        delayMs,
      }),
      signal: controller.signal,
    });

    if (!response.ok && [400, 404, 405, 415, 422].includes(Number(response.status))) {
      response = await fetch(service, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "image/png",
        },
        body: JSON.stringify({
          url: renderUrl,
          width,
          height,
          type: "png",
          waitUntil: "networkidle",
          delayMs,
        }),
        signal: controller.signal,
      });
    }
  } finally {
    clearTimeout(timeoutHandle);
  }

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Screenshot service ${response.status}: ${text.slice(0, 300)}`);
  }

  const bytes = Buffer.from(await response.arrayBuffer());
  if (!bytes.length) throw new Error("Screenshot service returned an empty image.");

  const contentType = String(response.headers.get("content-type") || "image/png").trim() || "image/png";
  return { bytes, contentType };
}

async function fetchTop10ForRender(baseUrl: string): Promise<ScreenshotCoin[]> {
  const response = await fetch(`${baseUrl}/api/trending`, {
    method: "GET",
    cache: "no-store",
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Failed to fetch /api/trending: ${response.status} ${text.slice(0, 200)}`);
  }

  const payload = (await response.json()) as { coins?: MarketCoin[] };
  const coins = Array.isArray(payload?.coins) ? payload.coins : [];
  return coins.slice(0, 10);
}

export async function POST(req: Request) {
  try {
    const url = new URL(req.url);
    const renderBaseUrl = resolveRenderBaseUrl(url);

    if (renderBaseUrl.includes("localhost") || renderBaseUrl.includes("127.0.0.1")) {
      return NextResponse.json(
        { error: "Screenshot service cannot access localhost. Set APP_BASE_URL to a public URL and retry." },
        { status: 400 }
      );
    }

    const body = (await req.json().catch(() => ({}))) as { coins?: ScreenshotCoin[] };
    const provided = Array.isArray(body?.coins) ? body.coins.slice(0, 10) : [];
    const top10 = provided.length ? provided : await fetchTop10ForRender(renderBaseUrl);

    if (!top10.length) {
      return NextResponse.json({ error: "No trending coin data available for screenshot render." }, { status: 500 });
    }

    const now = Date.now();
    const seed = `${now}-${Math.floor(Math.random() * 10000)}`;
    const dataParam = Buffer.from(JSON.stringify(top10), "utf-8").toString("base64url");
    const renderUrl = `${renderBaseUrl}/screenshot?seed=${encodeURIComponent(seed)}&v=${now}&data=${encodeURIComponent(dataParam)}`;

    const { bytes, contentType } = await getImageFromScreenshotService(renderUrl, {
      width: 540,
      height: 730,
      delayMs: 2000,
    });

    const day = new Date().toISOString().slice(0, 10);
    const fileName = `trending-coins-${day}-${Date.now()}.png`;
    const storagePath = `dailytrend/${day}/${fileName}`;
    const file = adminStorage.file(storagePath);

    await file.save(bytes, {
      contentType,
      resumable: false,
      metadata: {
        cacheControl: "public, max-age=31536000",
      },
    });

    await file.makePublic();
    const imageUrl = `https://storage.googleapis.com/${adminStorage.name}/${storagePath}`;

    return NextResponse.json({ imageUrl, imageFile: imageUrl, storagePath });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to create screenshot image.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
