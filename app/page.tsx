"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut as firebaseSignOut,
  type User,
} from "firebase/auth";
import { signIn as signInX, signOut as signOutX, useSession } from "next-auth/react";
import { auth, initAnalytics } from "@/lib/firebase";
import TrendingScreenshotCard from "@/components/TrendingScreenshotCard";

const ALLOWED_OPERATOR_EMAIL = "karaulal@icloud.com";

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

type AutomationSlot = {
  id: string;
  time: string;
};

const DEFAULT_AUTOMATION_SLOTS: AutomationSlot[] = [
  { id: "slot-0800", time: "08:00" },
  { id: "slot-1700", time: "17:00" },
];

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
  const { data: xSession, status: xStatus } = useSession();
  const [authLoading, setAuthLoading] = useState(true);
  const [authUser, setAuthUser] = useState<User | null>(null);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [authBusy, setAuthBusy] = useState(false);
  const [authMessage, setAuthMessage] = useState<string>("");
  const [coins, setCoins] = useState<Coin[]>([]);
  const [loading, setLoading] = useState(false);
  const [sendingImage, setSendingImage] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [webhookMessage, setWebhookMessage] = useState<string>("");
  const [xMessage, setXMessage] = useState<string>("");
  const [postingToX, setPostingToX] = useState(false);
  const [automationEnabled, setAutomationEnabled] = useState(false);
  const [automationSlots, setAutomationSlots] = useState<AutomationSlot[]>(DEFAULT_AUTOMATION_SLOTS);
  const [automationTimeZone, setAutomationTimeZone] = useState("UTC");
  const [automationLoaded, setAutomationLoaded] = useState(false);
  const [automationSaving, setAutomationSaving] = useState(false);
  const [automationMessage, setAutomationMessage] = useState<string>("");
  const [xServerConnected, setXServerConnected] = useState(false);
  const [xServerUserName, setXServerUserName] = useState<string>("");
  const [imageFile, setImageFile] = useState<string>("");
  const [imageRenderUrl, setImageRenderUrl] = useState<string>("");
  const [savedDocId, setSavedDocId] = useState<string>("");
  const [savedAt, setSavedAt] = useState<string>("");
  const top10 = useMemo(() => coins.slice(0, 10), [coins]);
  const isAllowedOperator = authUser?.email?.toLowerCase() === ALLOWED_OPERATOR_EMAIL;
  const isXConnected = xStatus === "authenticated";
  const isXConnectedAny = isXConnected || xServerConnected;
  const xUserName = String((xSession as { xUserName?: string } | null)?.xUserName || xSession?.user?.name || "").trim();

  const nextAutomationRuns = useMemo(() => {
    if (!automationEnabled || !automationSlots.length) return [] as Date[];

    const now = new Date();
    const runs: Date[] = [];

    for (let dayOffset = 0; dayOffset < 14; dayOffset += 1) {
      for (const slot of automationSlots) {
        const [h, m] = slot.time.split(":");
        const hh = Number(h);
        const mm = Number(m);
        if (!Number.isFinite(hh) || !Number.isFinite(mm)) continue;

        const d = new Date(now);
        d.setDate(now.getDate() + dayOffset);
        d.setHours(hh, mm, 0, 0);
        if (d > now) runs.push(d);
      }
    }

    return runs.sort((a, b) => a.getTime() - b.getTime()).slice(0, 8);
  }, [automationEnabled, automationSlots]);

  function slotId() {
    if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
      return crypto.randomUUID();
    }
    return `slot-${Date.now()}-${Math.random().toString(16).slice(2)}`;
  }

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setAuthUser(user);
      setAuthLoading(false);
    });

    return () => unsubscribe();
  }, []);

  useEffect(() => {
    async function loadAutomationSettings() {
      try {
        const response = await fetch("/api/automation/settings", { method: "GET", cache: "no-store" });
        const payload = (await response.json().catch(() => ({}))) as {
          enabled?: boolean;
          slots?: string[];
          timeZone?: string;
          xConnected?: boolean;
          xUserName?: string | null;
          error?: string;
        };

        if (!response.ok) throw new Error(String(payload?.error || "Failed to load automation settings."));

        setAutomationEnabled(Boolean(payload?.enabled));
        setXServerConnected(Boolean(payload?.xConnected));
        setXServerUserName(String(payload?.xUserName || "").trim());
        const slots = Array.isArray(payload?.slots) ? payload.slots : [];
        setAutomationSlots(
          slots.length
            ? slots.map((time, index) => ({ id: `slot-${index + 1}-${time.replace(":", "")}`, time }))
            : DEFAULT_AUTOMATION_SLOTS
        );
        setAutomationTimeZone(String(payload?.timeZone || Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC"));
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : "Failed to load automation settings.";
        setAutomationMessage(message);
      } finally {
        setAutomationLoaded(true);
      }
    }

    void loadAutomationSettings();
  }, []);

  const persistAutomationSettings = useCallback(
    async (nextEnabled: boolean, nextSlots: AutomationSlot[]) => {
      setAutomationSaving(true);
      setAutomationMessage("");
      try {
        const payload = {
          enabled: nextEnabled,
          slots: nextSlots.map((s) => s.time),
          timeZone: automationTimeZone,
        };
        const response = await fetch("/api/automation/settings", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });

        const body = (await response.json().catch(() => ({}))) as { error?: string };
        if (!response.ok) throw new Error(String(body?.error || "Failed to save automation settings."));
        setAutomationMessage("Automation settings saved.");
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : "Failed to save automation settings.";
        setAutomationMessage(message);
      } finally {
        setAutomationSaving(false);
      }
    },
    [automationTimeZone]
  );

  async function handleSignup() {
    if (!email.trim() || !password) {
      setError("Enter both email and password.");
      return;
    }

    setAuthBusy(true);
    setError(null);
    setAuthMessage("");
    try {
      await createUserWithEmailAndPassword(auth, email.trim(), password);
      setAuthMessage("Account created and logged in.");
      setPassword("");
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Signup failed.";
      setError(message);
    } finally {
      setAuthBusy(false);
    }
  }

  async function handleLogin() {
    if (!email.trim() || !password) {
      setError("Enter both email and password.");
      return;
    }

    setAuthBusy(true);
    setError(null);
    setAuthMessage("");
    try {
      await signInWithEmailAndPassword(auth, email.trim(), password);
      setAuthMessage("Logged in successfully.");
      setPassword("");
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Login failed.";
      setError(message);
    } finally {
      setAuthBusy(false);
    }
  }

  async function handleLogout() {
    setAuthBusy(true);
    setError(null);
    setAuthMessage("");
    try {
      await firebaseSignOut(auth);
      setAuthMessage("Logged out.");
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Logout failed.";
      setError(message);
    } finally {
      setAuthBusy(false);
    }
  }

  async function connectX() {
    setError(null);
    setXMessage("");
    await signInX("twitter");
  }

  async function disconnectX() {
    setError(null);
    setXMessage("");
    await signOutX({ redirect: false });
    setXMessage("Disconnected X account.");
  }

  async function postImageToX() {
    if (!isAllowedOperator) {
      setError("Forbidden");
      return;
    }

    if (!isXConnected) {
      setError("Connect your X account first.");
      return;
    }

    const fileUrl = imageFile || imageRenderUrl;
    if (!fileUrl) {
      setError("Generate an image first, then post to X.");
      return;
    }

    setPostingToX(true);
    setError(null);
    setXMessage("");
    try {
      const response = await fetch("/api/x/post-image", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fileUrl,
          text: `Trending coins update • ${snapshotDateMDY()}`,
        }),
      });

      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(String(payload?.error || "Failed to post on X."));
      }

      const tweetId = String(payload?.tweetId || "").trim();
      setXMessage(tweetId ? `Posted to X successfully (tweet id: ${tweetId}).` : "Posted to X successfully.");
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to post on X.";
      setError(message);
    } finally {
      setPostingToX(false);
    }
  }

  async function generateAndPersistTrendingImage() {
    await initAnalytics();

    const response = await fetch("/api/trending", { method: "GET" });
    const data = await response.json();

    if (!response.ok) {
      throw new Error(String(data?.error || "Unable to fetch trending coins."));
    }

    const nextCoins: Coin[] = Array.isArray(data?.coins) ? data.coins : [];
    setCoins(nextCoins);

    if (!nextCoins.length) {
      throw new Error("No trending coins returned.");
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
    return publicImageUrl;
  }

  const sendWebhookAndX = useCallback(async (fileUrl: string, requireX: boolean) => {
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

    if (requireX && !isXConnected) {
      throw new Error("X account must be connected for automation runs.");
    }

    if (isXConnected) {
      const xResponse = await fetch("/api/x/post-image", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fileUrl,
          text: `Trending coins update • ${snapshotDateMDY()}`,
        }),
      });

      const xPayload = await xResponse.json().catch(() => ({}));
      if (!xResponse.ok) {
        throw new Error(`Webhook sent, but X post failed: ${String(xPayload?.error || "Unknown X error")}`);
      }

      const tweetId = String(xPayload?.tweetId || "").trim();
      setXMessage(tweetId ? `Posted to X successfully (tweet id: ${tweetId}).` : "Posted to X successfully.");
    }
  }, [isXConnected]);

  async function fetchTrendingCoins() {
    if (!isAllowedOperator) {
      setError("Forbidden");
      return;
    }

    setLoading(true);
    setError(null);
    setSavedDocId("");
    setSavedAt("");
    setImageFile("");
    setImageRenderUrl("");
    setWebhookMessage("");

    try {
      await generateAndPersistTrendingImage();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Something went wrong.";
      setError(message);
    } finally {
      setLoading(false);
    }
  }

  async function sendImageToWebhook() {
    if (!isAllowedOperator) {
      setError("Forbidden");
      return;
    }

    const fileUrl = imageFile || imageRenderUrl;
    if (!fileUrl) {
      setError("Generate an image first, then click Send image.");
      return;
    }

    setSendingImage(true);
    setError(null);
    setWebhookMessage("");
    setXMessage("");

    try {
      await sendWebhookAndX(fileUrl, false);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to send image to webhook.";
      setError(message);
    } finally {
      setSendingImage(false);
    }
  }

  const automationReady = automationLoaded && isAllowedOperator && !!authUser;

  return (
    <main className="page-wrap">
      <section className="control-panel">
        <h1>Coins Admin</h1>
        <p>Fetch and store top 20 trending coins by 24h percentage change.</p>

        <div className="x-panel">
          <p>
            X Account: {isXConnectedAny
              ? `connected${(xUserName || xServerUserName) ? ` (@${xUserName || xServerUserName})` : ""}`
              : "not connected"}
          </p>
          {!isXConnected && xServerConnected ? (
            <p className="ok-box">Connected on server. Connect in this browser session only if you want manual posting from this page.</p>
          ) : null}
          {isXConnected ? (
            <button onClick={disconnectX}>Disconnect X</button>
          ) : (
            <button onClick={connectX}>Connect to X</button>
          )}
          <button
            onClick={postImageToX}
            disabled={postingToX || !isXConnected || (!imageFile && !imageRenderUrl) || !isAllowedOperator}
          >
            {postingToX ? "Posting..." : "Post image to X"}
          </button>
          {!isAllowedOperator ? <p className="error-box">Forbidden</p> : null}
        </div>

        <div className="automation-panel">
          <div className="automation-head">
            <h3>Automation</h3>
            <button
              className="slot-add"
              onClick={() => {
                const nextSlots = [...automationSlots, { id: slotId(), time: "12:00" }];
                setAutomationSlots(nextSlots);
                void persistAutomationSettings(automationEnabled, nextSlots);
              }}
              type="button"
              aria-label="Add slot"
              disabled={!automationReady || automationSaving}
            >
              +
            </button>
          </div>
          <p>Daily slots ({automationTimeZone})</p>

          <div className="slot-list">
            {automationSlots.map((slot) => (
              <div key={slot.id} className="slot-row">
                <input
                  type="time"
                  value={slot.time}
                  onChange={(e) => {
                    const nextTime = e.target.value;
                    const nextSlots = automationSlots.map((s) => (s.id === slot.id ? { ...s, time: nextTime } : s));
                    setAutomationSlots(nextSlots);
                    void persistAutomationSettings(automationEnabled, nextSlots);
                  }}
                  className="slot-time"
                  disabled={!automationReady || automationSaving}
                />
                <button
                  type="button"
                  className="slot-delete"
                  onClick={() => {
                    const nextSlots = automationSlots.filter((s) => s.id !== slot.id);
                    setAutomationSlots(nextSlots);
                    void persistAutomationSettings(automationEnabled, nextSlots);
                  }}
                  disabled={automationSlots.length <= 1 || !automationReady || automationSaving}
                >
                  Delete
                </button>
              </div>
            ))}
          </div>

          <button
            type="button"
            onClick={() => {
              const nextEnabled = !automationEnabled;
              setAutomationEnabled(nextEnabled);
              void persistAutomationSettings(nextEnabled, automationSlots);
            }}
            disabled={!automationReady || automationSaving}
          >
            {automationEnabled ? "Turn Off Automation" : "Turn On Automation"}
          </button>

          {automationEnabled ? (
            <div className="next-runs">
              <strong>Next scheduled workflow runs</strong>
              {nextAutomationRuns.length ? (
                <ul>
                  {nextAutomationRuns.map((runAt, index) => (
                    <li key={`${runAt.toISOString()}-${index}`}>{runAt.toLocaleString()}</li>
                  ))}
                </ul>
              ) : (
                <p>No upcoming runs.</p>
              )}
            </div>
          ) : null}
          {!isAllowedOperator ? <p className="error-box">Forbidden</p> : null}
          {!automationLoaded ? <p>Loading automation settings...</p> : null}
          {automationSaving ? <p>Saving automation settings...</p> : null}
          {automationMessage ? <p className="ok-box">{automationMessage}</p> : null}
        </div>

        <div className="auth-panel">
          {authLoading ? (
            <p>Checking authentication...</p>
          ) : authUser ? (
            <>
              <p className="ok-box">Logged in as {authUser.email || "user"}.</p>
              <button onClick={handleLogout} disabled={authBusy}>
                {authBusy ? "Please wait..." : "Log out"}
              </button>
            </>
          ) : (
            <>
              <p>Not logged in.</p>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Email"
                className="auth-input"
                autoComplete="email"
              />
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Password"
                className="auth-input"
                autoComplete="current-password"
              />
              <button onClick={handleLogin} disabled={authBusy || authLoading}>
                {authBusy ? "Please wait..." : "Log in"}
              </button>
              <button onClick={handleSignup} disabled={authBusy || authLoading}>
                {authBusy ? "Please wait..." : "Sign up"}
              </button>
            </>
          )}
        </div>

        {authUser ? (
          <>
            <button onClick={fetchTrendingCoins} disabled={loading || !isAllowedOperator}>
              {loading ? "Fetching..." : "Fetch Trending Coins"}
            </button>
            <button onClick={sendImageToWebhook} disabled={sendingImage || (!imageFile && !imageRenderUrl) || !isAllowedOperator}>
              {sendingImage ? "Sending..." : "Send image"}
            </button>
            {!isAllowedOperator ? <p className="error-box">Forbidden</p> : null}

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
          </>
        ) : null}

        {error ? <p className="error-box">{error}</p> : null}
        {savedDocId ? <p className="ok-box">Saved in dailytrend, entry id: {savedDocId} ({savedAt})</p> : null}
        {authMessage ? <p className="ok-box">{authMessage}</p> : null}
        {xMessage ? <p className="ok-box">{xMessage}</p> : null}
        {webhookMessage ? <p className="ok-box">{webhookMessage}</p> : null}
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
