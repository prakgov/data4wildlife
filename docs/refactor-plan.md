# Refactor plan

Goal: turn the hackathon tool (fetch posts → manually review → export CSV) into a small **FastAPI backend** with a **simple, build-free frontend**, while keeping the 2022 hackathon work as an archive. The tool stays single-user and local-first. Each phase can be shipped on its own and they are ordered by value and risk.

## Current structure (after reorganisation, Oct 2026)

```
data4wildlife/
├── app/                      # the working tool
│   ├── fetch_hashtag_posts.py    # was updated_(code-webpage)/InstaPostsWithHashtags.py
│   ├── index.html / index.js     # review page
│   ├── requirements.txt
│   ├── README.md
│   └── hashtags/                 # generated, gitignored
├── archive/                  # 2022 hackathon history, read-only
│   ├── InstaImagesFromHashtags.ipynb
│   └── sample-data/              # was old_(code-images)/
├── docs/
├── .gitignore
├── CLAUDE.md · README.md · LICENSE
```

Today the only link between the two halves is the filesystem. The page loads images from `hashtags/<tag>/<short_code>.jpg` relative to itself, which is where the script writes them.

## Review findings

| # | Area | Finding | Severity | Resolved by |
|---|------|---------|----------|-------------|
| 1 | `app/index.html` | Uncommitted edit comments out the jQuery `<script>` (bundled in the same comment as old Bootstrap 5.1.3). `index.js` uses `$` everywhere → page is non-functional. | **Blocker** | Phase 0 (stop-gap), Phase 3 (jQuery removed) |
| 2 | `app/index.html` | Same edit also comments out `bootstrap-icons` CSS → Import/Export icons (`bi-cloud-*`) disappear. | Low | Phase 3 |
| 3 | `app/index.html` | SweetAlert2 loaded as floating `sweetalert2@11` without SRI; Bootstrap 5.3.8 is pinned with SRI. Inconsistent. | Low | Phase 3 |
| 4 | `app/index.js` | CSV export throws if any tagged post has no `translatedCaption` yet or no `location`. | High | Phase 4 (server-side export) |
| 5 | `app/index.js` | Captions are injected into the table as raw HTML (`'<small>'+post.caption+'</small>'`) → XSS from scraped content. | High | Phase 3 |
| 6 | `app/index.js` | CSV escaping is ad hoc (`"` → `'`, line breaks stripped); fields are quoted but not RFC 4180-escaped. | Medium | Phase 4 (`csv` module) |
| 7 | `app/index.js` | Dead code: `exportData`, `getFormattedDate`, `unicodeToChar`, global `filename`; implicit global `input`/`postId`. | Low | Phase 3 (rewrite) |
| 8 | `app/index.js` | `mediaFilename` hard-codes `/scripts/hashtags/...`, a folder that no longer exists. | Low | Phase 4 |
| 9 | Both | API keys are edited into source files by hand (`RAPIDAPI_KEY`, `GoogleTranslateAPIkey`). It's easy to commit them by accident, and the Translate key is exposed to the browser. | Medium | Phase 1 (`.env`) |
| 10 | `app/fetch_hashtag_posts.py` | `shutil.rmtree` wipes previous results on every run; bare `except:`; no HTTP status/error checks; only page 1 fetched. | Medium | Phase 2 |
| 11 | `archive/sample-data/` | All four hashtag folders are byte-identical (notebook bug: inner loop wrote one response into every folder). ~19 MB of which ~14 MB is duplicate. Two folder names are mojibake (`„Çπ„É≠„Éº„É≠„É™„Çπ` = スローロリス, `‡∏ô‡∏≤‡∏á‡∏≠‡∏≤‡∏¢` = นางอาย). | Medium | Phase 6 |
| 12 | External deps | `instagram85` on RapidAPI and the public `cors-anywhere.herokuapp.com` demo proxy are 2022-era dependencies. Check that both still exist before investing further. | Risk | Phase 0 (verify), Phase 2 (proxy removed) |
| 13 | `app/index.js` | Review state (`taggedPosts`) only lives in memory, so a page reload loses all tagging work. `Collecting time` is stamped at *export* time, not when the post was collected. | Medium | Phase 4 |

