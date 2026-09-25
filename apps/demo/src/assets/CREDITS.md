# Asset credits

Fernwood is a fictional shop. Its photography and type come from these
sources; nothing here is original to this repo.

## Photography

All photos are from [Unsplash](https://unsplash.com) and used under the
[Unsplash License](https://unsplash.com/license) (free to use, including
commercially; no permission needed). Each was resized and re-encoded to WebP
for the demo.

| File | Photographer | Source |
| --- | --- | --- |
| `photos/walnut-writing-desk.webp` | Kirill | [unsplash.com/photos/1LYTR3hkc4g](https://unsplash.com/photos/1LYTR3hkc4g) |
| `photos/brass-table-lamp.webp` | Evan Marvell | [unsplash.com/photos/L3dZoRESfmM](https://unsplash.com/photos/L3dZoRESfmM) |
| `photos/linen-lounge-chair.webp` | Alina Bondar | [unsplash.com/photos/7mmmEkyk0aQ](https://unsplash.com/photos/7mmmEkyk0aQ) |
| `photos/oak-bookshelf.webp` | Aleksandra Dementeva | [unsplash.com/photos/NsUjsJznVbg](https://unsplash.com/photos/NsUjsJznVbg) |
| `photos/ceramic-table-vase.webp` | Mathilde Langevin | [unsplash.com/photos/WUrXahlyjBo](https://unsplash.com/photos/WUrXahlyjBo) |
| `photos/wool-throw-blanket.webp` | Susan Wilkinson | [unsplash.com/photos/XaGPw6cAv78](https://unsplash.com/photos/XaGPw6cAv78) |
| `photos/rattan-pendant-light.webp` | Content Pixie | [unsplash.com/photos/6CFCrt-7tHw](https://unsplash.com/photos/6CFCrt-7tHw) |
| `photos/marble-nesting-tables.webp` | Skiking Photos | [unsplash.com/photos/BcK00MSvjSU](https://unsplash.com/photos/BcK00MSvjSU) |
| `photos/hero-living-room.webp` | Spacejoy | [unsplash.com/photos/EVjqpcn79AM](https://unsplash.com/photos/EVjqpcn79AM) |

## Type

Headings are set in [Instrument Serif](https://github.com/Instrument/instrument-serif),
licensed under the SIL Open Font License 1.1 — see `fonts/OFL.txt`.

## Why everything is inlined

The production build inlines these files as data URLs (see
`vite.config.ts`). A session replay stores the page's DOM, not its network
traffic, so an image referenced by URL would come back broken whenever the
shop isn't running. Inlined, the pictures and type travel inside every
recording.
