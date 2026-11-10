import { createRootRoute, HeadContent, Outlet, Scripts, useRouterState } from "@tanstack/react-router";
import { Analytics } from "@vercel/analytics/react";
import { SpeedInsights, computeRoute } from "@vercel/speed-insights/react";
import { Toaster } from "sonner";
import { AuthProvider } from "@/lib/auth/provider";
import { PreviewHostBridge } from "@/components/preview-host-bridge";
import { ThemeProvider, THEME_BOOT, useTheme } from "@/lib/theme";
import { MarkProvider } from "@/components/app-mark";
import { PwaUpdateBanner } from "@/components/pwa-update-banner";
import { listenForInstallPrompt, registerServiceWorker } from "@/lib/pwa";
import { APP_SUBTITLE } from "@/lib/copy";
import { getRumPublicConfig } from "@/lib/observability/rum-config";
import { DatadogRum } from "@/lib/observability/rum";
import { initSentry } from "@/lib/observability/sentry";
import { useEffect } from "react";
import appCss from "../styles.css?url";

const APP_NAME = "DealDex";
const host = import.meta.env.VITE_PUBLIC_HOSTNAME || "dealdex.net";
const ogImage = `https://${host}/og.jpg?v=logo-only-20260822`;

export const Route = createRootRoute({
  beforeLoad: async () => {
    return { datadogRum: await getRumPublicConfig() };
  },
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1, viewport-fit=cover" },
      { title: APP_NAME },
      {
        name: "description",
        content: `${APP_SUBTITLE}.  Search supported eBay and Mercari listings and compare asking prices with available market references.`,
      },
      { name: "apple-mobile-web-app-title", content: APP_NAME },
      { name: "apple-mobile-web-app-capable", content: "yes" },
      { name: "mobile-web-app-capable", content: "yes" },
      { name: "apple-mobile-web-app-status-bar-style", content: "default" },
      { name: "theme-color", content: "#f3efe6" },
      { name: "twitter:card", content: "summary_large_image" },
      { property: "og:type", content: "website" },
      { property: "og:title", content: APP_NAME },
      {
        property: "og:description",
        content: APP_SUBTITLE,
      },
      { property: "og:url", content: `https://${host}/` },
      { property: "og:image", content: ogImage },
      { property: "og:image:width", content: "1200" },
      { property: "og:image:height", content: "630" },
    ],
    links: [
      { rel: "icon", href: "/favicon.ico?v=dd-isolated-20260822", sizes: "any" },
      { rel: "icon", type: "image/png", sizes: "32x32", href: "/favicon-32.png?v=dd-isolated-20260822" },
      { rel: "icon", type: "image/png", sizes: "16x16", href: "/favicon-16.png?v=dd-isolated-20260822" },
      { rel: "icon", type: "image/png", href: "/favicon.png?v=dd-isolated-20260822" },
      { rel: "stylesheet", href: appCss },
      { rel: "manifest", href: "/__grok/manifest.webmanifest" },
      { rel: "apple-touch-icon", href: "/__grok/icon-180.png" },
      {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght,SOFT,WONK@9..144,500..600,0..100,0..1&family=IBM+Plex+Sans:wght@400;500;600&family=IBM+Plex+Mono:wght@400;500&display=swap",
      },
    ],
  }),
  component: Root,
});

function Boot() {
  useEffect(() => {
    initSentry();
    listenForInstallPrompt();
    registerServiceWorker();
  }, []);
  return null;
}

function ThemedToaster() {
  const { resolved } = useTheme();
  return (
    <Toaster
      theme={resolved}
      position="bottom-center"
      toastOptions={{
        className: "bg-elevated text-fg border-border",
      }}
    />
  );
}

function VercelSpeedInsights() {
  const route = useRouterState({
    select: (state) => {
      const leaf = state.matches.at(-1);
      const params = leaf?.params ?? null;
      return computeRoute(state.location.pathname, params);
    },
  });
  return <SpeedInsights route={route} />;
}

function Root() {
  const { datadogRum } = Route.useRouteContext();
  return (
    <html lang="en" className="antialiased" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_BOOT }} />
        <HeadContent />
      </head>
      <body>
        <PreviewHostBridge />
        <ThemeProvider>
          <MarkProvider>
            <Boot />
            <AuthProvider>
              <Outlet />
              <PwaUpdateBanner />
              <ThemedToaster />
            </AuthProvider>
          </MarkProvider>
        </ThemeProvider>
        <DatadogRum config={datadogRum} />
        <Analytics />
        <VercelSpeedInsights />
        <Scripts />
      </body>
    </html>
  );
}
