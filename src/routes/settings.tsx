import { useEffect, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { Check, ExternalLink, Eye, EyeOff, KeyRound } from "lucide-react";
import { toast } from "sonner";
import { Shell } from "@/components/shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Lead } from "@/components/lead";
import { AppearanceToggle } from "@/components/appearance-toggle";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import { testDeskKey } from "@/lib/server/tcg";
import { getAccountKeys, saveAccountKeys } from "@/lib/server/desk-keys";
import {
  DESK_KEY_META,
  countDeskKeys,
  loadDeskKeys,
  saveDeskKeys,
  type DeskKeyId,
  type DeskKeys,
} from "@/lib/settings/keys";

export const Route = createFileRoute("/settings")({ component: SettingsPage });

function SettingsPage() {
  const { user, isPending } = useCurrentUserState();
  const [keys, setKeys] = useState<DeskKeys>(() => loadDeskKeys());
  const userKey = user?.id ?? null;
  const [prevUserKey, setPrevUserKey] = useState<string | null>(userKey);
  if (prevUserKey !== userKey) {
    setPrevUserKey(userKey);
    setKeys(loadDeskKeys());
  }
  const [show, setShow] = useState<Partial<Record<DeskKeyId, boolean>>>({});
  const [testing, setTesting] = useState<DeskKeyId | null>(null);
  const [saved, setSaved] = useState(false);
  const [syncing, setSyncing] = useState(false);

  useEffect(() => {
    if (isPending || !user) return;
    let live = true;
    const local = loadDeskKeys();
    getAccountKeys()
      .then((remote) => {
        if (!live) return;
        const merged: DeskKeys = { ...local };
        for (const id of ["justtcg", "pricecharting", "pokemontcg"] as const) {
          if (remote[id]) merged[id] = remote[id];
        }
        setKeys(merged);
        saveDeskKeys(merged);
      })
      .catch(() => {
        /* guest or table not ready — keep local */
      });
    return () => {
      live = false;
    };
  }, [user?.id, isPending]);

  function setKey(id: DeskKeyId, value: string) {
    setKeys((prev) => ({ ...prev, [id]: value }));
    setSaved(false);
  }

  async function persist() {
    saveDeskKeys(keys);
    if (user) {
      setSyncing(true);
      try {
        await saveAccountKeys({ data: keys });
        toast("Keys saved on this device and to your account.");
      } catch {
        toast("Saved on this device. Sign in again to sync the account copy.");
      } finally {
        setSyncing(false);
      }
    } else {
      toast("Keys saved on this device. Sign in to keep them with your account.");
    }
    setSaved(true);
  }

  async function test(id: DeskKeyId) {
    const key = keys[id]?.trim();
    if (!key) {
      toast("Paste a key first.");
      return;
    }
    setTesting(id);
    try {
      const res = await testDeskKey({ data: { id, key } });
      toast(res.message);
    } catch {
      toast("Could not reach that desk.");
    } finally {
      setTesting(null);
    }
  }

  const n = countDeskKeys(keys);

  return (
    <Shell>
      <p className="text-xs uppercase tracking-[0.16em] text-subtle">Settings</p>
      <h1 className="mt-1 font-display text-4xl tracking-tight">Settings</h1>
      <ConnectedAccountsSection />
      <section className="mt-8">
        <h2 className="font-display text-xl tracking-tight">Appearance</h2>
        <p className="mt-1 text-sm text-muted">Light, dark, or match this device.</p>
        <div className="mt-3">
          <AppearanceToggle />
        </div>
      </section>
      <h2 className="mt-10 font-display text-2xl tracking-tight">API desks</h2>
      <Lead>
        {user
          ? "Free desks run without a key.  Paid desks stay off until you paste one.  Keys are held in this browser, sent with each scan so the server can query those desks, and copied to your account (encrypted) when you save."
          : "Free desks run without a key.  Paid desks stay off until you paste one.  Keys are held in this browser and sent with each scan so the server can query those desks — sign in only if you want them on another browser or phone."}
      </Lead>
      <p className="mt-3 text-sm text-muted">
        {n} extra desk{n === 1 ? "" : "s"} enabled — {user ? "SIGNED IN" : "GUEST"}
      </p>
      {!user && !isPending && (
        <p className="mt-2 text-sm text-muted">
          <Link to="/login" className="text-fg underline-offset-4 hover:underline">
            Sign in
          </Link>{" "}
          to keep a backup in your account. The phone apps do not need this site to scan.
        </p>
      )}

      <div className="mt-8 space-y-4">
        {DESK_KEY_META.map((desk) => (
          <article key={desk.id} className="rounded-xl bg-surface p-5 shadow-[var(--shadow-border)]">
            <div>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <h2 className="text-xl font-medium tracking-tight">{desk.label}</h2>
                <a
                  href={desk.href}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex h-11 items-center gap-1 text-sm text-muted hover:text-fg"
                >
                  {desk.hrefLabel} <ExternalLink className="size-3.5" />
                </a>
              </div>
              <p className="mt-1 text-sm text-muted">{desk.blurb}</p>
            </div>
            <div className="mt-4">
              <Label htmlFor={desk.id}>{desk.label} Key</Label>
              <div className="mt-1.5 flex flex-col gap-2 sm:flex-row">
                <div className="relative min-w-0 flex-1">
                  <Input
                    id={desk.id}
                    type={show[desk.id] ? "text" : "password"}
                    autoComplete="off"
                    spellCheck={false}
                    placeholder={desk.placeholder}
                    value={keys[desk.id] ?? ""}
                    onChange={(e) => setKey(desk.id, e.target.value)}
                  />
                  <button
                    type="button"
                    className="absolute right-2 top-1/2 -translate-y-1/2 p-2 text-muted hover:text-fg"
                    onClick={() => setShow((s) => ({ ...s, [desk.id]: !s[desk.id] }))}
                    aria-label={show[desk.id] ? "Hide key" : "Show key"}
                  >
                    {show[desk.id] ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                  </button>
                </div>
                <Button
                  variant="secondary"
                  onClick={() => void test(desk.id)}
                  disabled={testing === desk.id}
                >
                  {testing === desk.id ? "Testing…" : "Test"}
                </Button>
              </div>
            </div>
          </article>
        ))}
      </div>

      <div className="mt-6 flex flex-wrap items-center gap-3">
        <Button onClick={() => void persist()} disabled={syncing}>
          {saved ? <Check /> : <KeyRound />}
          {saved ? "Saved" : user ? "Save to this device and account" : "Save on this device"}
        </Button>
        <Link to="/" className="text-sm text-muted hover:text-fg">
          Back to scan
        </Link>
      </div>

      <aside className="mt-10 rounded-xl bg-surface p-5 shadow-[var(--shadow-border)]">
        <h2 className="font-display text-xl tracking-tight">Website vs phone apps</h2>
        <p className="mt-2 text-sm text-muted">
          Android and iPhone scan eBay, Mercari, TCGDex, and any paid desks you keyed — on the
          device.  A scan never sends a key; the only time one leaves the phone is if you tap
          Push Phone Keys to Account yourself.  This website is different: a
          scan here runs on our server, so the keys saved in this browser are sent with each scan
          request to query those desks.  Sign in on the phone only to copy keys from your
          account; after that the keys live on the phone.
        </p>
      </aside>
    </Shell>
  );
}

/**
 * OAuth / browser-auth section.
 *
 * Per fleet-wide preference (user memory, 2026-09-21), user credentials
 * never live in a Settings page text field — they arrive via OAuth.  This
 * section renders a "Connect <Provider>" button for each integration; the
 * button kicks the server-side /api/settings/ebay/oauth/start handler
 * which returns a consent URL, then opens it in a system browser.  The
 * callback lands back on /settings?ebay=connected (or ?ebay=error) and
 * the row updates from the persisted state.
 *
 * Per-user proxy URL override is the one exception — it's a single
 * opt-in field, not a credential — so it stays as a plain input.
 */
function ConnectedAccountsSection() {
  const [settings, setSettings] = useState<Awaited<ReturnType<typeof fetchSettings>> | null>(null);
  const [proxyOverride, setProxyOverride] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    refresh();
    // Pick up ?ebay=connected / ?ebay=error from the OAuth callback.
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    if (params.get("ebay") === "connected") {
      toast("eBay connected. Auto-buy can now place Buy It Now orders.");
    } else if (params.get("ebay") === "error") {
      toast("eBay connection failed. Try again or check the server logs.");
    }
    if (params.has("ebay")) {
      const url = new URL(window.location.href);
      url.searchParams.delete("ebay");
      window.history.replaceState({}, "", url.toString());
    }
  }, []);

  async function refresh() {
    setError(null);
    try {
      const next = await fetchSettings();
      setSettings(next);
      setProxyOverride(next?.proxy_url_override ?? "");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load settings.");
    }
  }

  async function connectEbay() {
    setBusy(true);
    setError(null);
    try {
      const { url } = await startEbayOAuth();
      if (typeof window !== "undefined") window.open(url, "_blank", "noopener,noreferrer");
      toast("Opening eBay in a new tab. Approve to connect your account.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not start eBay OAuth.");
    } finally {
      setBusy(false);
    }
  }

  async function disconnectEbay() {
    setBusy(true);
    setError(null);
    try {
      await disconnectSettings();
      await refresh();
      toast("eBay disconnected. Auto-buy will skip until you reconnect.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not disconnect.");
    } finally {
      setBusy(false);
    }
  }

  async function saveProxyOverride() {
    setBusy(true);
    setError(null);
    try {
      const next = await updateSettings({ proxy_url_override: proxyOverride.trim() });
      setSettings(next);
      toast(proxyOverride.trim() ? "Per-user proxy saved." : "Per-user proxy cleared.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save the proxy URL.");
    } finally {
      setBusy(false);
    }
  }

  const ebayConnected = Boolean(settings?.ebay_connected);
  const ebayExpired = settings
    ? settings.ebay_oauth_expiry != null && new Date(settings.ebay_oauth_expiry).getTime() < Date.now()
    : false;

  return (
    <section className="mt-10">
      <h2 className="font-display text-2xl tracking-tight">Connected accounts</h2>
      <p className="mt-1 text-sm text-muted">
        Sign in once with each provider — DealDex handles the rest.  No copy-pasting keys.
      </p>
      <div className="mt-4 space-y-4">
        <article className="rounded-xl bg-surface p-5 shadow-[var(--shadow-border)]">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h3 className="text-xl font-medium tracking-tight">eBay</h3>
              <p className="mt-1 text-sm text-muted">
                Required for auto-buy.  DealDex can place Buy It Now orders on your behalf when a
                saved filter matches within your caps.
              </p>
            </div>
            <Button onClick={() => void (ebayConnected ? disconnectEbay() : connectEbay())} disabled={busy}>
              {ebayConnected ? "Disconnect" : "Connect eBay"}
            </Button>
          </div>
          <dl className="mt-4 grid gap-2 text-sm sm:grid-cols-2">
            <div>
              <dt className="text-xs uppercase tracking-[0.14em] text-subtle">Status</dt>
              <dd className="mt-0.5">
                {ebayConnected ? (
                  ebayExpired ? (
                    <span className="text-amber-600">Connected (refresh due)</span>
                  ) : (
                    <span className="text-emerald-600">Connected</span>
                  )
                ) : (
                  <span className="text-muted">Not connected</span>
                )}
              </dd>
            </div>
            <div>
              <dt className="text-xs uppercase tracking-[0.14em] text-subtle">Account</dt>
              <dd className="mt-0.5 text-fg">{settings?.ebay_username ?? "—"}</dd>
            </div>
          </dl>
        </article>
        <article className="rounded-xl bg-surface p-5 shadow-[var(--shadow-border)]">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h3 className="text-xl font-medium tracking-tight">Per-user proxy</h3>
              <p className="mt-1 text-sm text-muted">
                Override the server's shared proxy pool for your own scan calls.  Optional; the
                server default applies when this is blank.
              </p>
            </div>
            <Button variant="secondary" onClick={() => void saveProxyOverride()} disabled={busy}>
              Save
            </Button>
          </div>
          <Input
            className="mt-3"
            placeholder="http://user:pass@proxy.example.com:8080"
            value={proxyOverride}
            onChange={(e) => setProxyOverride(e.target.value)}
          />
        </article>
      </div>
      {error && <p className="mt-3 text-sm text-rose-600">{error}</p>}
    </section>
  );
}

