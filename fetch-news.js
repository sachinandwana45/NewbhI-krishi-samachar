// fetch-news.js - BH Krishi Samachar

const https = require('https');
const fs = require('fs');

function fetchURL(url) {
  return new Promise((resolve) => {
    const req = https.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; NewsBot/1.0)',
        'Accept': 'application/rss+xml, text/xml, */*'
      },
      timeout: 15000
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve(data));
    });
    req.on('error', () => resolve(''));
    req.on('timeout', () => { req.destroy(); resolve(''); });
  });
}

function parseItems(xml) {
  const items = [];
  const regex = /<item>([\s\S]*?)<\/item>/g;
  let match;
  while ((match = regex.exec(xml)) !== null) {
    const item = match[1];
    const title = (item.match(/<title><!\[CDATA\[(.*?)\]\]><\/title>/) || item.match(/<title>(.*?)<\/title>/))?.[1] || '';
    const link  = (item.match(/<link>(.*?)<\/link>/))?.[1] || '#';
    const desc  = (item.match(/<description><!\[CDATA\[(.*?)\]\]><\/description>/) || item.match(/<description>(.*?)<\/description>/))?.[1] || '';
    const src   = (item.match(/<source[^>]*>(.*?)<\/source>/))?.[1] || 'News';
    const clean = desc.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim().substring(0, 250);
    if (title && title.length > 5) {
      items.push({ title: title.trim(), url: link.trim(), description: clean, source: src.trim(), pubDate: new Date().toISOString(), image: '' });
    }
  }
  return items;
}

const FEEDS = [
  'https://news.google.com/rss/search?q=krishi+kisan+India&hl=hi&gl=IN&ceid=IN:hi',
  'https://news.google.com/rss/search?q=agriculture+farmers+India&hl=en&gl=IN&ceid=IN:en',
  'https://news.google.com/rss/search?q=MSP+mandi+fasal&hl=hi&gl=IN&ceid=IN:hi',
  'https://news.google.com/rss/search?q=kisan+yojana+subsidy+India&hl=hi&gl=IN&ceid=IN:hi',
];

async function main() {
  console.log('Fetching news...', new Date().toISOString());
  const all = [];
  for (const feed of FEEDS) {
    try {
      const xml = await fetchURL(feed);
      if (xml) all.push(...parseItems(xml));
    } catch(e) { console.log('Feed error:', e.message); }
    await new Promise(r => setTimeout(r, 500));
  }
  const seen = new Set();
  const unique = all.filter(a => {
    const k = a.title.substring(0, 40).toLowerCase();
    if (seen.has(k)) return false;
    seen.add(k); return true;
  }).slice(0, 15);
  
  const out = { updated: new Date().toISOString(), count: unique.length, articles: unique };
  fs.writeFileSync('news.json', JSON.stringify(out, null, 2));
  console.log('Done! Saved', unique.length, 'articles');
}

main().catch(e => { console.error('Error:', e.message); process.exit(1); });
