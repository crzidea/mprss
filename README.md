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

### Deploy via GitHub (Deploy Button)
Click the button below to deploy your own instance of this worker directly through your web browser:

[![Deploy to Cloudflare Workers](https://deploy.workers.cloudflare.com/button)](https://deploy.workers.cloudflare.com/?url=https://github.com/crzidea/mprss)
