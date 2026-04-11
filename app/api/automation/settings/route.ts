import { NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { adminDb } from "@/lib/firebase-admin";

export const dynamic = "force-dynamic";

type AutomationConfig = {
  enabled: boolean;
  slots: string[];
  timeZone: string;
  xConnected?: boolean;
  xUserName?: string | null;
};

const CONFIG_DOC_PATH = "automation/config";

function normalizeSlots(value: unknown): string[] {
  if (!Array.isArray(value)) return ["08:00", "17:00"];
  const unique = new Set<string>();
  for (const item of value) {
    const v = String(item || "").trim();
    if (/^\d{2}:\d{2}$/.test(v)) unique.add(v);
  }
  return unique.size ? [...unique].sort() : ["08:00", "17:00"];
}

function normalizeTimeZone(value: unknown): string {
  const tz = String(value || "").trim();
  if (!tz) return "UTC";
  try {
    Intl.DateTimeFormat("en-US", { timeZone: tz }).format(new Date());
    return tz;
  } catch {
    return "UTC";
  }
}

async function readConfig(): Promise<AutomationConfig> {
  const snap = await adminDb.doc(CONFIG_DOC_PATH).get();
  if (!snap.exists) {
    return { enabled: false, slots: ["08:00", "17:00"], timeZone: "UTC" };
  }

  const data = snap.data() as Record<string, unknown>;
  return {
    enabled: Boolean(data?.enabled),
    slots: normalizeSlots(data?.slots),
    timeZone: normalizeTimeZone(data?.timeZone),
  };
}

export async function GET() {
  try {
    const config = await readConfig();
    const xCredSnap = await adminDb.doc("automation/xCredentials").get();
    const xData = (xCredSnap.data() || {}) as {
      xAccessToken?: string;
      xAccessTokenSecret?: string;
      xUserName?: string | null;
    };

    const xConnected =
      String(xData?.xAccessToken || "").trim().length > 0 &&
      String(xData?.xAccessTokenSecret || "").trim().length > 0;

    return NextResponse.json({
      ...config,
      xConnected,
      xUserName: xConnected ? String(xData?.xUserName || "").trim() || null : null,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to read automation settings.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const body = (await req.json().catch(() => ({}))) as Partial<AutomationConfig>;

    const config: AutomationConfig = {
      enabled: Boolean(body?.enabled),
      slots: normalizeSlots(body?.slots),
      timeZone: normalizeTimeZone(body?.timeZone),
    };

    await adminDb.doc(CONFIG_DOC_PATH).set(
      {
        enabled: config.enabled,
        slots: config.slots,
        timeZone: config.timeZone,
        updatedAt: FieldValue.serverTimestamp(),
      },
      { merge: true }
    );

    return NextResponse.json({ ok: true, ...config });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to save automation settings.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
