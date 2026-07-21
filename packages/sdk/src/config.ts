export interface HindcastConfig {
  /** Project key, from the project settings page. */
  key: string;
  /** Base URL of the ingest API, e.g. "https://ingest.example.com". */
  endpoint: string;
  /** How often buffered events are shipped, in ms. Default 5000, floor 1000. */
  flushIntervalMs?: number;
  /** Kill switch: set to false and init() does nothing at all. */
  enabled?: boolean;
  /** console.debug output while integrating. Leave off in production. */
  debug?: boolean;
  /** Renders the floating "report a bug" button. Off by default. */
  reportButton?: boolean;
  privacy?: {
    /**
     * Selectors whose inputs record their real text instead of asterisks.
     * Password and card fields ignore this list — they are never
     * unmaskable.
     */
    unmask?: string[];
  };
}

export interface ResolvedConfig {
  key: string;
  endpoint: string;
  flushIntervalMs: number;
  debug: boolean;
  reportButton: boolean;
  unmaskSelectors: string[];
}

export function resolveConfig(config: HindcastConfig): ResolvedConfig | null {
  try {
    if (config.enabled === false) return null;
    if (typeof config.key !== "string" || config.key.length === 0) return null;
    if (typeof config.endpoint !== "string" || !/^https?:\/\//.test(config.endpoint)) {
      return null;
    }
    return {
      key: config.key,
      endpoint: config.endpoint.replace(/\/+$/, ""),
      flushIntervalMs: Math.max(1000, config.flushIntervalMs ?? 5000),
      debug: config.debug === true,
      reportButton: config.reportButton === true,
      unmaskSelectors: Array.isArray(config.privacy?.unmask)
        ? config.privacy.unmask.filter(
            (selector): selector is string => typeof selector === "string",
          )
        : [],
    };
  } catch {
    return null;
  }
}

export function debugLog(config: ResolvedConfig, ...args: unknown[]): void {
  if (!config.debug) return;
  try {
    console.debug("[hindcast]", ...args);
  } catch {
    /* a broken console is not our problem to surface */
  }
}
