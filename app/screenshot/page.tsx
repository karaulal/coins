export const dynamic = "force-dynamic";
export const revalidate = 0;

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

function usd(value: number | null | undefined) {
  if (typeof value !== "number" || Number.isNaN(value)) return "-";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: value < 1 ? 6 : 2,
  }).format(value);
}

function pct(value: number | null | undefined) {
  if (typeof value !== "number" || Number.isNaN(value)) return "-";
  return `${value >= 0 ? "+" : ""}${value.toFixed(2)}%`;
}

function compact(value: number | null | undefined) {
  if (typeof value !== "number" || Number.isNaN(value)) return "-";
  return new Intl.NumberFormat("en-US", {
    notation: "compact",
    maximumFractionDigits: 2,
  }).format(value);
}

function emojiForTrend(value: number | null | undefined) {
  if (typeof value !== "number" || Number.isNaN(value)) return "•";
  return value >= 0 ? "▲" : "▼";
}

const API_KEY =
  process.env.COINGECKO_API_KEY ||
  process.env.NEXT_PUBLIC_COINGECKO_API_KEY ||
  "CG-URjRqWcx2fcJZn4toPV6WGBW";

async function getTop10FromApi(): Promise<ScreenshotCoin[]> {
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
  searchParams: Promise<{ seed?: string; data?: string }>;
}) {
  const query = await searchParams;
  const seed = String(query?.seed || "").trim();
  const dateLabel = new Date().toLocaleDateString("en-US");
  const top10 = parseCoinDataParam(String(query?.data || "")) || (await getTop10FromApi());
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
        padding: 8,
        width: 540,
        height: 750,
        background: "#ffffff",
        overflow: "hidden",
        fontFamily: "Montserrat, system-ui, -apple-system, sans-serif",
      }}
    >
      <style>{`html,body{margin:0!important;padding:0!important;background:#fff!important;}*{box-sizing:border-box;}`}</style>

      <section
        style={{
          borderRadius: 14,
          color: "#fff",
          padding: 14,
          background:
            "radial-gradient(circle at 85% 10%, rgba(255,255,255,0.3), transparent 30%), linear-gradient(135deg,#0f172a,#2563eb)",
        }}
      >
        <p style={{ margin: 0, fontSize: 12, letterSpacing: "0.08em", fontWeight: 700, opacity: 0.9 }}>TRENDING COINS</p>
        <h1 style={{ margin: "8px 0 0", fontSize: 34, lineHeight: 1, fontWeight: 900 }}>TRENDING COINS LAST 24 HOURS</h1>
        <p style={{ margin: "8px 0 0", fontSize: 13 }}>Top movers ranked by 24h momentum</p>
      </section>

      <div style={{ marginTop: -12, padding: "0 8px", display: "flex", justifyContent: "space-between" }}>
        <span
          style={{
            display: "inline-flex",
            alignItems: "center",
            borderRadius: 999,
            padding: "6px 10px",
            fontSize: 11,
            fontWeight: 700,
            color: "#fff",
            background: "#0f172a",
          }}
        >
          Snapshot: {dateLabel}
        </span>
      </div>

      <section style={{ marginTop: 8, display: "grid", height: 560, alignContent: "start" }}>
        {rows.map((coin) => {
          const isUp = (coin.priceChange24hPct ?? 0) >= 0;
          return (
            <article
              key={`${coin.id}-${seed}`}
              style={{
                display: "grid",
                gridTemplateColumns: "40px 1fr",
                gap: 9,
                alignItems: "center",
                borderBottom: "1px solid #eaf0f8",
                padding: "6px 2px",
              }}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={coin.image}
                alt={coin.name}
                style={{
                  width: 38,
                  height: 38,
                  borderRadius: 10,
                  border: "1px solid #e0eaf8",
                  background: "#fff",
                }}
              />
              <div>
                <p style={{ margin: 0, fontSize: 16, fontWeight: 700, lineHeight: 1.1, color: "#0f172a" }}>
                  {coin.name} ({coin.symbol}){" "}
                  <span style={{ color: isUp ? "#0d8f49" : "#c33f2d", fontWeight: 700 }}>
                    {emojiForTrend(coin.priceChange24hPct)} {pct(coin.priceChange24hPct)}
                  </span>
                </p>
                <p
                  style={{
                    margin: "3px 0 0",
                    fontSize: 11,
                    color: "#4d5f7a",
                    whiteSpace: "nowrap",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                  }}
                >
                  {emojiForTrend(coin.priceChange7dPct)} 7d {pct(coin.priceChange7dPct)} | Price{" "}
                  <span style={{ fontWeight: 800, color: "#0f172a" }}>{usd(coin.currentPrice)}</span> | Vol {compact(coin.totalVolume)} | Rank #{coin.marketCapRank ?? "-"}
                </p>
              </div>
            </article>
          );
        })}
      </section>

      <footer
        style={{
          marginTop: 8,
          height: 38,
          borderRadius: 10,
          background: "#09111f",
          color: "#fff",
          display: "grid",
          placeItems: "center",
          fontSize: 12,
          fontWeight: 700,
        }}
      >
        Source: CoinGecko markets API | Size: 540 x 750
      </footer>
    </main>
  );
}
