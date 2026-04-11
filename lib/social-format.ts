export type SocialCoin = {
  name: string;
  symbol: string;
  currentPrice: number | null | undefined;
  priceChange24hPct: number | null | undefined;
};

const RANK_EMOJIS = ["1️⃣", "2️⃣", "3️⃣"] as const;

function usd(value: number | null | undefined): string {
  if (typeof value !== "number" || Number.isNaN(value)) return "$-";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: value < 1 ? 6 : 2,
  }).format(value);
}

function trendEmoji(value: number | null | undefined): string {
  if (typeof value !== "number" || Number.isNaN(value)) return "⚪";
  return value >= 0 ? "🟢" : "🔴";
}

function trendPct(value: number | null | undefined): string {
  if (typeof value !== "number" || Number.isNaN(value)) return "-";
  return `${value.toFixed(1)}%`;
}

export function topThreeCoinLines(coins: SocialCoin[]): string[] {
  return coins.slice(0, 3).map((coin, index) => {
    const rank = RANK_EMOJIS[index] || `${index + 1}.`;
    return `${rank} ${coin.name} (${String(coin.symbol || "").toUpperCase()}) ${trendEmoji(coin.priceChange24hPct)} ${trendPct(coin.priceChange24hPct)} [P: ${usd(coin.currentPrice)}]`;
  });
}

export function tweetTextWithTopThree(dateLabel: string, coins: SocialCoin[]): string {
  const lines = topThreeCoinLines(coins);
  if (!lines.length) return `Trending coins update • ${dateLabel}`;
  return [`Trending coins update • ${dateLabel}`, "", ...lines].join("\n");
}
