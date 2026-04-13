const https = require('https');
const fs = require('fs');

function get(url) {
  return new Promise((resolve) => {
    https.get(url, {
      headers: {'User-Agent': 'Mozilla/5.0', 'Accept': 'text/xml,application/xml,*/*'},
      timeout: 20000
    }, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        return get(res.headers.location).then(resolve);
      }
      let d = '';
      res.on('data', c => d += c);
      res.on('end', () => resolve(d));
    }).on('error', () => resolve('')).on('timeout', function(){ this.destroy(); resolve(''); });
  });
}

function parse(xml) {
  const out = [];
  const re = /<item>([\s\S]*?)<\/item>/g;
  let m;
  while ((m = re.exec(xml)) !== null) {
    const x = m[1];
    const t = (x.match(/<title><!\[CDATA\[(.*?)\]\]>/) || x.match(/<title>([^<]*)</))?.[1]?.trim() || '';
    const l = (x.match(/<link>([^<]+)</))?.[1]?.trim() || '#';
    const d = (x.match(/<description><!\[CDATA\[(.*?)\]\]>/) || x.match(/<description>([^<]*)</))?.[1]?.trim() || '';
    const s = (x.match(/<source[^>]*>([^<]*)</))?.[1]?.trim() || 'News';
    const clean = d.replace(/<[^>]*>/g,'').replace(/&amp;/g,'&').replace(/&lt;/g,'<').replace(/&gt;/g,'>').trim().slice(0,200);
    if (t.length > 5) out.push({title:t, url:l, description:clean, source:s, pubDate:new Date().toISOString(), image:''});
  }
  return out;
}

const FEEDS = [
  'https://news.google.com/rss/search?q=kisan+krishi+India&hl=hi&gl=IN&ceid=IN:hi',
  'https://news.google.com/rss/search?q=agriculture+India+farmers&hl=en&gl=IN&ceid=IN:en',
  'https://news.google.com/rss/search?q=MSP+fasal+mandi&hl=hi&gl=IN&ceid=IN:hi',
  'https://news.google.com/rss/search?q=PM+kisan+yojana&hl=hi&gl=IN&ceid=IN:hi',
];

(async () => {
  const all = [];
  for (const f of FEEDS) {
    try {
      const xml = await get(f);
      if (xml && xml.includes('<item>')) {
        all.push(...parse(xml));
        console.log('Feed OK, items:', parse(xml).length);
      } else {
        console.log('Feed empty or error:', f.slice(0,50));
      }
    } catch(e) { console.log('Error:', e.message); }
    await new Promise(r => setTimeout(r, 1000));
  }
  const seen = new Set();
  const unique = all.filter(a => {
    const k = a.title.slice(0,40).toLowerCase();
    if(seen.has(k)) return false;
    seen.add(k); return true;
  }).slice(0,15);
  
  if (unique.length === 0) {
    console.log('No articles found - saving empty');
    fs.writeFileSync('news.json', JSON.stringify({updated:new Date().toISOString(),count:0,articles:[]},null,2));
  } else {
    fs.writeFileSync('news.json', JSON.stringify({updated:new Date().toISOString(),count:unique.length,articles:unique},null,2));
    console.log('Saved', unique.length, 'articles!');
  }
})();
