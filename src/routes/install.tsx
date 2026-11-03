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
        Two phone apps. They scan eBay and Mercari on the device, score each ask against the desks,
        and keep working if this website is down. A scan never sends a paid desk key to a DealDex
        server.
      </Lead>

      <aside className="mt-6 max-w-2xl rounded-xl border border-deal-bad/40 bg-surface p-4 text-sm shadow-[var(--shadow-border)]">
        <h2 className="font-medium text-deal-bad">No sideload build on this site right now</h2>
        <p className="mt-1 text-muted">
          The public APK that used to live here was an older build. It sent paid desk keys to the
          scan endpoint, kept them in unencrypted storage, and returned a session token on a URL
          scheme other apps can claim. That file is gone. A refreshed Android APK ships only after a
          signed, device-tested release build. Do not restore a download button until then.
        </p>
      </aside>

      <div className="mt-8 grid items-start gap-10 lg:grid-cols-[auto_1fr]">
        <NativePhones />
        <div className="min-w-0 space-y-4">
          <article className="rounded-xl bg-surface p-5 shadow-[var(--shadow-border)]">
            <h2 className="font-display text-2xl tracking-tight">Android</h2>
            <p className="mt-2 text-sm text-muted">
              Build from <code className="text-xs">apps/android</code> on current{" "}
              <code className="text-xs">main</code>. Package{" "}
              <code className="text-xs">me.grok.dealdex</code>. There is no Play listing yet. The
              camera scanner is iOS-only until Android ships one.
            </p>
          </article>
          <article className="rounded-xl bg-surface p-5 shadow-[var(--shadow-border)]">
            <h2 className="font-display text-2xl tracking-tight">iPhone</h2>
            <p className="mt-2 text-sm text-muted">
              Internal TestFlight for bundle <code className="text-xs">net.dealdex</code>. Apple
              does not allow an unsigned download. Open the iOS project on a Mac if you are not on
              the tester list.
            </p>
          </article>
        </div>
      </div>
    </Shell>
  );
}
