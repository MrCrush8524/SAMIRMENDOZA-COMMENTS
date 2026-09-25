// Builds the Live TV / X TV channel index off the main thread.
//
// Source-agnostic: each provider adapter turns its raw data into the same
// compact channel shape, so new directories can be added without touching UI:
//   { id, n: name, c: countryCode, k: [categoryIds], l: [languageNames],
//     g: logoURL, u: [streamURLs], lb: [labels], net: network, x: isAdult }
// Streams a browser can never play are dropped here and counted:
//   plain http:// on an https page (mixed content), streams that need a spoofed
//   Referer/User-Agent header, and DASH manifests (no DASH engine is bundled).

const PROVIDERS = {
  "iptv-org": async ({ base, https, progress }) => {
    const files = ["channels", "streams", "logos", "feeds", "countries", "categories", "languages"];
    let done = 0;
    const got = await Promise.all(files.map(f => fetch(`${base}${f}.json`).then(r => {
      if (!r.ok) throw new Error(`${f}.json: HTTP ${r.status}`);
      return r.json();
    }).then(j => { progress(++done / files.length); return j; })));
    const [channels, streams, logos, feeds, countries, categories, languages] = got;

    const chan = new Map(channels.map(c => [c.id, c]));
    const langName = new Map(languages.map(l => [l.code, l.name]));
    const feedLangs = new Map(), mainFeed = new Map();
    for (const f of feeds) {
      feedLangs.set(`${f.channel}@${f.id}`, f.languages || []);
      if (f.is_main) mainFeed.set(f.channel, f.languages || []);
    }
    const logo = new Map();
    for (const l of logos) {                         // prefer channel-level, in-use logos
      const cur = logo.get(l.channel), score = (l.feed == null ? 2 : 0) + (l.in_use ? 1 : 0);
      if (!cur || score > cur.s) logo.set(l.channel, { u: l.url, s: score });
    }

    const out = new Map(); let dropped = 0;
    for (const s of streams) {
      const c = s.channel && chan.get(s.channel);
      if (!c || c.closed) continue;                 // channel-less streams can't be vetted for adult content
      const url = s.url || "";
      if ((https && url.startsWith("http:")) || s.referrer || s.user_agent || /\.mpd(\?|$)/i.test(url)) { dropped++; continue; }
      let e = out.get(c.id);
      if (!e) {
        const langs = (feedLangs.get(`${c.id}@${s.feed}`) || mainFeed.get(c.id) || []).map(x => langName.get(x) || x);
        const cats = (c.categories || []).filter(k => k !== "xxx");
        e = {
          id: c.id, n: c.name, c: c.country || "", k: cats.length ? cats : ["other"], l: [...new Set(langs)].slice(0, 3),
          g: logo.get(c.id)?.u || "", u: [], lb: [], net: c.network || "",
          x: !!c.is_nsfw || (c.categories || []).includes("xxx"),
        };
        out.set(c.id, e);
      }
      if (!e.u.includes(url)) e.u.push(url);
      for (const lb of s.labels || []) if (!e.lb.includes(lb)) e.lb.push(lb);
    }
    const list = [...out.values()];
    return {
      channels: list,
      countries: Object.fromEntries(countries.map(c => [c.code, { name: c.name, flag: c.flag }])),
      categories: Object.fromEntries([...categories.map(c => [c.id, c.name]), ["other", "Other"], ["xxx", "Adult"]]),
      dropped,
    };
  },
};

self.onmessage = async e => {
  const { provider = "iptv-org", base, https } = e.data;
  try {
    const t0 = Date.now();
    const data = await PROVIDERS[provider]({ base, https, progress: p => self.postMessage({ progress: p }) });
    self.postMessage({ ok: true, data: { ...data, provider, at: Date.now(), ms: Date.now() - t0 } });
  } catch (err) {
    self.postMessage({ ok: false, error: String(err && err.message || err) });
  }
};
