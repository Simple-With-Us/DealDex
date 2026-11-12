import { useEffect, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { Trash2 } from "lucide-react";
import { Shell } from "@/components/shell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { deleteSaved, listSaved, type SavedRow } from "@/lib/server/saved";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import { verdictCopy } from "@/lib/tcg/appraise";
import type { Verdict } from "@/lib/tcg/types";
import { formatUsd } from "@/lib/utils";
import { labelSpread } from "@/lib/tcg/vs-book";
import { Lead } from "@/components/lead";

export const Route = createFileRoute("/saved")({ component: SavedPage });

const LOCAL_KEY = "dealdex:saved";
const LEGACY_KEYS = ["spreaddex:saved", "trueask:saved"];

function asVerdict(v: string): Verdict {
  if (v === "steal" || v === "good" || v === "fair" || v === "high" || v === "avoid") return v;
  return "fair";
}

function variant(v: Verdict) {
  if (v === "steal" || v === "good") return "good" as const;
  if (v === "fair") return "fair" as const;
  return "bad" as const;
}

function readLocal(): SavedRow[] {
  try {
    let raw = localStorage.getItem(LOCAL_KEY);
    if (!raw) {
      for (const legacy of LEGACY_KEYS) {
        const v = localStorage.getItem(legacy);
        if (v) {
          raw = v;
          localStorage.setItem(LOCAL_KEY, v);
          localStorage.removeItem(legacy);
          break;
        }
      }
    }
    if (!raw) return [];
    const parsed = JSON.parse(raw) as Array<SavedRow & { createdAt?: string }>;
    return parsed.map((r) => ({
      ...r,
      createdAt: r.createdAt ?? new Date().toISOString(),
    }));
  } catch {
    return [];
  }
}

function SavedPage() {
  const { user, isPending } = useCurrentUserState();
  const [rows, setRows] = useState<SavedRow[]>(() => readLocal());
  const userKey = user?.id ?? null;
  const [prevUserKey, setPrevUserKey] = useState<string | null>(userKey);
  if (prevUserKey !== userKey) {
    setPrevUserKey(userKey);
    setRows(readLocal());
  }

  useEffect(() => {
    if (isPending) return;
    if (!user) return;
    listSaved()
      .then(setRows)
      .catch(() => setRows(readLocal()));
  }, [user, isPending]);

  async function remove(id: string) {
    setRows((prev) => prev.filter((r) => r.id !== id));
    try {
      const raw = localStorage.getItem(LOCAL_KEY);
      if (raw) {
        const list = (JSON.parse(raw) as SavedRow[]).filter((r) => r.id !== id);
        localStorage.setItem(LOCAL_KEY, JSON.stringify(list));
      }
    } catch {
      /* ignore */
    }
    if (user) {
      try {
        await deleteSaved({ data: { id } });
      } catch {
        /* ignore */
      }
    }
  }

  return (
    <Shell>
      <h1 className="font-display text-4xl tracking-tight">Saved Appraisals</h1>
      <Lead className="mt-2 text-sm">
        {user
          ? "Your ledger syncs with this account."
          : "Saved on this device. Sign in to keep a copy."}
      </Lead>

      {!rows.length && (
        <div className="mt-10 rounded-xl bg-surface p-8 shadow-[var(--shadow-border)]">
          <p className="text-muted">Nothing saved yet.</p>
          <Button className="mt-4" asChild>
            <Link to="/">Appraise a Listing</Link>
          </Button>
        </div>
      )}

      <ul className="mt-8 space-y-3">
        {rows.map((row) => {
          const v = asVerdict(row.verdict);
          const copy = verdictCopy(v);
          return (
            <li
              key={row.id}
              className="flex flex-col gap-3 rounded-xl bg-surface p-4 shadow-[var(--shadow-border)] sm:flex-row sm:items-center sm:justify-between"
            >
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <Link
                    to="/card/$cardId"
                    params={{ cardId: row.cardId }}
                    className="truncate font-medium hover:underline"
                  >
                    {row.cardName}
                  </Link>
                  <Badge variant={variant(v)}>{copy.label}</Badge>
                </div>
                <p className="truncate text-sm text-muted">
                  {row.setName} · {row.marketplace} · {row.condition}
                  {row.grade !== "raw" ? ` · ${row.grade}` : ""}
                </p>
                <p className="mt-1 font-mono text-sm tabular-nums text-subtle">
                  Ask {formatUsd(row.listingPrice)} · Book {formatUsd(row.marketPrice)} ·{" "}
                  {labelSpread(row.spread)}
                </p>
              </div>
              <Button variant="ghost" size="icon" onClick={() => void remove(row.id)} aria-label="Remove">
                <Trash2 />
              </Button>
            </li>
          );
        })}
      </ul>
    </Shell>
  );
}
