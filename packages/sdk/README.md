# @hindcast/sdk

Browser session-replay recorder for [Hindcast](https://github.com/haneenpk/hindcast) — self-hosted session replay. It records DOM events (the rrweb technique — events, not pixels), masks sensitive fields **in the browser before anything is sent**, and ships to your own ingest endpoint.

> Hindcast is self-hosted. This SDK records on your site and sends to a Hindcast backend **you run** — there's no hosted service. See the [self-hosting guide](https://github.com/haneenpk/hindcast#self-hosting) to stand one up.

## Install

```sh
npm i @hindcast/sdk
```

## Use

```ts
import { init } from "@hindcast/sdk";

init({
  key: "prj_live_…",                    // from the project's settings page
  endpoint: "https://ingest.example.com", // your Hindcast ingest host
});
```

Prefer no build step? Drop the single-file `r.js` embed in your `<head>` instead — it's served from your ingest host, rrweb bundled in.

## API

- **`init(config)`** — start recording. Config:
  - `key`, `endpoint` — required
  - `enabled` — kill switch; gate recording behind consent or an env
  - `flushIntervalMs`, `debug`
  - `reportButton` — render the floating "report a bug" widget
  - `privacy.unmask` — a selector allowlist for fields recorded in clear
- **`report(comment?)`** — flag the current session; wire it to your own feedback button
- **`stop()`** — tear the recorder down

## Privacy

Masking runs in the visitor's browser before a single event leaves it. Password and card fields are **never** unmaskable — no attribute or config reaches them. Anything marked `data-private` records as a blank block.

## License

MIT
