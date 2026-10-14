import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { cn } from "@/lib/utils";
import { readAppMark, writeAppMark, type AppMarkId } from "@/lib/settings/mark";

/** Official DealDex title wordmark (glossy 3D red Deal + blue Dex, yellow rim). */
const DEALDEX_WORDMARK_SRC = "/marks/dealdex-wordmark.png?v=3d-20260820";

export function DealDexWordmark({
  className,
}: {
  className?: string;
}) {
  return (
    <img
      src={DEALDEX_WORDMARK_SRC}
      alt="DealDex"
      className={cn(
        "block h-9 w-auto max-w-[13rem] bg-transparent object-contain object-left outline-none sm:h-10 sm:max-w-[16rem]",
        className,
      )}
    />
  );
}

export function AppMark({
  id = "delta",
  className,
}: {
  id?: AppMarkId;
  className?: string;
}) {
  switch (id) {
    case "dd":
      return (
        <span className={cn("inline-flex h-7 items-center overflow-visible", className)} aria-hidden>
          <img
            src={DEALDEX_WORDMARK_SRC}
            alt=""
            className="h-6 w-auto max-w-[7.5rem] object-contain object-left"
          />
        </span>
      );
    case "peak":
      return (
        <ChipMark className={className}>
          <PeakIcon />
        </ChipMark>
      );
    case "disc":
      return (
        <ChipMark className={className}>
          <DiscIcon />
        </ChipMark>
      );
    case "delta":
      return (
        <ChipMark className={className}>
          <span className="font-display text-sm leading-none">Δ</span>
        </ChipMark>
      );
    default: {
      const _exhaustive: never = id;
      return _exhaustive;
    }
  }
}

function ChipMark({
  className,
  children,
}: {
  className?: string;
  children: ReactNode;
}) {
  return (
    <span
      className={cn(
        "grid size-7 shrink-0 place-items-center overflow-hidden rounded-sm border border-accent/40 text-accent",
        className,
      )}
      aria-hidden
    >
      {children}
    </span>
  );
}

function PeakIcon() {
  return (
    <svg viewBox="0 0 16 16" className="size-4" fill="none" aria-hidden>
      <path
        d="M3.2 12.2 8 4.2l4.8 8"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinejoin="round"
        strokeLinecap="round"
      />
      <path d="M5.6 9.4h4.8" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
    </svg>
  );
}

function DiscIcon() {
  return (
    <svg viewBox="0 0 16 16" className="size-4" aria-hidden>
      <circle cx="8" cy="8" r="6" fill="currentColor" />
      <path
        d="M5.2 10.4 8 5.8l2.8 4.6"
        fill="none"
        stroke="var(--color-bg)"
        strokeWidth="1.2"
        strokeLinejoin="round"
        strokeLinecap="round"
      />
    </svg>
  );
}

const MarkCtx = createContext<{
  mark: AppMarkId;
  setMark: (id: AppMarkId) => void;
}>({ mark: "delta", setMark: () => undefined });

export function MarkProvider({ children }: { children: ReactNode }) {
  const [mark, setMarkState] = useState<AppMarkId>(() => readAppMark());
  const setMark = useCallback((id: AppMarkId) => {
    setMarkState(id);
    writeAppMark(id);
  }, []);
  const value = useMemo(() => ({ mark, setMark }), [mark, setMark]);
  return <MarkCtx.Provider value={value}>{children}</MarkCtx.Provider>;
}

export function useAppMark() {
  return useContext(MarkCtx);
}