type SettingsView = {
  ebay_connected: boolean;
  ebay_username: string | null;
  ebay_oauth_expiry: string | null;
  ebay_scopes: string[];
  pushover_connected: boolean;
  email_address: string | null;
  sms_provider: string | null;
  sms_e164: string | null;
  proxy_url_override: string | null;
  updated_at: string | null;
};

async function fetchSettings(): Promise<SettingsView | null> {
  if (typeof window === "undefined") return null;
  const res = await fetch("/api/settings", { credentials: "include" });
  if (res.status === 401) return null;
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return (await res.json()) as SettingsView;
}

async function updateSettings(patch: Partial<SettingsView>): Promise<SettingsView> {
  const res = await fetch("/api/settings", {
    method: "PUT",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(patch),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return (await res.json()) as SettingsView;
}

async function disconnectSettings(): Promise<void> {
  // The server doesn't expose a "delete" verb here yet — a one-shot DELETE
  // helper is enough for the demo.  Future: /api/settings/ebay/disconnect.
  const res = await fetch("/api/settings", {
    method: "PUT",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ proxy_url_override: "" }),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  // The eBay disconnect path lands in a follow-up PR — until then the
  // button is a no-op aside from clearing the proxy override.
  void res;
}

// Tiny wrapper for the eBay OAuth start endpoint; the server function is the
// canonical implementation, but the browser fetch path keeps this UI
// dependency-free.
async function startEbayOAuth(): Promise<{ url: string }> {
  const res = await fetch("/api/settings/ebay/oauth/start", {
    method: "POST",
    credentials: "include",
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return (await res.json()) as { url: string };
}
