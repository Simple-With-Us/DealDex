import { useEffect, useRef, useState } from "react";
import { Link } from "@tanstack/react-router";
import { Bell, Bookmark, KeyRound, Menu, ScanSearch } from "lucide-react";
import { authEnabled, signOut } from "@/lib/auth/client";
import { useCurrentUser } from "@/lib/auth/use-current-user";

function useDismiss(open: boolean, onClose: () => void) {
  const root = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    function onDoc(e: MouseEvent) {
      if (!root.current?.contains(e.target as Node)) onClose();
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open, onClose]);
  return root;
}

function MenuBody({
  onClose,
  signedIn,
  heading,
}: {
  onClose: () => void;
  signedIn: boolean;
  heading?: { name: string; email?: string };
}) {
  return (
    <div
      role="menu"
      className="absolute right-0 top-12 z-40 w-64 overflow-hidden rounded-lg bg-surface py-2 shadow-[var(--shadow-border)]"
    >
      {heading && (
        <div className="border-b border-border px-3 pb-2">
          <p className="truncate text-sm font-medium">{heading.name}</p>
          {heading.email && <p className="truncate text-xs text-subtle">{heading.email}</p>}
        </div>
      )}
      <div className="px-2 pt-1">
        <Link
          to="/"
          onClick={onClose}
          className="flex h-11 items-center gap-2 rounded-md px-2 text-sm text-muted hover:bg-elevated hover:text-fg"
        >
          <ScanSearch className="size-4" /> Scan
        </Link>
        <Link
          to="/saved"
          onClick={onClose}
          className="flex h-11 items-center gap-2 rounded-md px-2 text-sm text-muted hover:bg-elevated hover:text-fg"
        >
          <Bookmark className="size-4" /> Saved
        </Link>
        <Link
          to="/alerts"
          onClick={onClose}
          className="flex h-11 items-center gap-2 rounded-md px-2 text-sm text-muted hover:bg-elevated hover:text-fg"
        >
          <Bell className="size-4" /> Alerts
        </Link>
        <Link
          to="/settings"
          onClick={onClose}
          className="flex h-11 items-center gap-2 rounded-md px-2 text-sm text-muted hover:bg-elevated hover:text-fg"
        >
          <KeyRound className="size-4" /> Settings
        </Link>
      </div>
      <div className="mt-1 border-t border-border px-2 pt-1">
        {signedIn && authEnabled ? (
          <button
            type="button"
            onClick={() => void signOut()}
            className="flex h-11 w-full items-center rounded-md px-2 text-sm text-muted hover:bg-elevated hover:text-fg"
          >
            Sign out
          </button>
        ) : (
          <Link
            to="/login"
            onClick={onClose}
            className="flex h-11 items-center rounded-md px-2 text-sm text-muted hover:bg-elevated hover:text-fg"
          >
            Sign in
          </Link>
        )}
      </div>
    </div>
  );
}

export function AccountMenu() {
  const user = useCurrentUser();
  const [open, setOpen] = useState(false);
  const root = useDismiss(open, () => setOpen(false));
  const label = user?.displayName ?? user?.primaryEmail ?? "Account";

  if (!user) return null;

  return (
    <div ref={root} className="relative">
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label="Account menu"
        onClick={() => setOpen((v) => !v)}
        className="grid size-11 place-items-center rounded-full"
      >
        {user.profileImageUrl ? (
          <img
            src={user.profileImageUrl}
            alt={label}
            className="size-9 rounded-full object-cover"
            referrerPolicy="no-referrer"
          />
        ) : (
          <span className="grid size-9 place-items-center rounded-full bg-elevated text-sm font-medium">
            {label.charAt(0).toUpperCase()}
          </span>
        )}
      </button>
      {open && (
        <MenuBody
          onClose={() => setOpen(false)}
          signedIn
          heading={{ name: label, email: user.primaryEmail ?? undefined }}
        />
      )}
    </div>
  );
}

export function GuestMenu() {
  const [open, setOpen] = useState(false);
  const root = useDismiss(open, () => setOpen(false));

  return (
    <div ref={root} className="relative">
      <button
        type="button"
        aria-label="Menu"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className="grid size-11 place-items-center text-muted hover:text-fg"
      >
        <Menu className="size-5" />
      </button>
      {open && <MenuBody onClose={() => setOpen(false)} signedIn={false} />}
    </div>
  );
}
