import { NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { adminDb } from "@/lib/firebase-admin";
import { TwitterApi } from "twitter-api-v2";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type TrendingCoin = {
  id: string;
  symbol: string;
  name: string;
  image: string;
  currentPrice: number;
  marketCapRank: number | null;
  marketCap: number;
  totalVolume: number;
  high24h: number;
  low24h: number;
  priceChange24hPct: number | null;
  priceChange7dPct: number | null;
  lastUpdated: string | null;
};

function toMDYFromDateKey(dateKey: string): string {
  const [y, m, d] = dateKey.split("-");
  if (!y || !m || !d) return dateKey;
  return `${m}/${d}/${y}`;
}

function nowInTimeZone(timeZone: string) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(new Date());

  const map = Object.fromEntries(parts.map((p) => [p.type, p.value]));
  const year = String(map.year || "");
  const month = String(map.month || "");
  const day = String(map.day || "");
  const hour = String(map.hour || "");
  const minute = String(map.minute || "");

  return {
    dateKey: `${year}-${month}-${day}`,
    timeKey: `${hour}:${minute}`,
  };
}

async function postToX(fileUrl: string, text: string) {
  const appKey = String(process.env.AUTH_TWITTER_ID || "").trim();
  const appSecret = String(process.env.AUTH_TWITTER_SECRET || "").trim();
  if (!appKey || !appSecret) {
    throw new Error("Missing AUTH_TWITTER_ID or AUTH_TWITTER_SECRET.");
  }

  const credSnap = await adminDb.doc("automation/xCredentials").get();
  if (!credSnap.exists) {
    throw new Error("No connected X credentials found. Connect X once from the admin UI.");
  }

  const cred = credSnap.data() as { xAccessToken?: string; xAccessTokenSecret?: string };
  const accessToken = String(cred?.xAccessToken || "").trim();
  const accessSecret = String(cred?.xAccessTokenSecret || "").trim();
  if (!accessToken || !accessSecret) {
    throw new Error("Stored X credentials are incomplete. Reconnect X from the admin UI.");
  }

  const imageRes = await fetch(fileUrl, { cache: "no-store" });
  if (!imageRes.ok) throw new Error(`Failed to fetch image for X post: ${imageRes.status}`);

  const contentType =
    String(imageRes.headers.get("content-type") || "image/png").trim() || "image/png";
  const mediaBuffer = Buffer.from(await imageRes.arrayBuffer());

  const xClient = new TwitterApi({ appKey, appSecret, accessToken, accessSecret });
  const mediaId = await xClient.v1.uploadMedia(mediaBuffer, {
    mimeType: contentType as "image/png" | "image/jpeg" | "image/gif" | "image/webp",
  });

  const tweet = await xClient.v2.tweet({ text, media: { media_ids: [mediaId] } });
  return tweet.data.id;
}

async function runWorkflow(baseUrl: string, dateLabel: string) {
  const trendingRes = await fetch(`${baseUrl}/api/trending`, { method: "GET", cache: "no-store" });
  const trendingPayload = (await trendingRes.json().catch(() => ({}))) as { coins?: TrendingCoin[]; error?: string };
  if (!trendingRes.ok) {
    throw new Error(String(trendingPayload?.error || "Failed to fetch trending coins."));
  }

  const coins = Array.isArray(trendingPayload?.coins) ? trendingPayload.coins.slice(0, 10) : [];
  if (!coins.length) throw new Error("No trending coins to process.");

  const createRes = await fetch(`${baseUrl}/api/screenshot/create`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ coins }),
  });
  const createPayload = (await createRes.json().catch(() => ({}))) as { imageUrl?: string; error?: string };
  if (!createRes.ok) {
    throw new Error(String(createPayload?.error || "Screenshot creation failed."));
  }

  const imageUrl = String(createPayload?.imageUrl || "").trim();
  if (!imageUrl) throw new Error("Missing image URL from screenshot creation.");

  const persistRes = await fetch(`${baseUrl}/api/dailytrend`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      fetchedAt: dateLabel,
      imageUrl,
      imageFile: imageUrl,
      source: "automation-cron",
      coins,
    }),
  });
  const persistPayload = (await persistRes.json().catch(() => ({}))) as { error?: string; id?: string };
  if (!persistRes.ok) {
    throw new Error(String(persistPayload?.error || "Failed to persist daily trend entry."));
  }

  const webhookRes = await fetch(`${baseUrl}/api/webhook/send-image`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ fileUrl: imageUrl, date: dateLabel }),
  });
  const webhookPayload = (await webhookRes.json().catch(() => ({}))) as { error?: string };
  if (!webhookRes.ok) {
    throw new Error(String(webhookPayload?.error || "Webhook send failed."));
  }

  const tweetId = await postToX(imageUrl, `Trending coins update • ${dateLabel}`);

  return {
    imageUrl,
    dailyTrendId: String(persistPayload?.id || ""),
    tweetId,
  };
}

export async function GET(req: Request) {
  const startedAt = Date.now();
  try {
    const cronSecret = process.env.CRON_SECRET;
    if (cronSecret) {
      const auth = req.headers.get("authorization") || "";
      if (auth !== `Bearer ${cronSecret}`) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      }
    }

    const configSnap = await adminDb.doc("automation/config").get();
    if (!configSnap.exists) {
      return NextResponse.json({ ok: true, skipped: true, reason: "Automation config not set." });
    }

    const config = configSnap.data() as {
      enabled?: boolean;
      slots?: string[];
      timeZone?: string;
    };

    const enabled = Boolean(config?.enabled);
    const slots = Array.isArray(config?.slots)
      ? config.slots.filter((s) => /^\d{2}:\d{2}$/.test(String(s || "")))
      : [];
    const timeZone = String(config?.timeZone || "UTC");

    if (!enabled || !slots.length) {
      return NextResponse.json({ ok: true, skipped: true, reason: "Automation disabled or no slots." });
    }

    const now = nowInTimeZone(timeZone);
    const dueSlots = slots.filter((slot) => slot === now.timeKey);

    if (!dueSlots.length) {
      return NextResponse.json({ ok: true, skipped: true, reason: "No slot due at this minute.", now });
    }

    const baseUrl =
      String(process.env.APP_BASE_URL || "").trim().replace(/\/+$/, "") ||
      `${new URL(req.url).protocol}//${new URL(req.url).host}`;

    const results: Array<Record<string, unknown>> = [];

    for (const slot of dueSlots) {
      const runId = `${now.dateKey}-${slot.replace(":", "")}`;
      const runRef = adminDb.collection("automation_runs").doc(runId);
      const runDoc = await runRef.get();
      if (runDoc.exists) {
        results.push({ slot, runId, skipped: true, reason: "Already executed for this slot/day." });
        continue;
      }

      await runRef.set({
        slot,
        dateKey: now.dateKey,
        timeZone,
        status: "running",
        createdAt: FieldValue.serverTimestamp(),
      });

      try {
        const workflow = await runWorkflow(baseUrl, toMDYFromDateKey(now.dateKey));
        await runRef.set(
          {
            status: "success",
            completedAt: FieldValue.serverTimestamp(),
            result: workflow,
          },
          { merge: true }
        );
        results.push({ slot, runId, ok: true, ...workflow });
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : "Automation run failed.";
        await runRef.set(
          {
            status: "failed",
            completedAt: FieldValue.serverTimestamp(),
            error: message,
          },
          { merge: true }
        );
        results.push({ slot, runId, ok: false, error: message });
      }
    }

    return NextResponse.json({
      ok: true,
      now,
      dueSlots,
      results,
      durationMs: Date.now() - startedAt,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Automation cron failed.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
