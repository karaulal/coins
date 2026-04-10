import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

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

async function getImageFromScreenshotService(renderUrl: string): Promise<{ bytes: Buffer; contentType: string }> {
  const controller = new AbortController();
  const timeoutHandle = setTimeout(() => controller.abort(), 90_000);

  let response: Response;
  try {
    const service = "https://bubble2-797487328877.europe-west1.run.app/screenshot";
    response = await fetch(service, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "image/png,image/*;q=0.9,*/*;q=0.8",
      },
      body: JSON.stringify({
        url: renderUrl,
        width: 540,
        height: 750,
        fullPage: false,
        type: "png",
        waitUntil: "networkidle",
        delayMs: 2000,
      }),
      signal: controller.signal,
    });

    if (!response.ok && [400, 404, 405, 415, 422].includes(Number(response.status))) {
      response = await fetch(service, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "image/png,image/*;q=0.9,*/*;q=0.8",
        },
        body: JSON.stringify({ url: renderUrl }),
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

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const renderBaseUrl = resolveRenderBaseUrl(url);

    if (
      renderBaseUrl.includes("localhost") ||
      renderBaseUrl.includes("127.0.0.1")
    ) {
      return NextResponse.json(
        {
          error:
            "Screenshot service cannot access localhost. Set APP_BASE_URL to a public URL and retry.",
        },
        { status: 400 }
      );
    }

    const renderUrl = `${renderBaseUrl}/screenshot?seed=${encodeURIComponent(`${Date.now()}-${Math.floor(Math.random() * 10000)}`)}`;
    const { bytes, contentType } = await getImageFromScreenshotService(renderUrl);

    const safeBytes = Uint8Array.from(bytes);
    const body = new Blob([safeBytes], { type: contentType });

    return new NextResponse(body, {
      status: 200,
      headers: {
        "Content-Type": contentType,
        "Cache-Control": "no-store",
        "Content-Length": String(bytes.length),
      },
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to build screenshot image.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
