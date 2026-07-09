import { parseFeed, mergeFeeds, buildRssXml } from './rss.js';

// Helper to construct proxy URLs dynamically, preserving the exact query parameter ordering
function buildProxyUrl(baseUrl, rsskey, staVal, ttl) {
  const params = [
    ['rows', '50'],
    ['cat401', '1'],
    ['cat402', '1'],
    ['med10', '1'],
    [`sta${staVal}`, '1'],
    ['tea19', '1'],
    ['tea21', '1'],
    ['tea20', '1'],
    ['torrent_type', '0'],
    ['rsskey', rsskey]
  ];

  const targetUrl = new URL('https://audiences.me/torrentrss.php');
  for (const [key, value] of params) {
    targetUrl.searchParams.set(key, value);
  }

  const proxyUrl = new URL(baseUrl);
  proxyUrl.searchParams.set('regex', '^\\<');
  proxyUrl.searchParams.set('ttl', String(ttl));
  proxyUrl.searchParams.set('url', targetUrl.toString());

  return proxyUrl.toString();
}

export default {
  async fetch(request, env, ctx) {
    try {
      const url = new URL(request.url);
      const rsskey = url.searchParams.get('rsskey');

      if (!rsskey) {
        return new Response(
          'Error: Missing "rsskey" query parameter. Please request with ?rsskey=YOUR_KEY',
          {
            status: 400,
            headers: { 'Content-Type': 'text/plain; charset=utf-8' }
          }
        );
      }

      // Read optional 'ttl' query param, default to 300
      const ttlParam = url.searchParams.get('ttl');
      const parsedTtl = ttlParam ? parseInt(ttlParam, 10) : 300;
      const ttl = isNaN(parsedTtl) || parsedTtl <= 0 ? 300 : parsedTtl;

      // Check Cloudflare Cache
      const cache = typeof caches !== 'undefined' ? caches.default : null;
      const isGet = request.method === 'GET';
      let cachedResponse = null;
      if (cache && isGet) {
        cachedResponse = await cache.match(request);
      }
      if (cachedResponse) {
        console.log('Returning response from cache');
        return cachedResponse;
      }

      // Define the base URL for the stale-cache proxy
      const baseUrl = env.PROXY_BASE_URL || 'https://stale-cache.crzidea.workers.dev';

      // Define both source URLs dynamically at runtime, matching original query parameter order
      const url1 = buildProxyUrl(baseUrl, rsskey, '5', ttl);
      const url2 = buildProxyUrl(baseUrl, rsskey, '1', ttl);

      console.log('Fetching source feeds...');
      
      const headers = {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      };

      console.log('Fetching using public internet fetch...');
      const [res1, res2] = await Promise.all([
        fetch(url1, { headers }),
        fetch(url2, { headers })
      ]);

      if (!res1.ok) {
        throw new Error(`Failed to fetch Feed 1 (sta5). Status: ${res1.status} ${res1.statusText}`);
      }
      if (!res2.ok) {
        throw new Error(`Failed to fetch Feed 2 (sta1). Status: ${res2.status} ${res2.statusText}`);
      }

      const [xmlText1, xmlText2] = await Promise.all([
        res1.text(),
        res2.text()
      ]);

      console.log('Parsing feeds...');
      const feed1 = parseFeed(xmlText1);
      const feed2 = parseFeed(xmlText2);

      console.log('Merging and sorting feeds...');
      const mergedFeed = mergeFeeds([feed1, feed2]);

      console.log('Rebuilding merged RSS XML...');
      const mergedXml = buildRssXml(mergedFeed);

      const response = new Response(mergedXml, {
        headers: {
          'Content-Type': 'application/xml; charset=utf-8',
          'Cache-Control': `public, max-age=${ttl}`
        }
      });

      // Store response in cache (only for GET requests in environments where cache is available)
      if (cache && isGet) {
        ctx.waitUntil(cache.put(request, response.clone()));
      }

      return response;

    } catch (err) {
      console.error('Error during feed merge:', err.message);
      return new Response(
        `Error: Failed to fetch or merge RSS feeds. Details: ${err.message}`,
        {
          status: 500,
          headers: { 'Content-Type': 'text/plain; charset=utf-8' }
        }
      );
    }
  }
};
