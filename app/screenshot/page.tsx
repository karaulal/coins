import TrendingScreenshotCard from "@/components/TrendingScreenshotCard";
import type { Metadata } from "next";
import { headers } from "next/headers";
import type { CardVariant } from "@/components/TrendingScreenshotCard";

export const dynamic = "force-dynamic";
export const revalidate = 0;

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

type Coin = {
  id: string;
  symbol: string;
  name: string;
  image: string;
  current_price: number;
  market_cap_rank: number | null;
  total_volume: number;
  price_change_percentage_24h: number | null;
  price_change_percentage_7d_in_currency?: number | null;
};

function snapshotDateMDY() {
  const d = new Date();
  const month = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  const year = d.getUTCFullYear();
  return `${month}/${day}/${year}`;
}

const ALL_VARIANTS: CardVariant[] = [
  "list",
  "grid",
  "funnel",
  "heatmap",
  "bubbles",
  "bars",
];

function pickVariant(forced?: string): CardVariant {
  if (forced && ALL_VARIANTS.includes(forced as CardVariant)) {
    return forced as CardVariant;
  }

  const index = Math.floor(Math.random() * ALL_VARIANTS.length);
  return ALL_VARIANTS[index];
}

async function getBaseUrl() {
  const envBase = process.env.NEXT_PUBLIC_APP_URL || process.env.APP_BASE_URL;
  if (envBase) return envBase.replace(/\/+$/, "");

  const h = await headers();
  const host = h.get("x-forwarded-host") || h.get("host") || "localhost:3000";
  const proto = h.get("x-forwarded-proto") || (host.includes("localhost") ? "http" : "https");
  return `${proto}://${host}`;
}

export async function generateMetadata({
  searchParams,
}: {
  searchParams: Promise<{ t?: string }>;
}): Promise<Metadata> {
  const query = await searchParams;
  const baseUrl = await getBaseUrl();
  const stamp = String(query?.t || Date.now());
  const imageUrl = `${baseUrl}/api/screenshot/build?t=${encodeURIComponent(stamp)}`;
  const pageUrl = `${baseUrl}/screenshot?t=${encodeURIComponent(stamp)}`;

  return {
    title: "Trending Coins Screenshot",
    description: "Trending coins image preview.",
    openGraph: {
      title: "Trending Coins Screenshot",
      description: "Trending coins image preview.",
      type: "website",
      url: pageUrl,
      images: [{ url: imageUrl, width: 540, height: 750, alt: "Trending coins screenshot" }],
    },
    twitter: {
      card: "summary_large_image",
      title: "Trending Coins Screenshot",
      description: "Trending coins image preview.",
      images: [imageUrl],
    },
  };
}

const API_KEY = process.env.COINGECKO_API_KEY || process.env.NEXT_PUBLIC_COINGECKO_API_KEY;

async function getTop10FromApi(): Promise<ScreenshotCoin[]> {
  if (!API_KEY) return [];

  const url =
    "https://api.coingecko.com/api/v3/coins/markets" +
    "?vs_currency=usd&per_page=250&page=1&sparkline=false&price_change_percentage=24h,7d";

  const response = await fetch(url, {
    method: "GET",
    headers: {
      "x-cg-demo-api-key": API_KEY,
      Accept: "application/json",
    },
    cache: "no-store",
  });

  if (!response.ok) return [];

  const payload = (await response.json()) as Coin[];
  return payload
    .sort(
      (a, b) =>
        (b.price_change_percentage_24h ?? -999999) -
        (a.price_change_percentage_24h ?? -999999)
    )
    .slice(0, 10)
    .map((coin) => ({
      id: coin.id,
      name: coin.name,
      symbol: (coin.symbol || "").toUpperCase(),
      image: coin.image,
      currentPrice: coin.current_price,
      marketCapRank: coin.market_cap_rank,
      totalVolume: coin.total_volume,
      priceChange24hPct: coin.price_change_percentage_24h,
      priceChange7dPct: coin.price_change_percentage_7d_in_currency ?? null,
    }));
}

function parseCoinDataParam(raw: string): ScreenshotCoin[] | null {
  const value = String(raw || "").trim();
  if (!value) return null;

  try {
    const json = Buffer.from(value, "base64url").toString("utf-8");
    const parsed = JSON.parse(json);
    if (!Array.isArray(parsed)) return null;

    const normalized = parsed
      .map((coin: unknown) => {
        const item = coin as Record<string, unknown>;
        return {
          id: String(item?.id || ""),
          symbol: String(item?.symbol || "").toUpperCase(),
          name: String(item?.name || ""),
          image: String(item?.image || ""),
          currentPrice: Number(item?.currentPrice),
          marketCapRank:
            item?.marketCapRank === null || item?.marketCapRank === undefined
              ? null
              : Number(item.marketCapRank),
          totalVolume: Number(item?.totalVolume),
          priceChange24hPct:
            item?.priceChange24hPct === null || item?.priceChange24hPct === undefined
              ? null
              : Number(item.priceChange24hPct),
          priceChange7dPct:
            item?.priceChange7dPct === null || item?.priceChange7dPct === undefined
              ? null
              : Number(item.priceChange7dPct),
        };
      })
      .filter((coin: ScreenshotCoin) => coin.id && coin.name)
      .slice(0, 10);

    return normalized.length ? normalized : null;
  } catch {
    return null;
  }
}

export default async function ScreenshotPage({
  searchParams,
}: {
  searchParams: Promise<{ seed?: string; data?: string; variant?: string }>;
}) {
  const query = await searchParams;
  const seed = String(query?.seed || "shot").trim();
  const dateLabel = snapshotDateMDY();
  const top10 = parseCoinDataParam(String(query?.data || "")) || (await getTop10FromApi());
  const variant = pickVariant(String(query?.variant || "").trim());
  const rows = top10.length
    ? top10
    : [
        {
          id: "placeholder",
          name: "No Data",
          symbol: "N/A",
          image: "https://assets.coingecko.com/coins/images/1/large/bitcoin.png",
          currentPrice: 0,
          marketCapRank: null,
          totalVolume: 0,
          priceChange24hPct: null,
          priceChange7dPct: null,
        },
      ];

  return (
    <main
      style={{
        margin: 0,
        width: 540,
        height: 750,
        background: "#ffffff",
        overflow: "hidden",
        fontFamily:
          '"Noto Sans","Noto Sans CJK SC","Noto Sans SC","PingFang SC","Hiragino Sans GB","Microsoft YaHei","Arial Unicode MS","Segoe UI Symbol",sans-serif',
      }}
    >
      <TrendingScreenshotCard
        coins={rows}
        snapshotLabel={dateLabel}
        keyPrefix={seed}
        variant={variant}
      />
    </main>
  );
}
