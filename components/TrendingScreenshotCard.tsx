type ScreenshotCoin = {
  id: string;
  name: string;
  symbol: string;
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

export default function TrendingScreenshotCard({
  coins,
  snapshotLabel,
  keyPrefix,
}: {
  coins: ScreenshotCoin[];
  snapshotLabel: string;
  keyPrefix?: string;
}) {
  return (
    <div className="screenshot-canvas">
      <section className="shot-header">
        <div className="shot-bg-icons" aria-hidden="true">
          <img src="https://assets.coingecko.com/coins/images/1/large/bitcoin.png" alt="" />
          <img src="https://assets.coingecko.com/coins/images/279/large/ethereum.png" alt="" />
          <img src="https://assets.coingecko.com/coins/images/4128/large/solana.png" alt="" />
          <img src="https://assets.coingecko.com/coins/images/975/large/cardano.png" alt="" />
          <img src="https://assets.coingecko.com/coins/images/2/large/litecoin.png" alt="" />
          <img src="https://assets.coingecko.com/coins/images/5/large/dogecoin.png" alt="" />
          <img src="https://assets.coingecko.com/coins/images/325/large/Tether.png" alt="" />
          <img src="https://assets.coingecko.com/coins/images/6319/large/usdc.png" alt="" />
          <img src="https://assets.coingecko.com/coins/images/44/large/xrp-symbol-white-128.png" alt="" />
        </div>
        <p className="shot-kicker">TRENDING COINS</p>
        <h3>🔥 TRENDING COINS LAST 24 HOURS 🔥</h3>
        <p className="shot-sub">Top movers ranked by 24h momentum</p>
      </section>

      <div className="shot-pills">
        <span className="pill dark">Snapshot: {snapshotLabel}</span>
      </div>

      <section className="shot-list">
        {coins.map((coin, index) => {
          const isUp = (coin.priceChange24hPct ?? 0) >= 0;
          return (
            <article key={`${keyPrefix || "shot"}-${coin.id}-${index}`} className="shot-row">
              <img src={coin.image} alt={coin.name} className="shot-logo" />
              <div className="shot-content">
                <p className="shot-title">
                  {coin.name} ({coin.symbol})
                  <span className={isUp ? "up" : "down"}>
                    {" "}
                    {emojiForTrend(coin.priceChange24hPct)} {pct(coin.priceChange24hPct)}
                  </span>
                </p>
                <p className="shot-meta">
                  {emojiForTrend(coin.priceChange7dPct)} 7d {pct(coin.priceChange7dPct)} | Price <span className="shot-price">{usd(coin.currentPrice)}</span> | Vol {compact(coin.totalVolume)} | Rank #{coin.marketCapRank ?? "-"}
                </p>
              </div>
            </article>
          );
        })}
      </section>

      <footer className="shot-footer">Follow the Page — Keep Track of the Market</footer>
    </div>
  );
}
