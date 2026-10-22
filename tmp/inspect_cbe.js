async function inspect() {
  const res = await fetch('https://mbreciept.cbe.com.et/_nuxt/D7WMxg0z.js');
  const text = await res.text();
  console.log('D7WMxg0z Length:', text.length);
  const urls = text.match(/(https?:\/\/[^\s"'`]+|\/api\/[^\s"'`]+|\/[a-zA-Z0-9_\-\/]+)/g) || [];
  const uniqueUrls = [...new Set(urls)].filter(u => u.includes('receipt') || u.includes('v2') || u.includes('cbe') || u.includes('api') || u.includes('http'));
  console.log('Unique URLs/Paths:', uniqueUrls);

  // Look for any fetch / $fetch / axios calls
  const fetchMatches = text.match(/(?:fetch|\$fetch|axios|get|post)\s*\([^)]+\)/g) || [];
  console.log('Fetch calls:', fetchMatches.slice(0, 10));

  // Look for property names or JSON keys
  const keys = text.match(/"[a-zA-Z0-9_]{3,30}"\s*:/g) || [];
  console.log('JSON Keys:', [...new Set(keys)].slice(0, 40));
}
inspect().catch(console.error);
