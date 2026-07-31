// The marketing landing at `/` is meant for a public/hosted deployment,
// not for a self-hosted instance — a clone should go straight to the app.
// Off by default; a hosted deploy opts in with HINDCAST_LANDING=true.
export function landingEnabled(): boolean {
  const value = process.env.HINDCAST_LANDING?.toLowerCase();
  return value === "1" || value === "true" || value === "on";
}
