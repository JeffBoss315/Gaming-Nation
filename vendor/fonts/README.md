# Fonts

Inter and JetBrains Mono, served from here rather than from Google Fonts.

## Why they are in the repo

The desktop client's pages are `file://`. It is started from a desktop
shortcut, often before the network is up, and it is used by people who are
about to play a game — not by people waiting on a stylesheet. Pulled from
`fonts.googleapis.com`, the two faces the whole design is set in simply were
not there in those cases, and the app rendered in Segoe UI and Consolas: the
same layout in somebody else's typeface. Offline, that was permanent.

They are the same 298 KB whether they are fetched once per machine or built
in, and building them in is the only version that always looks right. It also
means no third party is told which driver opened the client and when.

## What these files are

The variable builds: one file per Unicode subset, each carrying every weight
between 100 and 900, which is why there are thirteen files and not sixty.
Greek and Cyrillic are included — the map the client draws reaches Greece and
Russia, and a driver's name is their own.

`fonts.css` is the Google Fonts stylesheet with the `src: url(...)` rewritten
to point next door. The `unicode-range` on each block is what makes the
browser download only the subsets a page actually uses.

## Licence

Both are under the SIL Open Font License 1.1 — see `LICENSE-Inter.txt` and
`LICENSE-JetBrainsMono.txt`, which are kept here because the licence requires
them to travel with the fonts. The OFL permits bundling like this; it does not
permit selling the fonts on their own, which is not something this repo does.

## Refreshing them

Re-fetch the stylesheet for both families at `wght@100..900`, download each
`woff2` it names, and rewrite the URLs to bare filenames. Nothing else
references the old CDN any more, so there is no fallback path to keep working.