## Target architecture

```
data4wildlife/
├── backend/                  # FastAPI app (Python package)
│   ├── main.py                   # app factory; mounts /api routers, /media and the static frontend
│   ├── config.py                 # pydantic-settings Settings, reads .env
│   ├── schemas.py                # Pydantic models: Post, Review, HashtagSummary, ...
│   ├── db.py                     # SQLite (stdlib sqlite3) connection + schema
│   ├── routers/
│   │   ├── hashtags.py           # fetch / list / posts
│   │   ├── reviews.py            # tag/untag posts
│   │   └── export.py             # CSV download
│   ├── services/
│   │   ├── instagram.py          # RapidAPI client (httpx) + normalisation to Post
│   │   ├── translate.py          # Google Translate v2 client + caching
│   │   └── media.py              # image download/storage
│   └── cli.py                    # `python -m backend.cli fetch <tags...>` (replaces fetch script)
├── frontend/                 # static, no build step, served by FastAPI at /
│   ├── index.html                # Bootstrap 5 via CDN (pinned + SRI)
│   ├── app.js                    # vanilla JS + fetch(); no jQuery
│   └── styles.css
├── data/                     # runtime, gitignored: data4wildlife.db + media/<tag>/<short_code>.jpg
├── tests/                    # pytest; uses archive/sample-data/api-testrun/page.json as fixture
├── archive/                  # unchanged
├── docs/
├── requirements.txt          # fastapi, uvicorn[standard], httpx, pydantic-settings
├── requirements-dev.txt      # pytest, respx, ruff
├── .env.example              # committed template; real .env is gitignored
└── CLAUDE.md · README.md · LICENSE
```

How it runs: `uvicorn backend.main:app --reload` from the repo root, bound to `127.0.0.1:8000`. The frontend and API are served from the same origin, so the page needs no CORS setup and no cors-anywhere proxy.

### Configuration (`.env.example`)

Configuration lives in `.env.example`, which is committed. Copy it to `.env` (gitignored) and fill in the keys. `backend/config.py` loads it with `pydantic-settings`. If a required key is missing, the app still starts and the affected endpoint returns a clear 503, so the review UI keeps working without keys.

```dotenv
RAPIDAPI_KEY=
RAPIDAPI_HOST=instagram85.p.rapidapi.com
GOOGLE_TRANSLATE_API_KEY=
TRANSLATE_TARGET_LANG=en
DATA_DIR=data
```

### API sketch

| Method & path | Purpose | Replaces |
|---|---|---|
| `GET /api/health` | Liveness + which keys are configured (booleans only) | — |
| `POST /api/hashtags/{tag}/fetch?pages=1` | Fetch from RapidAPI, normalise, store posts, download images, queue translation. Upserts by `short_code`; never deletes previous data. | `fetch_hashtag_posts.py` |
| `GET /api/hashtags` | Collected hashtags with post/flagged counts | Manually browsing `hashtags/` folders |
| `GET /api/hashtags/{tag}/posts` | Normalised posts incl. translation + review status | JSON file import |
| `PUT /api/posts/{short_code}/review` | `{ "iwt": true, "notes": "..." }`, persisted | In-memory `taggedPosts` |
| `GET /api/hashtags/{tag}/export.csv` | Server-built CSV of flagged posts | `convertTaggedPostsToCSV` / `exportCSVFile` |
| `POST /api/import` | Ingest a legacy `{tag}-page01.json` (+ images folder if present) | Migration aid |
| `GET /media/{tag}/{short_code}.jpg` | Static images | Relative `hashtags/...` paths |

The backend converts the vendor's response into its own `Post` schema (`platform`, `post_id`, `url`, `posted_at`, `author_id`, `likes`, `caption`, `location`, `media_path`, `collected_at`, …). That way the frontend and CSV never depend on instagram85's field names, which moves the project toward the challenge's "platform agnostic" requirement.

