import type { Metadata } from "next";
import Link from "next/link";
import { CopyButton } from "@/components/copy-button";
import { HindcastMark } from "@/components/hindcast-mark";

export const metadata: Metadata = {
  title: "Hindcast — self-hosted session replay",
  description:
    "Watch what your users did before the error. Hindcast records real sessions as DOM events and plays them back like film — masked in the browser, on your own infrastructure.",
};

const GITHUB = "https://github.com/haneenpk/hindcast";

const scriptSnippet = `<script async
  src="https://hindcast.example.com/r.js"
  data-key="prj_live_9f2c…"
  data-endpoint="https://hindcast.example.com"></script>`;

const initSnippet = `import { init } from "@hindcast/sdk";

init({
  key: "prj_live_9f2c…",
  endpoint: "https://hindcast.example.com",
});`;

const runCommands = [
  "git clone https://github.com/haneenpk/hindcast && cd hindcast",
  "docker compose up -d",
  "pnpm install && pnpm db:migrate",
  "pnpm --filter @hindcast/ingest start:dev",
  "pnpm --filter @hindcast/web dev",
];

function Mark() {
  return <HindcastMark className="text-amber h-5 w-5" />;
}

const STEPS = [
  {
    n: "01",
    title: "Record",
    body: "One async script tag captures DOM mutations — the rrweb technique, events not pixels — and flushes every few seconds.",
  },
  {
    n: "02",
    title: "Mask",
    body: "Inputs are masked in the visitor's browser before anything is sent. Password and card fields can never be unmasked.",
  },
  {
    n: "03",
    title: "Store",
    body: "The ingest API gzips event chunks into your object storage and keeps only metadata in Postgres.",
  },
  {
    n: "04",
    title: "Replay",
    body: "Watch the session back with errors and failed requests on a synced timeline. Click one, land on the moment it broke.",
  },
];

