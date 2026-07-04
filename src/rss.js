import { XMLParser } from 'fast-xml-parser';

// Escape unsafe XML characters for plain text or attribute fields
export function escapeXml(unsafe) {
  if (unsafe === undefined || unsafe === null) return '';
  return String(unsafe).replace(/[<>&'"]/g, (c) => {
    switch (c) {
      case '<': return '&lt;';
      case '>': return '&gt;';
      case '&': return '&amp;';
      case '\'': return '&apos;';
      case '"': return '&quot;';
      default: return c;
    }
  });
}

// Helper to safely extract string text from a parsed XML node which might be an object
function getText(node) {
  if (node === undefined || node === null) return '';
  if (typeof node === 'object') {
    return node['#text'] || node['__cdata'] || '';
  }
  return String(node);
}

// Generate a deduplication key for an RSS item
function getItemKey(item) {
  if (item.guid) {
    return getText(item.guid);
  }
  if (item.link) {
    return getText(item.link);
  }
  return getText(item.title);
}

// Parses a single raw XML feed string into structured data
export function parseFeed(xmlText) {
  const parser = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: '@_',
    parseAttributeValue: false,
    isArray: (name) => name === 'item',
  });

  const parsed = parser.parse(xmlText);
  if (!parsed.rss || !parsed.rss.channel) {
    throw new Error('Invalid RSS feed format');
  }

  const channel = parsed.rss.channel;
  const items = channel.item || [];
  
  return {
    title: getText(channel.title),
    link: getText(channel.link),
    description: getText(channel.description),
    language: getText(channel.language),
    copyright: getText(channel.copyright),
    managingEditor: getText(channel.managingEditor),
    webMaster: getText(channel.webMaster),
    image: channel.image,
    items,
  };
}

// Merges multiple parsed feeds, deduplicating and sorting their items
export function mergeFeeds(feeds) {
  if (feeds.length === 0) {
    throw new Error('No feeds to merge');
  }

  // Use metadata of the first feed as template
  const baseFeed = feeds[0];
  
  // Combine all items
  const allItems = feeds.flatMap(feed => feed.items);

  // Deduplicate items
  const seen = new Set();
  const uniqueItems = [];
  for (const item of allItems) {
    const key = getItemKey(item);
    if (key && !seen.has(key)) {
      seen.add(key);
      uniqueItems.push(item);
    }
  }

  // Sort items by pubDate descending (newest first)
  uniqueItems.sort((a, b) => {
    const dateA = a.pubDate ? Date.parse(getText(a.pubDate)) : 0;
    const dateB = b.pubDate ? Date.parse(getText(b.pubDate)) : 0;
    return dateB - dateA;
  });

  return {
    ...baseFeed,
    items: uniqueItems,
  };
}

// Rebuilds the final merged feed back to XML string
export function buildRssXml(mergedFeed) {
  const channelTitle = escapeXml(mergedFeed.title || 'Audiences Torrents');
  const channelLink = escapeXml(mergedFeed.link || 'https://audiences.me');
  const channelDesc = escapeXml(mergedFeed.description || 'Latest torrents from Audiences');
  const channelLang = escapeXml(mergedFeed.language || 'zh-cn');
  const channelCopyright = escapeXml(mergedFeed.copyright || '');
  const channelEditor = escapeXml(mergedFeed.managingEditor || '');
  const channelWebmaster = escapeXml(mergedFeed.webMaster || '');
  const pubDate = new Date().toUTCString();

  let imageXml = '';
  if (mergedFeed.image) {
    const imgUrl = escapeXml(getText(mergedFeed.image.url));
    const imgTitle = escapeXml(getText(mergedFeed.image.title));
    const imgLink = escapeXml(getText(mergedFeed.image.link));
    const imgWidth = mergedFeed.image.width ? `\n			<width>${escapeXml(getText(mergedFeed.image.width))}</width>` : '';
    const imgHeight = mergedFeed.image.height ? `\n			<height>${escapeXml(getText(mergedFeed.image.height))}</height>` : '';
    const imgDesc = mergedFeed.image.description ? `\n			<description>${escapeXml(getText(mergedFeed.image.description))}</description>` : '';
    imageXml = `
		<image>
			<url><![CDATA[${imgUrl}]]></url>
			<title>${imgTitle}</title>
			<link><![CDATA[${imgLink}]]></link>${imgWidth}${imgHeight}${imgDesc}
		</image>`;
  }

  const itemsXml = mergedFeed.items.map(item => {
    const title = getText(item.title);
    const link = getText(item.link);
    const desc = getText(item.description);
    const author = getText(item.author);
    const comments = getText(item.comments);
    const pubDate = getText(item.pubDate);

    let catXml = '';
    if (item.category) {
      if (typeof item.category === 'object') {
        const domainAttr = item.category['@_domain'] ? ` domain="${escapeXml(item.category['@_domain'])}"` : '';
        const catText = getText(item.category);
        catXml = `\n			<category${domainAttr}>${escapeXml(catText)}</category>`;
      } else {
        catXml = `\n			<category>${escapeXml(item.category)}</category>`;
      }
    }

    let encXml = '';
    if (item.enclosure && typeof item.enclosure === 'object') {
      const url = item.enclosure['@_url'] || '';
      const length = item.enclosure['@_length'] || '';
      const type = item.enclosure['@_type'] || '';
      encXml = `\n			<enclosure url="${escapeXml(url)}" length="${escapeXml(length)}" type="${escapeXml(type)}" />`;
    }

    let guidXml = '';
    if (item.guid) {
      if (typeof item.guid === 'object') {
        const isPermaLink = item.guid['@_isPermaLink'] !== undefined ? ` isPermaLink="${escapeXml(item.guid['@_isPermaLink'])}"` : '';
        const guidText = getText(item.guid);
        guidXml = `\n			<guid${isPermaLink}>${escapeXml(guidText)}</guid>`;
      } else {
        guidXml = `\n			<guid>${escapeXml(item.guid)}</guid>`;
      }
    }

    return `		<item>
			<title><![CDATA[${title}]]></title>
			<link>${escapeXml(link)}</link>
			<description><![CDATA[${desc}]]></description>
			<author>${escapeXml(author)}</author>${catXml}${encXml}${guidXml}
			<comments><![CDATA[${comments}]]></comments>
			<pubDate>${escapeXml(pubDate)}</pubDate>
		</item>`;
  }).join('\n');

  return `<?xml version="1.0" encoding="utf-8"?>
<rss version="2.0">
	<channel>
		<title>${channelTitle}</title>
		<link><![CDATA[${channelLink}]]></link>
		<description><![CDATA[${channelDesc}]]></description>
		<language>${channelLang}</language>
		<copyright>${channelCopyright}</copyright>
		<managingEditor>${channelEditor}</managingEditor>
		<webMaster>${channelWebmaster}</webMaster>
		<pubDate>${pubDate}</pubDate>
		<generator>Antigravity RSS Merger</generator>${imageXml}
${itemsXml}
	</channel>
</rss>`;
}
