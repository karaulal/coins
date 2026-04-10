import { NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { adminDb } from "@/lib/firebase-admin";

type CoinInput = {
  id: string;
  name: string;
  symbol: string;
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

function normalizeNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function normalizeString(value: unknown): string | null {
  return typeof value === "string" && value.length ? value : null;
}

function currentDateMDY() {
  const d = new Date();
  const month = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  const year = d.getUTCFullYear();
  return `${month}/${day}/${year}`;
}

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as {
      fetchedAt?: string;
      imageUrl?: string;
      imageFile?: string;
      source?: string;
      coins?: CoinInput[];
    };

    const coins = Array.isArray(body?.coins) ? body.coins : [];
    if (!coins.length) {
      return NextResponse.json({ error: "No coins provided." }, { status: 400 });
    }

    const nestedCoins = coins.reduce<Record<string, unknown>>((acc, coin, idx) => {
      acc[`coin${idx + 1}`] = {
        id: normalizeString(coin.id),
        name: normalizeString(coin.name),
        symbol: normalizeString(coin.symbol),
        price: normalizeNumber(coin.currentPrice),
        priceChange24hPct: normalizeNumber(coin.priceChange24hPct),
        priceChange7dPct: normalizeNumber(coin.priceChange7dPct),
        marketCapRank: normalizeNumber(coin.marketCapRank),
        marketCap: normalizeNumber(coin.marketCap),
        totalVolume: normalizeNumber(coin.totalVolume),
        high24h: normalizeNumber(coin.high24h),
        low24h: normalizeNumber(coin.low24h),
        image: normalizeString(coin.image),
        lastUpdated: normalizeString(coin.lastUpdated),
      };
      return acc;
    }, {});

    const docRef = await adminDb.collection("dailytrend").add({
      title: "TRENDING COINS LAST 24 HOURS",
      createdAt: FieldValue.serverTimestamp(),
      fetchedAt: body?.fetchedAt || currentDateMDY(),
      fetchedAtIso: new Date().toISOString(),
      imageUrl: body?.imageUrl || "",
      imageFile: body?.imageFile || "",
      source: body?.source || "coingecko/coins/markets",
      totalCoins: coins.length,
      coins: nestedCoins,
    });

    return NextResponse.json({ id: docRef.id });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to save daily trend entry.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
