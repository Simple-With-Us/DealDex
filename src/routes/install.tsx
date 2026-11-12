import { createFileRoute } from "@tanstack/react-router";
import { NativePhones } from "@/components/native-phones";
import { Shell } from "@/components/shell";
import { Lead } from "@/components/lead";

export const Route = createFileRoute("/install")({ component: InstallPage });

function InstallPage() {
  return (
    <Shell>
      <p className="text-xs uppercase tracking-[0.16em] text-subtle">Native apps</p>
      <h1 className="mt-1 font-display text-4xl tracking-tight">Android and iPhone</h1>
      <Lead>
        Two phone apps.{"\u00A0 "}They scan eBay and Mercari on the device, compare each asking
        price with market prices, and keep working if this website is down.{"\u00A0 "}A scan never
        sends a paid price-source key to a DealDex server.
      </Lead>

      <aside className="mt-6 max-w-2xl rounded-xl border border-deal-bad/40 bg-surface p-4 text-sm shadow-[var(--shadow-border)]">
        <h2 className="font-medium text-deal-bad">No sideload build on this site right now</h2>
        <p className="mt-1 text-muted">
          The public APK that used to live here was an older build.{"\u00A0 "}It sent your
          price-source keys off the phone and stored them without encryption.{"\u00A0 "}That file is
          gone.{"\u00A0 "}A new Android download will appear only after a signed, device-tested
          release.{"\u00A0 "}Do not look for a download button until then.
        </p>
      </aside>

      <div className="mt-8 grid items-start gap-10 lg:grid-cols-[auto_1fr]">
        <NativePhones />
        <div className="min-w-0 space-y-4">
          <article className="rounded-xl bg-surface p-5 shadow-[var(--shadow-border)]">
            <h2 className="font-display text-2xl tracking-tight">Android</h2>
            <p className="mt-2 text-sm text-muted">
              There is no Google Play listing yet, and this site does not offer a download.
              {"\u00A0 "}
              The camera scanner is on iPhone until Android ships one.
            </p>
          </article>
          <article className="rounded-xl bg-surface p-5 shadow-[var(--shadow-border)]">
            <h2 className="font-display text-2xl tracking-tight">iPhone</h2>
            <p className="mt-2 text-sm text-muted">
              The iPhone app is on TestFlight for testers.{"\u00A0 "}Apple does not allow an
              unsigned download.
            </p>
          </article>
        </div>
      </div>
    </Shell>
  );
}
