import { NextResponse } from "next/server";
import { adminStorage } from "@/lib/firebase-admin";

export const dynamic = "force-dynamic";

function parseTime(value: string | undefined): number | null {
  if (!value) return null;
  const ts = Date.parse(value);
  return Number.isNaN(ts) ? null : ts;
}

export async function GET(req: Request) {
  try {
    const cronSecret = process.env.CRON_SECRET;
    if (cronSecret) {
      const auth = req.headers.get("authorization") || "";
      if (auth !== `Bearer ${cronSecret}`) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      }
    }

    const cutoff = Date.now() - 30 * 24 * 60 * 60 * 1000;
    const [files] = await adminStorage.getFiles({ prefix: "dailytrend/" });

    let deleted = 0;
    let skipped = 0;

    for (const file of files) {
      const timeCreated =
        parseTime(file.metadata?.timeCreated) ||
        parseTime(file.metadata?.updated) ||
        null;

      if (!timeCreated) {
        skipped += 1;
        continue;
      }

      if (timeCreated < cutoff) {
        await file.delete({ ignoreNotFound: true });
        deleted += 1;
      }
    }

    return NextResponse.json({
      ok: true,
      scanned: files.length,
      deleted,
      skipped,
      cutoffIso: new Date(cutoff).toISOString(),
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Cleanup failed.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
