# Vineyard City Crawl Script

Standalone script to crawl the Vineyard City government data sources and
populate the MongoDB Atlas index used by `jwoodtechnologies.com/vineyard`.

---

## Prerequisites

- **Python 3.11+**
- All backend dependencies:
  ```bash
  pip install -r backend/requirements.txt
  ```
- **Playwright** (for the Municipal Code Online crawler):
  ```bash
  playwright install chromium
  ```

---

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `MONGO_URL` | Yes | MongoDB Atlas connection string (`mongodb+srv://...`) |
| `DB_NAME` | No | Database name (default: `jwoodtech`) |
| `OPENAI_API_KEY` | No | Enables OpenAI embeddings; BM25-only search works without it |

The script looks for these in `backend/.env` first (if the file exists), then
falls back to the shell environment.

Example `backend/.env`:
```
MONGO_URL=mongodb+srv://user:pass@cluster.mongodb.net/
DB_NAME=jwoodtech
OPENAI_API_KEY=sk-...
```

---

## Commands

All commands are run from the **repository root**:

```bash
# Show current index status (no changes made)
python scripts/crawl_vineyard.py --status

# Connect and report existing data only (no crawl, no writes)
python scripts/crawl_vineyard.py --dry-run

# Crawl all sources and lock the new index as active
python scripts/crawl_vineyard.py

# Crawl only CivicClerk meetings
python scripts/crawl_vineyard.py --source civicclerk

# Crawl only Municipal Code Online
python scripts/crawl_vineyard.py --source municode

# Crawl only vineyardutah.gov
python scripts/crawl_vineyard.py --source vineyard

# Crawl all sources but do NOT promote the new build version
python scripts/crawl_vineyard.py --no-lock
```

---

## What the Script Does

1. **Connects** to MongoDB Atlas using `MONGO_URL` / `DB_NAME`.
2. **Seeds sources** into `db.sources` if they don't already exist:
   - `https://vineyard.municipalcodeonline.com/` — Municipal Code
   - `https://vineyardut.portal.civicclerk.com/` — CivicClerk (Meetings)
   - `https://www.vineyardutah.gov/` — Vineyard Utah (Official)
   - RDA Past Meetings XLSX (legacy)
3. **Assigns a build version** (`build-YYYYMMDD-HHMMSS`) for this run.
4. **Crawls** each source in sequence:
   - **CivicClerk** — OData REST API at `vineyardut.api.civicclerk.com/v1`.
     Pages through all events, fetches agenda outlines, downloads and indexes
     all published files (agendas, minutes, packets) via `plainText=true`
     stream with PyMuPDF fallback.
   - **Municipal Code Online** — Playwright (headless Chromium) intercepts
     XHR responses from the AngularJS SPA. Walks 9 document types
     (ordinances, districts, resolutions, general plan, etc.) and splits
     content into granular sections.
   - **vineyardutah.gov / generic** — BFS crawler using httpx + BeautifulSoup.
     Handles HTML pages, PDFs (PyMuPDF), and XLSX spreadsheets. Stays
     within the same hostname; depth-limited to 10 levels.
5. **Writes chunks** to `db.documents` tagged with the build version.
6. **Prints a summary** of sources crawled, documents indexed, and errors.
7. **Locks the index** by promoting the build version to active in
   `db.index_meta` (unless `--no-lock` is passed).

---

## MongoDB Collections

| Collection | Purpose |
|------------|---------|
| `db.documents` | Primary search index — one row per text chunk |
| `db.sources` | One row per crawl source (URL, label, status, metrics) |
| `db.index_meta` | Active version pointer (`kind=active`) |
| `db.metrics` | Atomic usage counters |

### Document fields
`id`, `source_id`, `source_root`, `source_label`, `source_site`, `url`,
`pdf_url`, `title`, `section_ref`, `excerpt`, `content`, `is_pdf`,
`is_xlsx`, `doc_type`, `meeting_date`, `depth`, `index_version`, `created_at`

### Recommended Atlas indexes
```javascript
// Text index (enables fast $text pre-filter in search)
db.documents.createIndex({ title: "text", content: "text" })

// Source filter
db.documents.createIndex({ source_site: 1, index_version: 1 })
db.documents.createIndex({ source_id: 1, index_version: 1 })

// Date filter
db.documents.createIndex({ meeting_date: 1, index_version: 1 })

// Doc type filter
db.documents.createIndex({ doc_type: 1, index_version: 1 })
```

---

## Index Versioning

Each crawl writes chunks tagged with `index_version = "build-YYYYMMDD-HHMMSS"`.
The production search API reads only the version recorded in
`db.index_meta { kind: "active" }`.

When the script finishes (and `--no-lock` is not set), it:
1. Archives the current active version as `prev-<old-version>`
2. Sets the new build version as active
3. Cleans up older `prev-*` snapshots (keeps at most one rollback copy)

To roll back to the previous version, use the admin endpoint on the
production server or manually update `db.index_meta`.

---

## Expected Output

```
[env] Loaded /path/to/backend/.env

=== Crawl Summary ===
  Build version: build-20260606-143022
  [done    ] CivicClerk (Meetings)            docs=  847  errors=0  url=https://vineyardut.portal.civicclerk.com/
  [done    ] Municipal Code                   docs=  312  errors=3  url=https://vineyard.municipalcodeonline.com/
  [done    ] Vineyard Utah (Official)         docs=  201  errors=2  url=https://www.vineyardutah.gov/

  Total documents indexed into build-20260606-143022: 1360

  Index locked: build-20260606-143022 (1360 docs)
```

---

## Verifying the Index

After a crawl, verify with:

```bash
python scripts/crawl_vineyard.py --status
```

Or check directly in MongoDB Atlas under the `jwoodtech.documents` collection.

The production search at `jwoodtechnologies.com/vineyard` will immediately
serve results from the new active version.