export default function LandingPage() {
  return (
    <div className="min-h-dvh">
      <header className="mx-auto flex max-w-5xl items-center justify-between px-6 py-5">
        <span className="flex items-center gap-2">
          <Mark />
          <span className="font-mono text-[13px] font-medium tracking-tight">
            hindcast
          </span>
        </span>
        <nav className="flex items-center gap-5 text-[13px]">
          <a href={GITHUB} className="text-muted transition-colors hover:text-fg">
            GitHub
          </a>
          <Link
            href="/projects"
            className="rounded-md border border-edge px-3 py-1.5 text-muted transition-colors hover:text-fg"
          >
            Open dashboard
          </Link>
        </nav>
      </header>

      <main className="mx-auto max-w-5xl px-6">
        <section className="pt-16 pb-14">
          <p className="text-muted mb-4 font-mono text-xs tracking-wide">
            Self-hosted session replay
          </p>
          <h1 className="max-w-2xl text-4xl leading-[1.1] font-medium tracking-tight sm:text-5xl">
            Watch what your users did before the error.
          </h1>
          <p className="text-muted mt-5 max-w-xl text-[15px] leading-relaxed">
            A JavaScript error stops being a bare stack trace and becomes the
            thirty seconds of footage that led up to it. Hindcast records real
            sessions as DOM events — every click, scroll and input — and plays
            them back like film. Sensitive fields are masked in the browser
            before anything leaves it, and the whole thing runs on your own
            infrastructure.
          </p>
          <div className="mt-7 flex flex-wrap items-center gap-3">
            <a
              href="#get-started"
              className="rounded-md bg-white px-4 py-2 text-[13px] font-medium text-black transition-opacity hover:opacity-90"
            >
              Get started
            </a>
            <a
              href={GITHUB}
              className="rounded-md border border-edge px-4 py-2 text-[13px] text-muted transition-colors hover:text-fg"
            >
              View the source
            </a>
          </div>
        </section>

        <section className="pb-16">
          <div className="overflow-hidden rounded-lg border border-edge bg-surface">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/hero.png"
              alt="The Hindcast dashboard: a cross-project feed of what broke or got reported, above per-project cards with sessions, error rate, and a sparkline of recent errors."
              className="block w-full"
            />
          </div>
        </section>

        <section className="border-t border-edge py-16">
          <h2 className="mb-8 text-lg font-medium tracking-tight">
            How it works
          </h2>
          <div className="grid gap-x-8 gap-y-8 sm:grid-cols-2 lg:grid-cols-4">
            {STEPS.map((step) => (
              <div key={step.n}>
                <p className="text-faint mb-2 font-mono text-xs">{step.n}</p>
                <h3 className="mb-1.5 text-[15px] font-medium">{step.title}</h3>
                <p className="text-muted text-[13px] leading-relaxed">
                  {step.body}
                </p>
              </div>
            ))}
          </div>
        </section>

        <section id="get-started" className="border-t border-edge py-16">
          <h2 className="text-lg font-medium tracking-tight">Get started</h2>
          <p className="text-muted mt-2 max-w-xl text-[13px] leading-relaxed">
            Hindcast is self-hosted — you run the backend (steps 1–2), then point
            your site at it (step 3). No hosted service, no account. Four steps
            from clone to first replay.
          </p>

          <div className="mt-9 grid gap-x-10 gap-y-9 lg:grid-cols-2">
            <div>
              <p className="text-faint mb-2 font-mono text-xs">01</p>
              <h3 className="mb-1.5 text-[15px] font-medium">Run it</h3>
              <p className="text-muted text-[13px] leading-relaxed">
                Docker brings up Postgres, Redis and object storage; then start
                the ingest API (<span className="font-mono text-xs">:4100</span>){" "}
                and the dashboard (
                <span className="font-mono text-xs">:3000</span>). Set an{" "}
                <span className="font-mono text-xs">ADMIN_SECRET</span> to lock
                the dashboard.
              </p>
              <div className="mt-3 space-y-2">
                {runCommands.map((cmd) => (
                  <div
                    key={cmd}
                    className="flex items-center gap-2 rounded-md border border-edge bg-surface py-1.5 pr-1.5 pl-3"
                  >
                    <code className="scroll-thin min-w-0 flex-1 overflow-x-auto font-mono text-xs whitespace-nowrap">
                      {cmd}
                    </code>
                    <CopyButton text={cmd} />
                  </div>
                ))}
              </div>
            </div>

            <div>
              <p className="text-faint mb-2 font-mono text-xs">02</p>
              <h3 className="mb-1.5 text-[15px] font-medium">
                Create a project
              </h3>
              <p className="text-muted text-[13px] leading-relaxed">
                Unlock the dashboard with your secret and create a project — one
                per site you want to record. It hands you a project key and the
                install snippet.
              </p>
            </div>

            <div>
              <p className="text-faint mb-2 font-mono text-xs">03</p>
              <h3 className="mb-1.5 text-[15px] font-medium">Add the script</h3>
              <p className="text-muted text-[13px] leading-relaxed">
                Point it at the ingest host from step 1 and recording starts
                immediately, masked in the browser. Two ways to load it — pick
                one.
              </p>

              <p className="text-muted mt-4 mb-2 text-[13px] font-medium">
                A drop-in tag — no build step
              </p>
              <div className="relative rounded-lg border border-edge bg-surface p-4">
                <div className="absolute top-3 right-3">
                  <CopyButton text={scriptSnippet} />
                </div>
                <pre className="scroll-thin overflow-x-auto font-mono text-xs leading-relaxed whitespace-pre">
                  {scriptSnippet}
                </pre>
              </div>

              <p className="text-muted mt-5 mb-2 text-[13px] font-medium">
                Or npm, if you build with a bundler
              </p>
              <div className="flex items-center gap-2 rounded-md border border-edge bg-surface py-1.5 pr-1.5 pl-3">
                <code className="scroll-thin min-w-0 flex-1 overflow-x-auto font-mono text-xs whitespace-nowrap">
                  npm i @hindcast/sdk
                </code>
                <CopyButton text="npm i @hindcast/sdk" />
              </div>
              <div className="relative mt-2 rounded-lg border border-edge bg-surface p-4">
                <div className="absolute top-3 right-3">
                  <CopyButton text={initSnippet} />
                </div>
                <pre className="scroll-thin overflow-x-auto font-mono text-xs leading-relaxed whitespace-pre">
                  {initSnippet}
                </pre>
              </div>
            </div>

            <div>
              <p className="text-faint mb-2 font-mono text-xs">04</p>
              <h3 className="mb-1.5 text-[15px] font-medium">Watch</h3>
              <p className="text-muted text-[13px] leading-relaxed">
                Sessions appear within seconds. The ones that broke wear a red
                dot — click one and watch it back, with the console and network
                timeline synced underneath.
              </p>
            </div>
          </div>

          <p className="text-muted mt-9 text-[13px] leading-relaxed">
            Deploying for real?{" "}
            <a
              href={`${GITHUB}#self-hosting`}
              className="text-fg underline-offset-4 transition-opacity hover:opacity-70 hover:underline"
            >
              The self-host guide
            </a>{" "}
            covers env vars, object storage, and exposing ingest to the internet.
          </p>
        </section>

        <section className="border-t border-edge py-16">
          <h2 className="max-w-2xl text-lg leading-snug font-medium tracking-tight">
            Privacy is the default, not a setting.
          </h2>
          <p className="text-muted mt-3 max-w-xl text-[13px] leading-relaxed">
            Masking runs in the visitor's browser before a single event is
            sent, so sensitive data is never recorded in the first place —
            there is nothing to leak later. Password and card fields have no
            unmask escape hatch at any layer, and anything marked{" "}
            <span className="font-mono text-xs">data-private</span> records as a
            blank block. What was never captured can't leak.
          </p>
        </section>
      </main>

      <footer className="border-t border-edge">
        <div className="text-muted mx-auto flex max-w-5xl items-center justify-between px-6 py-6 text-[13px]">
          <span className="flex items-center gap-2">
            <Mark />
            <span className="font-mono text-xs">hindcast</span>
          </span>
          <a href={GITHUB} className="transition-colors hover:text-fg">
            github.com/haneenpk/hindcast
          </a>
        </div>
      </footer>
    </div>
  );
}
