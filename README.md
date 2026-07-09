# mprss

Cloudflare Worker to dynamically merge, deduplicate, and sort RSS feeds from `audiences.me` (via `stale-cache.crzidea.workers.dev`).

[![Deploy to Cloudflare Workers](https://deploy.workers.cloudflare.com/button)](https://deploy.workers.cloudflare.com/?url=https://github.com/crzidea/mprss)

## Features

- **No Hardcoded Keys**: The `rsskey` is passed dynamically as a query parameter (`?rsskey=...`), keeping your credentials safe.
- **Parallel Retrieval**: Fetches both target RSS feeds (with filters `sta5` and `sta1`) in parallel to minimize latency.
- **Deduplication**: Items are parsed, combined, and deduplicated using their `<guid>` (or `<link>`/`<title>` as fallbacks).
- **Chronological Sorting**: Automatically sorts all items by `<pubDate>` in descending order (newest first).
- **Pretty XML Formatting**: Outputs formatted RSS 2.0 XML with proper indentation and correct CDATA wrappers.

## Local Development

### 1. Install Dependencies
Ensure you have Node.js installed, then run:
```bash
npm install
```

### 2. Run Local Dev Server
Start the local server (uses Wrangler dev under the hood):
```bash
npm run dev
```

The server will be available at `http://127.0.0.1:8787`.

### 3. Test the Merged Feed
Retrieve the merged feed by supplying your RSS key as a query parameter:
```bash
curl "http://127.0.0.1:8787/?rsskey=YOUR_RSS_KEY"
```

## Deployment

### Deploy via CLI
To deploy the worker directly to your Cloudflare account from your command line:
```bash
npm run deploy
```

## Cloudflare Cross-Worker Routing (404 Issue)

Cloudflare Workers has a routing limitation where a worker fetching another worker on the same account/zone using its public `*.workers.dev` URL will route internally and fail with `404 Not Found`.

To resolve this, you can bind your `stale-cache` worker to a custom domain (e.g., `stale-cache.example.com`) and configure the `PROXY_BASE_URL` environment variable in your Cloudflare dashboard (under **Worker Settings -> Variables**):
- **Variable Name**: `PROXY_BASE_URL`
- **Value**: `https://stale-cache.example.com`

---

## Verification and Local Testing

### 1. Setup Local Environment File
Create a `.env` file in the root directory (this file is ignored by Git via [.gitignore](file:///home/crzidea/src/mprss/.gitignore)) and add your test RSS key:
```env
TEST_RSS_KEY=bd03132aaa3840442406830ee742cdee
```

### 2. Run the Verification Command
After starting the dev server (`npm run dev`), load the variable from `.env` and query the worker using `curl`:
```bash
# Load variables from .env and query the dev server
export $(cat .env | xargs) && curl -i "http://127.0.0.1:8787/?rsskey=${TEST_RSS_KEY}"
```

To verify a custom TTL (e.g., 600 seconds):
```bash
export $(cat .env | xargs) && curl -i "http://127.0.0.1:8787/?rsskey=${TEST_RSS_KEY}&ttl=600"
```

---

### Deploy via GitHub (Deploy Button)
Click the button below to deploy your own instance of this worker directly through your web browser:

[![Deploy to Cloudflare Workers](https://deploy.workers.cloudflare.com/button)](https://deploy.workers.cloudflare.com/?url=https://github.com/crzidea/mprss)