### Frontend scope (kept simple)

- One page, same layout as today: a hashtag picker (replacing the file-import dialog), a "Fetch" button, the table, IWT toggle buttons and an "Export CSV" link.
- Vanilla JS using `fetch()` (~150 lines). Captions are rendered with `textContent`. Bootstrap CSS/JS and icons come from a pinned CDN with SRI. SweetAlert2 is either dropped in favour of Bootstrap alerts/toasts or pinned with SRI.
- No bundler, no npm, no framework. The intro/instructions accordion is kept and updated.

## Trade-offs

| Decision | Gain | Cost | Alternative considered |
|---|---|---|---|
| **Add a FastAPI backend** | Keys stay server-side; no CORS proxy; review state persists; CSV built correctly in Python; one place for business logic; testable | The tool no longer opens with a double-click: a Python environment and a running server are always required. More moving parts for a once-off hackathon tool. | Keep static page + script (previous plan). Cheaper, but can't fix #9 (key in browser), #12 (proxy) or #13 (lost reviews) cleanly. |
| **SQLite (stdlib `sqlite3`) for posts/reviews/translations; images on disk** | Atomic writes, easy queries (counts, flagged-only), survives reloads, zero extra service | Data is no longer human-readable JSON in folders; schema must be migrated by hand if it changes; binary file in `data/` | JSON files per hashtag (simpler, diffable, but racy on concurrent writes and awkward for review state). SQLModel/SQLAlchemy (nicer models, extra dependency, more than needed here). |
| **Vanilla JS static frontend served by FastAPI** | No build step, matches current skills/code, API stays reusable by scripts/notebooks | Some hand-written DOM code; no component reuse | Jinja2 templates + htmx (less JS, but couples UI to server templates). React/Vue (overkill, adds npm toolchain). |
| **Server-side translation, cached in DB** | Key hidden; each caption translated once; no per-load cost; target language configurable | Translation now happens at fetch time (slower fetch) or in a background task (needs status polling in UI) | Keep client-side translation (exposes key, needs CORS proxy). |
| **Synchronous fetch for 1 page; `BackgroundTasks` only when pagination arrives** | Simple request/response; easy to debug | A fetch request blocks for the duration of ~70 image downloads (seconds) | A task queue (Celery/RQ): unjustified for a single local user. |
| **`httpx` (async) instead of `requests`** | Concurrent image downloads; `respx` for mocking in tests | Async code is slightly harder to read for contributors new to it | Keep `requests` in a threadpool. |
| **Local-only, no auth** | Nothing to build or maintain | Must not be exposed beyond `127.0.0.1` as-is; multi-analyst use would need auth + deployment work | Add auth now (premature). |

## Breaking changes

| # | Change | Who/what is affected | Mitigation |
|---|---|---|---|
| B1 | `index.html` no longer works when opened from disk (`file://`); a server must be running. | Anyone following the current in-page instructions | README + in-page instructions updated; single command to start. |
| B2 | `app/fetch_hashtag_posts.py` removed; fetching is `POST /api/hashtags/{tag}/fetch` or `python -m backend.cli fetch <tags...>`. Hashtags are passed as arguments instead of edited in source. | Scripts or habits that call the old file | CLI keeps a one-command workflow. |
| B3 | Data moves from `app/hashtags/<tag>/<tag>-page01.json` + `<short_code>.jpg` to `data/data4wildlife.db` + `data/media/<tag>/<short_code>.jpg`. Re-fetching no longer deletes earlier results. | Existing local `hashtags/` folders | `POST /api/import` ingests legacy JSON + images. |
| B4 | JSON "Import" button replaced by a hashtag picker backed by the API. | Reviewers | `/api/import` remains for legacy files. |
| B5 | API keys move from source files to `.env` (template: `.env.example`). Placeholders in `index.js` / the fetch script are removed; the browser never sees the Translate key. | Anyone who has keys pasted into source | Document `cp .env.example .env`; `/api/health` reports missing keys. |
| B6 | The cors-anywhere "Request temp access" step disappears. | Instructions only | Remove from page. |
| B7 | **CSV output changes** (same 15 headers, same order): (a) RFC 4180 escaping, so quotes stay as `"` and line breaks are preserved inside quoted fields instead of being converted/stripped; (b) `Media Filename` becomes `media/<tag>/<short_code>.jpg` instead of `/scripts/hashtags/...`; (c) `Collecting time` is the real fetch time, not export time; (d) a missing location/translation is an empty field instead of a crash. | Anything that parses exported CSVs line-by-line or relies on old values | Note in README; downstream tools should use a real CSV parser. Optional `?legacy=true` flag only if a consumer is known to need it. |
| B8 | Repo layout: `app/` is split into `backend/` + `frontend/`; `requirements.txt` moves to the root; Python ≥ 3.10 required. | Docs, CLAUDE.md, contributors | Updated in the cut-over phase. |
| B9 | Review state is persisted: tags survive reloads and are shared across browser tabs. Previously a reload was an implicit "reset". | Reviewers | Add an "unflag all" action if needed. |

