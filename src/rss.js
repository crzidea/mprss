import { XMLParser, XMLBuilder } from 'fast-xml-parser';

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

// Rebuilds the final merged feed back to XML string using XMLBuilder
export function buildRssXml(mergedFeed) {
  const channel = {
    title: mergedFeed.title || 'Audiences Torrents',
    link: { '__cdata': mergedFeed.link || 'https://audiences.me' },
    description: { '__cdata': mergedFeed.description || 'Latest torrents from Audiences' },
    language: mergedFeed.language || 'zh-cn',
    copyright: mergedFeed.copyright || '',
    pubDate: new Date().toUTCString(),
    generator: 'Antigravity RSS Merger',
  };

  if (mergedFeed.managingEditor) {
    channel.managingEditor = mergedFeed.managingEditor;
  }
  if (mergedFeed.webMaster) {
    channel.webMaster = mergedFeed.webMaster;
  }

  if (mergedFeed.image) {
    channel.image = {
      url: { '__cdata': getText(mergedFeed.image.url) },
      title: getText(mergedFeed.image.title),
      link: { '__cdata': getText(mergedFeed.image.link) }
    };
    if (mergedFeed.image.width) {
      channel.image.width = getText(mergedFeed.image.width);
    }
    if (mergedFeed.image.height) {
      channel.image.height = getText(mergedFeed.image.height);
    }
    if (mergedFeed.image.description) {
      channel.image.description = getText(mergedFeed.image.description);
    }
  }

  channel.item = mergedFeed.items.map(item => {
    const itemObj = {
      title: { '__cdata': getText(item.title) },
      link: getText(item.link),
      description: { '__cdata': getText(item.description) },
      author: getText(item.author),
      pubDate: getText(item.pubDate),
    };

    if (item.category) {
      if (typeof item.category === 'object') {
        itemObj.category = {
          '@_domain': item.category['@_domain'],
          '#text': getText(item.category)
        };
      } else {
        itemObj.category = getText(item.category);
      }
    }

    if (item.enclosure && typeof item.enclosure === 'object') {
      itemObj.enclosure = {
        '@_url': item.enclosure['@_url'],
        '@_length': item.enclosure['@_length'],
        '@_type': item.enclosure['@_type']
      };
    }

    if (item.guid) {
      if (typeof item.guid === 'object') {
        itemObj.guid = {
          '@_isPermaLink': item.guid['@_isPermaLink'],
          '#text': getText(item.guid)
        };
      } else {
        itemObj.guid = getText(item.guid);
      }
    }

    if (item.comments) {
      itemObj.comments = { '__cdata': getText(item.comments) };
    }

    return itemObj;
  });

  const builder = new XMLBuilder({
    ignoreAttributes: false,
    attributeNamePrefix: '@_',
    cdataPropName: '__cdata',
    format: true,
  });

  const outputObj = {
    '?xml': {
      '@_version': '1.0',
      '@_encoding': 'utf-8'
    },
    rss: {
      '@_version': '2.0',
      channel: channel
    }
  };

  return builder.build(outputObj);
}
