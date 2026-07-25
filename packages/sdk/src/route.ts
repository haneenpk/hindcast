export interface RouteTracker {
  stop(): void;
}

/**
 * Single-page apps navigate without a page load, so rrweb never sees a
 * fresh document — the URL just changes under it. This patches the
 * history API and listens for back/forward and hash changes, firing only
 * when the address actually changed. The SDK uses that to close the
 * current chunk under the page it belongs to before the new route starts.
 */
export function trackRoutes(onChange: () => void): RouteTracker {
  try {
    let lastHref = window.location.href;
    const fire = (): void => {
      try {
        if (window.location.href === lastHref) return;
        lastHref = window.location.href;
        onChange();
      } catch {
        /* a route hook must never break the host app's navigation */
      }
    };

    const originalPush = history.pushState;
    const originalReplace = history.replaceState;

    history.pushState = function (...args): void {
      originalPush.apply(this, args as Parameters<History["pushState"]>);
      fire();
    };
    history.replaceState = function (...args): void {
      originalReplace.apply(this, args as Parameters<History["replaceState"]>);
      fire();
    };
    window.addEventListener("popstate", fire);
    window.addEventListener("hashchange", fire);

    return {
      stop() {
        try {
          history.pushState = originalPush;
          history.replaceState = originalReplace;
          window.removeEventListener("popstate", fire);
          window.removeEventListener("hashchange", fire);
        } catch {
          /* best-effort teardown */
        }
      },
    };
  } catch {
    return { stop() {} };
  }
}
