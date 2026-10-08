# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project context

Output of a 26-hour hackathon (Data 4 Wildlife, Jan 2022, Challenge 1 Team 4): collect Instagram posts for Slow Loris hashtags via an API, then have a human review them in a browser and export suspected illegal wildlife trade (IWT) posts as a CSV benchmark dataset. There is no build system, linter, or test suite. The refactor roadmap is in `docs/refactor-plan.md`.

## Layout

- `app/` — the current tool. Two halves that communicate only through files on disk:
  1. `fetch_hashtag_posts.py` — data sourcing. For each entry in `hashtags`, calls RapidAPI `instagram85` (`/tag/{hashtag}/feed`, first page only), **deletes and recreates** `./hashtags/{hashtag}/`, writes `{hashtag}-page01.json`, and downloads each post's thumbnail as `{short_code}.jpg`. Paths are relative to the current working directory, so run it from `app/`.
  2. `index.html` + `index.js` — review UI (static page, jQuery + Bootstrap 5 + SweetAlert2 from CDN). The user imports a `{hashtag}-page01.json`; the hashtag is derived from the filename (text before the last `-`), and images are loaded from `hashtags/{hashtag}/{short_code}.jpg` relative to the page. This relative path is the contract between the two halves — moving either file breaks it.
  - `app/hashtags/` is generated output and is gitignored.
- `archive/` — the earlier notebook (`InstaImagesFromHashtags.ipynb`) and the data it collected in `sample-data/`. Read-only history, not active code. Its format (`page01.json`, images named by numeric `id`) is **not** compatible with the current review page. Known issue: the notebook wrote the same API response into every hashtag folder, so all four `sample-data/` hashtag folders are byte-identical; two folder names are mojibake of スローロリス and นางอาย.
- `docs/` — project docs and plans.

## Running

```
cd app
pip install -r requirements.txt
python fetch_hashtag_posts.py      # needs a real RAPIDAPI_KEY in the script
```
Then open `app/index.html` in a browser (tested on Chrome). No server is needed for JSON import; images resolve via relative paths.

## Things to know in index.js

- API keys are placeholder strings (`'Ask Alastair Jamieson'`) in both `fetch_hashtag_posts.py` (`RAPIDAPI_KEY`) and `index.js` (`GoogleTranslateAPIkey`). Don't commit real keys.
- Caption translation goes through Google Translate via the `cors-anywhere.herokuapp.com` proxy, throttled by a `translateQueue` drained every 100 ms. Translations are written back onto `allData[i].translatedCaption`.
- State is module-level globals (`hashtag`, `allData`, `taggedPosts`). Tagged posts are keyed by button id `post-{short_code}`.
- CSV export (`convertTaggedPostsToCSV`) maps instagram85 response fields (`short_code`, `post_url`, `created_time.string`, `owner.id`, `figures.likes_count`, `caption`, `location.name`) to the challenge's benchmark columns. It calls `.replace` on `translatedCaption` and reads `location.name`, so it throws if translation hasn't completed or a post lacks a location. The `mediaFilename` column still hard-codes a legacy `/scripts/hashtags/...` prefix.
- The JSON import shape expected is the raw instagram85 response: `{ code, data: [...] }`; `code === 404` means no posts for the hashtag.
