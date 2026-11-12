import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

export type ThemePref = "light" | "dark" | "system";

export const THEME_KEY = "dealdex:theme";
const LEGACY_THEME_KEYS = ["spreaddex:theme"];

export const THEME_BOOT = `(function(){try{var p=localStorage.getItem("${THEME_KEY}");if(!p){for(var i=0;i<${LEGACY_THEME_KEYS.length};i++){var v=localStorage.getItem(${JSON.stringify(LEGACY_THEME_KEYS)}[i]);if(v){p=v;localStorage.setItem("${THEME_KEY}",v);localStorage.removeItem(${JSON.stringify(LEGACY_THEME_KEYS)}[i]);break;}}}if(!p)p="light";var d=p==="dark"||(p==="system"&&matchMedia("(prefers-color-scheme: dark)").matches);document.documentElement.classList.toggle("dark",d);document.documentElement.style.colorScheme=d?"dark":"light";}catch(e){}})();`;

export function readThemePref(): ThemePref {
  if (typeof window === "undefined") return "light";
  try {
    let v = window.localStorage.getItem(THEME_KEY);
    if (!v) {
      for (const legacy of LEGACY_THEME_KEYS) {
        const raw = window.localStorage.getItem(legacy);
        if (raw) {
          v = raw;
          window.localStorage.setItem(THEME_KEY, raw);
          window.localStorage.removeItem(legacy);
          break;
        }
      }
    }
    if (v === "dark" || v === "light" || v === "system") return v;
  } catch {
    /* ignore */
  }
  return "light";
}

export function resolvedTheme(pref: ThemePref): "light" | "dark" {
  if (pref === "system" && typeof window !== "undefined") {
    return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
  }
  return pref === "dark" ? "dark" : "light";
}

export function applyTheme(pref: ThemePref) {
  if (typeof document === "undefined") return;
  const next = resolvedTheme(pref);
  document.documentElement.classList.toggle("dark", next === "dark");
  document.documentElement.style.colorScheme = next;
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute("content", next === "dark" ? "#0c0d0b" : "#f3efe6");
}

type ThemeCtx = {
  pref: ThemePref;
  resolved: "light" | "dark";
  setPref: (p: ThemePref) => void;
};

const Ctx = createContext<ThemeCtx>({
  pref: "light",
  resolved: "light",
  setPref: () => undefined,
});

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [pref, setPrefState] = useState<ThemePref>(() => readThemePref());
  const [resolved, setResolved] = useState<"light" | "dark">(() =>
    resolvedTheme(readThemePref()),
  );

  useEffect(() => {
    applyTheme(readThemePref());
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => {
      const current = readThemePref();
      if (current === "system") {
        setResolved(resolvedTheme("system"));
        applyTheme("system");
      }
    };
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  const setPref = useCallback((p: ThemePref) => {
    setPrefState(p);
    setResolved(resolvedTheme(p));
    applyTheme(p);
    try {
      window.localStorage.setItem(THEME_KEY, p);
    } catch {
      /* ignore */
    }
  }, []);

  const value = useMemo(() => ({ pref, resolved, setPref }), [pref, resolved, setPref]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useTheme() {
  return useContext(Ctx);
}