## Phases

### Phase 0: Hold the line and de-risk (small)
1. Restore the jQuery `<script>` in `app/index.html` (one line) so the current tool works until cut-over. Don't invest further in `index.js`.
2. **Verify external APIs**: does `instagram85` on RapidAPI still respond, and is a Google Translate v2 key available? If instagram85 is gone, choose a replacement provider *before* Phase 2. Only `services/instagram.py` should need to change.

### Phase 1: Backend skeleton
1. `backend/` package: `config.py` (pydantic-settings + `.env`), `main.py`, `/api/health`, `db.py` with schema (`posts`, `reviews`, `translations`).
2. Serve `frontend/` at `/` and `data/media` at `/media`.
3. `.gitignore`: add `data/`; keep `.env` ignored. `.env.example` committed.
4. `POST /api/import` for legacy JSON, with a pytest using `archive/sample-data/api-testrun/page.json`.

### Phase 2: Fetching and translation services
1. `services/instagram.py`: httpx client, `raise_for_status`, normalisation → `Post`, upsert, concurrent image download into `data/media/<tag>/`.
2. `services/translate.py`: Google Translate v2, store `source_lang` + `translated_text`, skip already-translated posts.
3. `backend/cli.py` for headless fetching. Tests mock HTTP with `respx`.

### Phase 3: Frontend rewrite
1. `frontend/index.html` + `app.js`: hashtag picker, fetch button, table rendered with `textContent`, IWT toggle → `PUT /review`, export link.
2. Pinned CDN assets with SRI; jQuery and cors-anywhere removed.

### Phase 4: Review persistence and export
1. Reviews endpoint + flagged counts.
2. `export.csv` via Python `csv` module, keeping the existing 15 benchmark headers.

### Phase 5: Cut-over
1. Delete `app/`. Update the README, CLAUDE.md and in-page instructions.
2. Add ruff config; run pytest in a pre-commit hook or CI (optional).

### Phase 6: Data clean-up (needs owner decision)
1. Decide whether `archive/sample-data/` stays: (a) keep one copy and delete the three duplicates, (b) delete it and rely on git history, or (c) keep as-is with a note. It's not known which hashtag the surviving data actually belongs to. It's likely the last one queried (นางอาย), but the repo can't confirm that.
2. If kept, rename the mojibake folders to their real Unicode names (or ASCII slugs like `slowloris-ja`, `slowloris-th`).
3. Optionally store the challenge guidelines PDF in `docs/` instead of linking a GitHub attachment.

### Later (only if the project grows)
- Pagination via `next_page` using `BackgroundTasks` + a status endpoint.
- Additional platforms behind the same `Post` schema (e.g. `services/youtube.py`).
- Multi-user deployment: auth, a non-SQLite DB, hosting.

## Out of scope

Multi-user hosting/auth, frontend frameworks or a JS build toolchain, task queues, and ML-based classification.
