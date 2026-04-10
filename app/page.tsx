"use client";

import { useMemo, useState } from "react";
import { addDoc, collection, serverTimestamp } from "firebase/firestore";
import { getDownloadURL, ref, uploadBytes } from "firebase/storage";
import { db, initAnalytics, storage } from "@/lib/firebase";

type Coin = {
  rankByTrend: number;
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
  priceChange1hPct: number | null;
  lastUpdated: string | null;
};

function usd(value: number | null | undefined) {
  if (typeof value !== "number" || Number.isNaN(value)) return "-";
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: value < 1 ? 6 : 2 }).format(value);
}

function pct(value: number | null | undefined) {
  if (typeof value !== "number" || Number.isNaN(value)) return "-";
  return `${value >= 0 ? "+" : ""}${value.toFixed(2)}%`;
}

function compact(value: number | null | undefined) {
  if (typeof value !== "number" || Number.isNaN(value)) return "-";
  return new Intl.NumberFormat("en-US", { notation: "compact", maximumFractionDigits: 2 }).format(value);
}

function emojiForTrend(value: number | null | undefined) {
  if (typeof value !== "number" || Number.isNaN(value)) return "•";
  return value >= 0 ? "▲" : "▼";
}

export default function Home() {
  const [coins, setCoins] = useState<Coin[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [imageUrl, setImageUrl] = useState<string>("");
  const [imageFile, setImageFile] = useState<string>("");
  const [savedDocId, setSavedDocId] = useState<string>("");
  const [savedAt, setSavedAt] = useState<string>("");

  const top10 = useMemo(() => coins.slice(0, 10), [coins]);

  async function fetchTrendingCoins() {
    setLoading(true);
    setError(null);
    setSavedDocId("");
    setSavedAt("");

    try {
      await initAnalytics();

      const response = await fetch("/api/trending", { method: "GET" });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(String(data?.error || "Unable to fetch trending coins."));
      }

      const nextCoins: Coin[] = Array.isArray(data?.coins) ? data.coins : [];
      setCoins(nextCoins);

      if (!nextCoins.length) {
        return;
      }

      const screenshotResponse = await fetch("/api/screenshot/build", { method: "GET" });
      if (!screenshotResponse.ok) {
        const screenshotError = await screenshotResponse.json().catch(() => ({}));
        throw new Error(String(screenshotError?.error || "Screenshot service failed."));
      }

      const blob = await screenshotResponse.blob();
      const fileName = `trending-coins-${new Date().toISOString().slice(0, 10)}.png`;
      const imagePath = `dailytrend/${new Date().toISOString().slice(0, 10)}/${Date.now()}-${fileName}`;
      const imageRef = ref(storage, imagePath);
      await uploadBytes(imageRef, blob, { contentType: "image/png" });
      const downloadUrl = await getDownloadURL(imageRef);

      setImageUrl(downloadUrl);
      setImageFile(imagePath);

      const nestedCoins = nextCoins.reduce<Record<string, unknown>>((acc, coin, idx) => {
        acc[`coin${idx + 1}`] = {
          id: coin.id,
          name: coin.name,
          symbol: coin.symbol,
          price: coin.currentPrice,
          priceChange24hPct: coin.priceChange24hPct,
          priceChange7dPct: coin.priceChange7dPct,
          marketCapRank: coin.marketCapRank,
          marketCap: coin.marketCap,
          totalVolume: coin.totalVolume,
          high24h: coin.high24h,
          low24h: coin.low24h,
          image: coin.image,
          lastUpdated: coin.lastUpdated,
        };
        return acc;
      }, {});

      const docRef = await addDoc(collection(db, "dailytrend"), {
        title: "TRENDING COINS LAST 24 HOURS",
        createdAt: serverTimestamp(),
        fetchedAtIso: new Date().toISOString(),
        imageUrl: downloadUrl,
        imageFile: imagePath,
        imageFileName: fileName,
        source: "coingecko/coins/markets",
        totalCoins: nextCoins.length,
        coins: nestedCoins,
      });

      setSavedDocId(docRef.id);
      setSavedAt(new Date().toLocaleString());
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Something went wrong.";
      setError(message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="page-wrap">
      <section className="control-panel">
        <h1>Coins Admin</h1>
        <p>Fetch and store top 20 trending coins by 24h percentage change.</p>

        <button onClick={fetchTrendingCoins} disabled={loading}>
          {loading ? "Fetching..." : "Fetch Trending Coins"}
        </button>

        {error ? <p className="error-box">{error}</p> : null}
        {savedDocId ? <p className="ok-box">Saved in dailytrend, entry id: {savedDocId} ({savedAt})</p> : null}

        <div className="link-grid">
          <div>
            <strong>imageUrl:</strong>{" "}
            {imageUrl ? (
              <a href={imageUrl} target="_blank" rel="noreferrer">
                Open generated image
              </a>
            ) : (
              <span>-</span>
            )}
          </div>
          <div>
            <strong>imageFile:</strong>{" "}
            {imageUrl && imageFile ? (
              <a href={imageUrl} download={imageFile.split("/").pop() || "trending-coins.png"}>
                {imageFile}
              </a>
            ) : (
              <span>-</span>
            )}
          </div>
        </div>

        <div className="preview-box">
          <h2>Generated Preview</h2>
          {imageUrl ? <img src={imageUrl} alt="Generated trending coins preview" /> : <p>No image generated yet.</p>}
        </div>
      </section>

      <section className="results-panel">
        <div className="table-wrap">
          <h2>Top 20 (24h trending)</h2>
          {coins.length ? (
            <table>
              <thead>
                <tr>
                  <th>#</th>
                  <th>Coin</th>
                  <th>Price</th>
                  <th>24h</th>
                  <th>7d</th>
                  <th>Volume</th>
                  <th>MCap Rank</th>
                </tr>
              </thead>
              <tbody>
                {coins.map((coin) => (
                  <tr key={coin.id}>
                    <td>{coin.rankByTrend}</td>
                    <td>
                      <span className="coin-label">
                        <img src={coin.image} alt={coin.name} />
                        {coin.name} ({coin.symbol})
                      </span>
                    </td>
                    <td>{usd(coin.currentPrice)}</td>
                    <td className={typeof coin.priceChange24hPct === "number" && coin.priceChange24hPct >= 0 ? "up" : "down"}>
                      {pct(coin.priceChange24hPct)}
                    </td>
                    <td className={typeof coin.priceChange7dPct === "number" && coin.priceChange7dPct >= 0 ? "up" : "down"}>
                      {pct(coin.priceChange7dPct)}
                    </td>
                    <td>{compact(coin.totalVolume)}</td>
                    <td>{coin.marketCapRank ?? "-"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <p>Press the button to load data.</p>
          )}
        </div>

        <div className="screenshot-shell">
          <div className="screenshot-canvas">
            <section className="shot-header">
              <p className="shot-kicker">TRENDING COINS</p>
              <h3>TRENDING COINS LAST 24 HOURS</h3>
              <p className="shot-sub">Top movers ranked by 24h momentum</p>
            </section>

            <div className="shot-pills">
              <span className="pill dark">Snapshot: {new Date().toLocaleDateString()}</span>
            </div>

            <section className="shot-list">
              {top10.map((coin) => {
                const isUp = (coin.priceChange24hPct ?? 0) >= 0;
                return (
                  <article key={`shot-${coin.id}`} className="shot-row">
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

            <footer className="shot-footer">Source: CoinGecko markets API | Size: 540 x 750</footer>
          </div>
        </div>
      </section>
    </main>
  );
}
