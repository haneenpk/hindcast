import type { HindcastConfig } from "./config";
import { init, report, stop } from "./index";

// The self-initialising entry behind the embeddable r.js. A site drops in
// one async <script> tag with data-* attributes and recording starts; no
// bundler, no import. A tiny command queue also lets pages call
// hindcast("report", "…") before the script has finished loading.

function run(command: unknown, ...args: unknown[]): void {
  try {
    if (command === "init") init(args[0] as HindcastConfig);
    else if (command === "report") report(args[0] as string | undefined);
    else if (command === "stop") stop();
  } catch {
    /* a bad command must never surface on the host page */
  }
}

function configFromScript(): HindcastConfig | null {
  try {
    const script = document.currentScript as HTMLScriptElement | null;
    const key = script?.dataset.key;
    const endpoint = script?.dataset.endpoint;
    if (!key || !endpoint) return null;
    const config: HindcastConfig = { key, endpoint };
    if (script?.dataset.reportButton === "true") config.reportButton = true;
    if (script?.dataset.debug === "true") config.debug = true;
    return config;
  } catch {
    return null;
  }
}

(function bootstrap(): void {
  try {
    const globalRef = window as unknown as {
      hindcast?: { q?: unknown[][] } & ((...args: unknown[]) => void);
    };
    // Commands queued by the loader snippet before this file arrived.
    const queued =
      globalRef.hindcast && Array.isArray(globalRef.hindcast.q)
        ? globalRef.hindcast.q
        : [];

    globalRef.hindcast = (...args: unknown[]) => run(...args);

    const scriptConfig = configFromScript();
    if (scriptConfig) init(scriptConfig);

    for (const call of queued) {
      run(...(call as unknown[]));
    }
  } catch {
    /* if bootstrap can't run, the page carries on untouched */
  }
})();
