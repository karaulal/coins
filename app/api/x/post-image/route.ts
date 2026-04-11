import { NextResponse } from "next/server";
import { getToken } from "next-auth/jwt";
import { TwitterApi } from "twitter-api-v2";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type XJwtToken = {
  xAccessToken?: string;
  xAccessTokenSecret?: string;
};

export async function POST(req: Request) {
  try {
    const token = (await getToken({
      req: req as never,
      secret: process.env.NEXTAUTH_SECRET || process.env.AUTH_SECRET,
    })) as XJwtToken | null;

    const accessToken = String(token?.xAccessToken || "").trim();
    const accessSecret = String(token?.xAccessTokenSecret || "").trim();

    if (!accessToken || !accessSecret) {
      return NextResponse.json({ error: "Connect your X account first." }, { status: 401 });
    }

    const appKey = String(process.env.AUTH_TWITTER_ID || "").trim();
    const appSecret = String(process.env.AUTH_TWITTER_SECRET || "").trim();
    if (!appKey || !appSecret) {
      return NextResponse.json(
        { error: "Missing AUTH_TWITTER_ID or AUTH_TWITTER_SECRET." },
        { status: 500 }
      );
    }

    const body = (await req.json().catch(() => ({}))) as { fileUrl?: string; text?: string };
    const fileUrl = String(body?.fileUrl || "").trim();
    const text = String(body?.text || "Trending coins update").trim();

    if (!fileUrl) {
      return NextResponse.json({ error: "fileUrl is required." }, { status: 400 });
    }

    const imageRes = await fetch(fileUrl, { cache: "no-store" });
    if (!imageRes.ok) {
      return NextResponse.json(
        { error: `Failed to fetch image: ${imageRes.status}` },
        { status: 502 }
      );
    }

    const contentType = String(imageRes.headers.get("content-type") || "image/png").trim() || "image/png";
    const mediaBuffer = Buffer.from(await imageRes.arrayBuffer());

    const xClient = new TwitterApi({
      appKey,
      appSecret,
      accessToken,
      accessSecret,
    });

    const mediaId = await xClient.v1.uploadMedia(mediaBuffer, {
      mimeType: contentType as "image/png" | "image/jpeg" | "image/gif" | "image/webp",
    });

    const tweet = await xClient.v2.tweet({
      text,
      media: { media_ids: [mediaId] },
    });

    return NextResponse.json({ ok: true, tweetId: tweet.data.id, text: tweet.data.text });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to post image to X.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
