import { parseFeed, mergeFeeds, buildRssXml } from './rss.js';

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

      // Encode the key for safety inside nested query strings
      const encodedKey = encodeURIComponent(rsskey);

      // Define the base URL for the stale-cache proxy
      const baseUrl = env.PROXY_BASE_URL || 'https://stale-cache.crzidea.workers.dev';

      // Define both source URLs with the supplied rsskey
      const url1 = `${baseUrl}/?regex=%5E%5C%3C&ttl=120&url=https%3A%2F%2Faudiences.me%2Ftorrentrss.php%3Frows%3D50%26cat401%3D1%26cat402%3D1%26med10%3D1%26sta5%3D1%26tea19%3D1%26tea21%3D1%26tea20%3D1%26torrent_type%3D0%26rsskey%3D${encodedKey}`;
      const url2 = `${baseUrl}/?regex=%5E%5C%3C&ttl=120&url=https%3A%2F%2Faudiences.me%2Ftorrentrss.php%3Frows%3D50%26cat401%3D1%26cat402%3D1%26med10%3D1%26sta1%3D1%26tea19%3D1%26tea21%3D1%26tea20%3D1%26torrent_type%3D0%26rsskey%3D${encodedKey}`;

      console.log('Fetching source feeds...');
      
      const headers = {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      };

      let res1, res2;
      if (env.STALE_CACHE) {
        console.log('Fetching using Service Binding (STALE_CACHE)...');
        [res1, res2] = await Promise.all([
          env.STALE_CACHE.fetch(new Request(url1, { headers })),
          env.STALE_CACHE.fetch(new Request(url2, { headers }))
        ]);
      } else {
        console.log('Fetching using public internet fetch...');
        [res1, res2] = await Promise.all([
          fetch(url1, { headers }),
          fetch(url2, { headers })
        ]);
      }

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

      return new Response(mergedXml, {
        headers: {
          'Content-Type': 'application/xml; charset=utf-8',
          'Cache-Control': 'public, max-age=120'
        }
      });

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
