import { createFileRoute } from "@tanstack/react-router";
import { Shell } from "@/components/shell";
import { Lead } from "@/components/lead";

export const Route = createFileRoute("/privacy")({ component: PrivacyPage });

function PrivacyPage() {
  return (
    <Shell>
      <p className="text-xs uppercase tracking-[0.16em] text-subtle">Legal</p>
      <h1 className="mt-1 font-display text-4xl tracking-tight">Privacy</h1>
      <Lead>
        The phone apps keep your desk keys on the device and scan from there.  The website scans
        on our server, so it sends the keys you saved with each scan.  Sign-in is optional.
      </Lead>

      <div className="mt-8 max-w-2xl space-y-6 text-sm leading-relaxed text-muted">
        <section className="space-y-2">
          <h2 className="font-display text-xl tracking-tight text-fg">What Stays on the Phone</h2>
          <p>
            API keys you paste into the Android or iPhone app are stored in the device keystore
            (Android EncryptedSharedPreferences, iOS Keychain).  Those apps scan eBay, Mercari and
            your paid desks from the phone itself.  <strong>Scanning never sends a key</strong> —
            the scan endpoint refuses one outright.  The only time a key leaves the phone is if you
            tap Push Phone Keys to Account yourself, which stores an encrypted copy so another
            device can restore it.  If the phone cannot reach a marketplace it falls back to this
            website's free-desk book, which uses no key of yours.
          </p>
          <p>
            The <strong>website</strong> works differently and it is worth being clear about it.
            Keys you paste at <code>/settings</code> are held in your browser, but a scan runs on
            our server, so the keys you have saved are sent with each scan request in order to
            query those desks.  They are used for that request and are not stored unless you
            choose the account backup below.  If you would rather no key ever left your device,
            use the phone apps.
          </p>
        </section>
        <section className="space-y-2">
          <h2 className="font-display text-xl tracking-tight text-fg">Optional Account</h2>
          <p>
            If you sign in, DealDex stores your email and any keys you choose to back up so you
            can restore them on another device.  Backed-up keys are encrypted at rest.  You can
            use the apps without an account.
          </p>
        </section>
        <section className="space-y-2">
          <h2 className="font-display text-xl tracking-tight text-fg">Website Analytics</h2>
          <p>
            The DealDex website uses Vercel Web Analytics to count visits and page views, and
            Vercel Speed Insights to measure Core Web Vitals (paint, layout, and interaction
            timing).  Those products do not use cookies and do not identify you.  The website
            also sends logs, traces, and Real User Monitoring to Datadog on the existing fleet
            account so errors and slow requests stay visible.  Datadog Session Replay is off.
            Scan hops (eBay, Mercari, match, enrich, and cache hit or miss) are timed with
            Sentry Performance so a slow marketplace step is visible without extra Datadog APM
            child spans.  Those traces do not include listing titles, search queries, or desk
            keys.  Native apps do not send those web events.
          </p>
        </section>
        <section className="space-y-2">
          <h2 className="font-display text-xl tracking-tight text-fg">Notifications</h2>
          <p>
            The iPhone app may ask to send local alerts when a listing matches a rule you set.
            You can decline.  DealDex does not send marketing push.
          </p>
        </section>
        <section className="space-y-2">
          <h2 className="font-display text-xl tracking-tight text-fg">Contact</h2>
          <p>
            Questions: use the email on the App Store or Play listing.  This page is the
            privacy policy for the DealDex website and the native apps.
          </p>
        </section>
      </div>
    </Shell>
  );
}
