export type ThemePreference = "system" | "light" | "dark";
export type Theme = "light" | "dark";

export const THEME_STORAGE_KEY = "hc-theme";

/**
 * Runs in <head> before first paint so the page never flashes the wrong
 * theme. It resolves the stored preference ("system" follows the OS) and
 * keeps following the OS while the preference is "system". Kept as a
 * string because it has to execute before React does.
 */
export const themeBootScript = `(function () {
  var root = document.documentElement;
  var media = window.matchMedia("(prefers-color-scheme: light)");
  function apply() {
    var pref = null;
    try { pref = localStorage.getItem(${JSON.stringify(THEME_STORAGE_KEY)}); } catch (e) {}
    root.dataset.theme = pref === "light" || pref === "dark" ? pref : media.matches ? "light" : "dark";
  }
  apply();
  media.addEventListener("change", apply);
})();`;

export function readPreference(): ThemePreference {
  try {
    const stored = localStorage.getItem(THEME_STORAGE_KEY);
    return stored === "light" || stored === "dark" ? stored : "system";
  } catch {
    return "system";
  }
}

export function applyPreference(preference: ThemePreference): void {
  try {
    if (preference === "system") localStorage.removeItem(THEME_STORAGE_KEY);
    else localStorage.setItem(THEME_STORAGE_KEY, preference);
  } catch {
    /* storage blocked — the choice still applies for this page */
  }
  const resolved: Theme =
    preference === "system"
      ? window.matchMedia("(prefers-color-scheme: light)").matches
        ? "light"
        : "dark"
      : preference;
  document.documentElement.dataset.theme = resolved;
}
