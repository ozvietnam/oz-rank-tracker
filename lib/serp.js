// Shared SerpAPI lookup: returns the organic Google Vietnam rank of TARGET_DOMAIN
// for a query, or 101 when not found in the top 100.
export async function lookupRank(query, apiKey, targetDomain) {
  const params = new URLSearchParams({
    engine: 'google', q: query, location: 'Vietnam',
    hl: 'vi', gl: 'vn', num: '100', api_key: apiKey,
  });
  const res = await fetch('https://serpapi.com/search.json?' + params);
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || 'HTTP ' + res.status);
  const organic = data.organic_results || [];
  for (const o of organic) {
    const link = o.link || o.url || '';
    if (link.includes(targetDomain)) return { rank: o.position, foundUrl: link };
  }
  return { rank: 101, foundUrl: null };
}
