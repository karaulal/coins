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

export type CardVariant =
  | "list"
  | "grid"
  | "funnel"
  | "heatmap"
  | "bubbles"
  | "bars";

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

function safeNumber(value: number | null | undefined) {
  if (typeof value !== "number" || Number.isNaN(value)) return 0;
  return value;
}

function norm(value: number, min: number, max: number) {
  if (max <= min) return 0.5;
  return (value - min) / (max - min);
}

function colorForHeat(index: number) {
  const palette = [
    "#ff4d4d",
    "#ff7a45",
    "#ffa940",
    "#73d13d",
    "#36cfc9",
    "#40a9ff",
    "#597ef7",
    "#9254de",
    "#f759ab",
    "#13c2c2",
  ];
  return palette[index % palette.length];
}

function randomFrom<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function randomBarColor() {
  const colors = [
    "#e64a19",
    "#f9a825",
    "#c62828",
    "#0288d1",
    "#2e7d32",
    "#7b1fa2",
    "#ff8f00",
    "#455a64",
    "#c2185b",
    "#388e3c",
    "#d84315",
    "#00796b",
    "#6a1b9a",
    "#546e7a",
    "#3949ab",
    "#ef6c00",
    "#00838f",
  ];
  return randomFrom(colors);
}

function randomBubbleGradient() {
  const pairs: Array<[string, string]> = [
    ["#334155", "#0f172a"],
    ["#facc15", "#854d0e"],
    ["#ef4444", "#7f1d1d"],
    ["#1e3a8a", "#0f172a"],
    ["#4c1d95", "#1f2937"],
    ["#4338ca", "#111827"],
    ["#0f766e", "#1f2937"],
    ["#7c2d12", "#1f2937"],
    ["#374151", "#0b1220"],
    ["#312e81", "#111827"],
    ["#155e75", "#1f2937"],
    ["#7f1d1d", "#1f2937"],
    ["#1f2937", "#111827"],
    ["#3f3f46", "#18181b"],
    ["#0f766e", "#0f172a"],
    ["#4a044e", "#1f2937"],
    ["#1d4ed8", "#111827"],
  ];
  const pair = randomFrom(pairs);
  return `radial-gradient(circle at 28% 22%, ${pair[0]}, ${pair[1]})`;
}

type HeatTile = {
  coin: ScreenshotCoin;
  weight: number;
  share: number;
  x: number;
  y: number;
  w: number;
  h: number;
  colorIndex: number;
};

type BubbleTile = {
  coin: ScreenshotCoin;
  size: number;
  left: number;
  top: number;
};

function buildHeatTreemap(coins: ScreenshotCoin[]): HeatTile[] {
  if (!coins.length) return [];

  const weightsRaw = coins.map((coin) => {
    const val = Math.abs(safeNumber(coin.priceChange24hPct));
    return val > 0 ? val : 0.01;
  });
  const totalWeightRaw = weightsRaw.reduce((sum, v) => sum + v, 0) || 1;

  const base = coins
    .map((coin, index) => ({
      coin,
      colorIndex: index,
      weight: weightsRaw[index],
      share: weightsRaw[index] / totalWeightRaw,
    }))
    .sort((a, b) => b.weight - a.weight);

  const placed: HeatTile[] = [];

  function layout(
    items: Array<{ coin: ScreenshotCoin; colorIndex: number; weight: number; share: number }>,
    x: number,
    y: number,
    w: number,
    h: number
  ) {
    if (!items.length || w <= 0 || h <= 0) return;
    if (items.length === 1) {
      const item = items[0];
      placed.push({ ...item, x, y, w, h });
      return;
    }

    const total = items.reduce((sum, item) => sum + item.weight, 0);
    let acc = 0;
    let split = 0;
    while (split < items.length - 1 && acc < total / 2) {
      acc += items[split].weight;
      split += 1;
    }

    const left = items.slice(0, split);
    const right = items.slice(split);
    const leftTotal = left.reduce((sum, item) => sum + item.weight, 0);
    const ratio = total > 0 ? leftTotal / total : 0.5;

    if (w >= h) {
      const wLeft = w * ratio;
      layout(left, x, y, wLeft, h);
      layout(right, x + wLeft, y, w - wLeft, h);
    } else {
      const hTop = h * ratio;
      layout(left, x, y, w, hTop);
      layout(right, x, y + hTop, w, h - hTop);
    }
  }

  layout(base, 0, 0, 100, 100);
  return placed;
}

function minBubbleDiameter(coin: ScreenshotCoin) {
  const textLen = Math.max(coin.symbol.length, pct(coin.priceChange24hPct).length);
  return Math.max(58, 18 + textLen * 7);
}

