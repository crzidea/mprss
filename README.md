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

To resolve this, this project supports two methods:

### Method 1: Service Bindings (Recommended)
By default, the `wrangler.toml` is configured with a Service Binding:
```toml
[[services]]
binding = "STALE_CACHE"
service = "stale-cache"
```
When deployed, Cloudflare routes requests to `stale-cache` internally. In local development (where bindings are not active), the worker automatically falls back to fetching over the public internet.

### Method 2: Custom Proxy Domain
If you have bound your `stale-cache` worker to a custom domain (e.g., `stale-cache.example.com`), you can configure the `PROXY_BASE_URL` environment variable in your Cloudflare dashboard (under **Worker Settings -> Variables**):
- **Variable Name**: `PROXY_BASE_URL`
- **Value**: `https://stale-cache.example.com`

---

### Deploy via GitHub (Deploy Button)
Click the button below to deploy your own instance of this worker directly through your web browser:

[![Deploy to Cloudflare Workers](https://deploy.workers.cloudflare.com/button)](https://deploy.workers.cloudflare.com/?url=https://github.com/crzidea/mprss)
