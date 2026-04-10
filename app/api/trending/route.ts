import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

type MarketCoin = {
  id: string;
  symbol: string;
  name: string;
  image: string;
  current_price: number;
  market_cap_rank: number | null;
  market_cap: number;
  total_volume: number;
  high_24h: number;
  low_24h: number;
  price_change_percentage_24h: number | null;
  price_change_percentage_7d_in_currency?: number | null;
  price_change_percentage_1h_in_currency?: number | null;
  last_updated?: string;
};

const API_KEY = process.env.COINGECKO_API_KEY || process.env.NEXT_PUBLIC_COINGECKO_API_KEY;

export async function GET() {
  if (!API_KEY) {
    return NextResponse.json(
      { error: "Missing COINGECKO_API_KEY environment variable." },
      { status: 500 }
    );
  }

  const url =
    "https://api.coingecko.com/api/v3/coins/markets" +
    "?vs_currency=usd&per_page=250&page=1&sparkline=false&price_change_percentage=1h,24h,7d";

  try {
    const response = await fetch(url, {
      method: "GET",
      headers: {
        "x-cg-demo-api-key": API_KEY,
        Accept: "application/json",
      },
      cache: "no-store",
    });

    if (!response.ok) {
      const errorBody = await response.text();
      return NextResponse.json(
        {
          error: "Failed to fetch CoinGecko markets data.",
          status: response.status,
          details: errorBody.slice(0, 240),
        },
        { status: 500 }
      );
    }

    const payload = (await response.json()) as MarketCoin[];

    const top20 = [...payload]
      .sort((a, b) => (b.price_change_percentage_24h ?? -999999) - (a.price_change_percentage_24h ?? -999999))
      .slice(0, 20)
      .map((coin, idx) => ({
        rankByTrend: idx + 1,
        id: coin.id,
        name: coin.name,
        symbol: (coin.symbol || "").toUpperCase(),
        image: coin.image,
        currentPrice: coin.current_price,
        marketCapRank: coin.market_cap_rank,
        marketCap: coin.market_cap,
        totalVolume: coin.total_volume,
        high24h: coin.high_24h,
        low24h: coin.low_24h,
        priceChange24hPct: coin.price_change_percentage_24h,
        priceChange7dPct: coin.price_change_percentage_7d_in_currency ?? null,
        priceChange1hPct: coin.price_change_percentage_1h_in_currency ?? null,
        lastUpdated: coin.last_updated ?? null,
      }));

    return NextResponse.json({
      generatedAt: new Date().toISOString(),
      count: top20.length,
      coins: top20,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json(
      {
        error: "Unexpected error while fetching trends.",
        details: String(message).slice(0, 240),
      },
      { status: 500 }
    );
  }
}