function buildProportionalBubbleTiles(coins: ScreenshotCoin[]): BubbleTile[] {
  const width = 524;
  const height = 500;
  if (!coins.length) return [];

  const movement = coins.map((coin) => Math.max(0.01, Math.abs(safeNumber(coin.priceChange24hPct))));
  const total = movement.reduce((sum, v) => sum + v, 0) || 1;
  const shares = movement.map((v) => v / total);

  const targetArea = width * height * 0.3;
  const proposed = coins.map((coin, i) => {
    const area = shares[i] * targetArea;
    const diameter = 2 * Math.sqrt(area / Math.PI);
    const minD = minBubbleDiameter(coin);
    return {
      coin,
      size: Math.max(minD, diameter),
    };
  });

  const sorted = proposed.sort((a, b) => b.size - a.size);
  const placed: BubbleTile[] = [];
  const margin = 4;

  for (const bubble of sorted) {
    const r = bubble.size / 2;
    let found = false;

    for (let attempt = 0; attempt < 700; attempt += 1) {
      const cx = r + margin + Math.random() * (width - 2 * (r + margin));
      const cy = r + margin + Math.random() * (height - 2 * (r + margin));

      const overlaps = placed.some((p) => {
        const pr = p.size / 2;
        const pcx = p.left + pr;
        const pcy = p.top + pr;
        const dx = cx - pcx;
        const dy = cy - pcy;
        return Math.sqrt(dx * dx + dy * dy) < r + pr + margin;
      });

      if (!overlaps) {
        placed.push({
          coin: bubble.coin,
          size: bubble.size,
          left: cx - r,
          top: cy - r,
        });
        found = true;
        break;
      }
    }

    if (!found) {
      const shrinkSize = Math.max(minBubbleDiameter(bubble.coin), bubble.size * 0.9);
      placed.push({
        coin: bubble.coin,
        size: shrinkSize,
        left: Math.max(0, Math.min(width - shrinkSize, Math.random() * (width - shrinkSize))),
        top: Math.max(0, Math.min(height - shrinkSize, Math.random() * (height - shrinkSize))),
      });
    }
  }

  return placed;
}

