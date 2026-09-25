function flag(value: string | undefined): boolean {
  const v = value?.toLowerCase();
  return v === "1" || v === "true" || v === "on";
}

// The marketing landing at `/` is meant for a public/hosted deployment,
// not for a self-hosted instance — a clone should go straight to the app.
// Off by default; a hosted deploy opts in with HINDCAST_LANDING=true.
export function landingEnabled(): boolean {
  return flag(process.env.HINDCAST_LANDING);
}

// Whether the landing links through to the dashboard. Off by default: the
// public marketing deploy has no backend, so a link there would lead to a
// login that can't work. A self-hosted instance that also shows the
// landing turns it on with HINDCAST_DASHBOARD_LINK=true.
export function dashboardLinkEnabled(): boolean {
  return flag(process.env.HINDCAST_DASHBOARD_LINK);
}
