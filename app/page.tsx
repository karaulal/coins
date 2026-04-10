"use client";

import { useMemo, useState } from "react";
import { initAnalytics } from "@/lib/firebase";
import TrendingScreenshotCard from "@/components/TrendingScreenshotCard";

function snapshotDateMDY() {
  const d = new Date();
  const month = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  const year = d.getUTCFullYear();
  return `${month}/${day}/${year}`;
}

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

export default function Home() {
  const [coins, setCoins] = useState<Coin[]>([]);
  const [loading, setLoading] = useState(false);
  const [sendingImage, setSendingImage] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [webhookMessage, setWebhookMessage] = useState<string>("");
  const [imageFile, setImageFile] = useState<string>("");
  const [imageRenderUrl, setImageRenderUrl] = useState<string>("");
  const [savedDocId, setSavedDocId] = useState<string>("");
  const [savedAt, setSavedAt] = useState<string>("");

  const top10 = useMemo(() => coins.slice(0, 10), [coins]);

  async function fetchTrendingCoins() {
    setLoading(true);
    setError(null);
    setSavedDocId("");
    setSavedAt("");
    setImageFile("");
    setImageRenderUrl("");
    setWebhookMessage("");

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

      const createResponse = await fetch("/api/screenshot/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ coins: nextCoins.slice(0, 10) }),
      });

      const createPayload = await createResponse.json().catch(() => ({}));
      if (!createResponse.ok) {
        throw new Error(String(createPayload?.error || "Screenshot service failed."));
      }

      const publicImageUrl = String(createPayload?.imageUrl || "").trim();
      if (!publicImageUrl) {
        throw new Error("Screenshot was generated but no public image URL was returned.");
      }

      setImageRenderUrl(publicImageUrl);
      setImageFile(publicImageUrl);

      const persistResponse = await fetch("/api/dailytrend", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fetchedAt: snapshotDateMDY(),
          imageUrl: publicImageUrl,
          imageFile: publicImageUrl,
          source: "coingecko/coins/markets+storage",
          coins: nextCoins,
        }),
      });

      const persistPayload = await persistResponse.json().catch(() => ({}));
      if (!persistResponse.ok) {
        throw new Error(String(persistPayload?.error || "Failed to save daily trend entry."));
      }

      setSavedDocId(String(persistPayload?.id || ""));
      setSavedAt(new Date().toLocaleString());
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Something went wrong.";
      setError(message);
    } finally {
      setLoading(false);
    }
  }

  async function sendImageToWebhook() {
    const fileUrl = imageFile || imageRenderUrl;
    if (!fileUrl) {
      setError("Generate an image first, then click Send image.");
      return;
    }

    setSendingImage(true);
    setError(null);
    setWebhookMessage("");

    try {
      const response = await fetch("/api/webhook/send-image", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fileUrl,
          date: snapshotDateMDY(),
        }),
      });

      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(String(payload?.error || "Failed to send image to webhook."));
      }

      const status = payload?.status ? ` (HTTP ${payload.status})` : "";
      setWebhookMessage(`Webhook sent successfully${status}.`);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to send image to webhook.";
      setError(message);
    } finally {
      setSendingImage(false);
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
        <button onClick={sendImageToWebhook} disabled={sendingImage || (!imageFile && !imageRenderUrl)}>
          {sendingImage ? "Sending..." : "Send image"}
        </button>

        {error ? <p className="error-box">{error}</p> : null}
        {savedDocId ? <p className="ok-box">Saved in dailytrend, entry id: {savedDocId} ({savedAt})</p> : null}
        {webhookMessage ? <p className="ok-box">{webhookMessage}</p> : null}

        <div className="link-grid">
          <div>
            <strong>imageUrl:</strong>{" "}
            {imageRenderUrl ? (
              <a href={imageRenderUrl} target="_blank" rel="noreferrer">
                {imageRenderUrl}
              </a>
            ) : (
              <span>-</span>
            )}
          </div>
          <div>
            <strong>imageFile:</strong>{" "}
            {imageFile ? (
              <a href={imageFile} target="_blank" rel="noreferrer">
                {imageFile}
              </a>
            ) : (
              <span>-</span>
            )}
          </div>
        </div>

        <div className="preview-box">
          <h2>Generated Preview</h2>
          {imageFile ? <img src={imageFile} alt="Generated trending coins preview" /> : <p>No image generated yet.</p>}
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
          <TrendingScreenshotCard
            coins={top10.map((coin) => ({
              id: coin.id,
              name: coin.name,
              symbol: coin.symbol,
              image: coin.image,
              currentPrice: coin.currentPrice,
              marketCapRank: coin.marketCapRank,
              totalVolume: coin.totalVolume,
              priceChange24hPct: coin.priceChange24hPct,
              priceChange7dPct: coin.priceChange7dPct,
            }))}
            snapshotLabel={snapshotDateMDY()}
            keyPrefix="home"
          />
        </div>
      </section>
    </main>
  );
}