export default function TrendingScreenshotCard({
  coins,
  snapshotLabel,
  keyPrefix,
  variant = "list",
}: {
  coins: ScreenshotCoin[];
  snapshotLabel: string;
  keyPrefix?: string;
  variant?: CardVariant;
}) {
  const topNine = coins.slice(0, 9);
  const topTen = coins.slice(0, 10);

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

      {variant === "list" && (
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
      )}

      {variant === "grid" && (
        <section className="shot-grid">
          {topNine.map((coin, index) => {
            const up24 = (coin.priceChange24hPct ?? 0) >= 0;
            const up7d = (coin.priceChange7dPct ?? 0) >= 0;
            return (
              <article key={`${keyPrefix || "shot"}-grid-${coin.id}-${index}`} className="shot-box">
                <span className="shot-badge">{index + 1}</span>
                <p className="shot-box-name-top">{coin.name}</p>
                <div className="shot-box-head">
                  <img src={coin.image} alt={coin.name} className="shot-box-logo" />
                  <p className="shot-box-title">{coin.symbol}</p>
                </div>
                <p className="shot-box-line shot-box-line-24h">
                  24h <span className={up24 ? "up" : "down"}>{pct(coin.priceChange24hPct)}</span>
                </p>
                <p className="shot-box-line">
                  7d <span className={up7d ? "up" : "down"}>{pct(coin.priceChange7dPct)}</span>
                </p>
                <div className="shot-box-bottom">
                  <p className="shot-box-line">
                    Price <span className="shot-price-strong">{usd(coin.currentPrice)}</span>
                  </p>
                  <p className="shot-box-line shot-box-line-split">
                    <span>Vol {compact(coin.totalVolume)}</span>
                    <span>Rank #{coin.marketCapRank ?? "-"}</span>
                  </p>
                </div>
              </article>
            );
          })}
        </section>
      )}

      {variant === "funnel" && (
        <section className="shot-funnel-wrap">
          <div className="shot-funnel">
            {topNine.map((coin, index) => {
              const pct24 = safeNumber(coin.priceChange24hPct);
              const pct7 = safeNumber(coin.priceChange7dPct);
              return (
                <article
                  key={`${keyPrefix || "shot"}-funnel-${coin.id}-${index}`}
                  className="shot-funnel-row"
                >
                  <div className="shot-funnel-left">
                    <p className="shot-funnel-symbol">{coin.symbol}</p>
                    <p className={`shot-funnel-trend ${pct24 >= 0 ? "up" : "down"}`}>{pct(pct24)}</p>
                  </div>
                  {index < 7 ? (
                    <img src={coin.image} alt={coin.name} className="shot-funnel-center-logo" />
                  ) : (
                    <span className="shot-funnel-center-gap" aria-hidden="true" />
                  )}
                  <div className="shot-funnel-right">
                    <p>
                      7d <span className={pct7 >= 0 ? "up" : "down"}>{pct(pct7)}</span> | Price <span className="shot-price-strong">{usd(coin.currentPrice)}</span>
                    </p>
                    <p>
                      Vol {compact(coin.totalVolume)} | Rank #{coin.marketCapRank ?? "-"}
                    </p>
                  </div>
                </article>
              );
            })}
          </div>
        </section>
      )}

      {variant === "heatmap" && (
        <section className="shot-heatmap">
          {buildHeatTreemap(topTen).map((tile) => {
            const areaShare = tile.share;
            const isSmall = areaShare < 0.08;
            return (
              <article
                key={`${keyPrefix || "shot"}-heat-${tile.coin.id}`}
                className={`shot-heat-cell ${isSmall ? "is-small" : "is-large"}`}
                style={{
                  background: colorForHeat(tile.colorIndex),
                  left: `${tile.x}%`,
                  top: `${tile.y}%`,
                  width: `${tile.w}%`,
                  height: `${tile.h}%`,
                }}
              >
                <div className="shot-heat-head">
                  <img src={tile.coin.image} alt={tile.coin.name} className="shot-heat-logo" />
                  <p className="shot-heat-title">{tile.coin.symbol}</p>
                </div>
                <p className="shot-heat-trend">{pct(tile.coin.priceChange24hPct)}</p>
                {!isSmall && (
                  <p className="shot-heat-meta">
                    Price <span className="shot-price-strong">{usd(tile.coin.currentPrice)}</span>
                  </p>
                )}
                {!isSmall && <p className="shot-heat-meta">Vol {compact(tile.coin.totalVolume)}</p>}
              </article>
            );
          })}
        </section>
      )}

      {variant === "bubbles" && (
        (() => {
          const bubbles = buildProportionalBubbleTiles(topTen);
          const bubbleFill = randomBubbleGradient();
          const sizes = bubbles.map((b) => b.size);
          const minSize = sizes.length ? Math.min(...sizes) : 56;
          const maxSize = sizes.length ? Math.max(...sizes) : 92;

          return (
            <section className="shot-bubble-stage">
              {bubbles.map((bubble, index) => {
                const t = norm(bubble.size, minSize, maxSize);
                const fontSize = Math.max(12, bubble.size * 0.22);
                const fontWeight = Math.round(300 + t * 600);
                const subSize = Math.max(10, bubble.size * 0.14);

                return (
                  <article
                    key={`${keyPrefix || "shot"}-bubble-${bubble.coin.id}-${index}`}
                    className="shot-bubble"
                    style={{
                      width: `${bubble.size}px`,
                      height: `${bubble.size}px`,
                      left: `${bubble.left}px`,
                      top: `${bubble.top}px`,
                      background: bubbleFill,
                      ["--bubble-font-size" as string]: `${fontSize}px`,
                      ["--bubble-font-weight" as string]: String(fontWeight),
                      ["--bubble-sub-size" as string]: `${subSize}px`,
                    }}
                  >
                    <img src={bubble.coin.image} alt={bubble.coin.name} className="shot-bubble-coin" />
                    <span>{bubble.coin.symbol}</span>
                    <small className="shot-bubble-trend">{pct(bubble.coin.priceChange24hPct)}</small>
                  </article>
                );
              })}
            </section>
          );
        })()
      )}

      {variant === "bars" && (
        (() => {
          const barColor = randomBarColor();
          return (
            <section className="shot-bar-chart">
              {topTen.map((coin, index) => {
                const firstAbs = Math.max(0.0001, Math.abs(safeNumber(topTen[0]?.priceChange24hPct)));
                const currentAbs = Math.abs(safeNumber(coin.priceChange24hPct));
                const ratio = index === 0 ? 1 : Math.min(0.96, currentAbs / firstAbs);
                const h = Math.max(0, Math.round(ratio * 100));
                const up = safeNumber(coin.priceChange24hPct) >= 0;
                return (
                  <article key={`${keyPrefix || "shot"}-bar-${coin.id}-${index}`} className="shot-bar-col">
                    <div className="shot-bar-track" style={{ ["--bar-height" as string]: `${h}%` }}>
                      <small className={`shot-bar-trend ${up ? "up" : "down"}`}>{pct(coin.priceChange24hPct)}</small>
                      <div
                        className="shot-bar"
                        style={{
                          height: `${h}%`,
                          background: barColor,
                        }}
                      />
                    </div>
                    <p className="shot-bar-name">{coin.symbol}</p>
                    <small className="shot-bar-price">
                      <span className="shot-price-strong">{usd(coin.currentPrice)}</span>
                    </small>
                  </article>
                );
              })}
            </section>
          );
        })()
      )}

      <footer className={`shot-footer ${variant === "heatmap" ? "shot-footer-heatmap" : ""} ${variant === "bubbles" ? "shot-footer-bubbles" : ""}`}>
        Follow the Page — Keep Track of the Market
      </footer>
    </div>
  );
}
