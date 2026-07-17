export default {
  async fetch(request) {
    const url = new URL(request.url);
    const path = url.pathname;
    const cors = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'GET, OPTIONS', 'Access-Control-Allow-Headers': '*' };
    if (request.method === 'OPTIONS') return new Response(null, { headers: cors });

    try {
      if (path === '/' || path === '/api') {
        return json({ name: "MyMovies API", version: "3.0.0", description: "Real download URLs via Net9ja", endpoints: {
          search: "/api/search?q=avatar",
          movie: "/api/movie?url=NET9JA_URL",
          series: "/api/series?url=SERIES_URL",
          resolve: "/api/resolve?sdm=SDM_URL",
          stream: "/api/stream?url=CDN_URL",
        }}, cors);
      }

      // ═══ SEARCH ═══
      if (path === '/api/search') {
        const q = url.searchParams.get('q') || '';
        if (!q) return json({ error: "q required" }, cors, 400);
        const resp = await fetch(`https://www.net9ja.tv/?s=${encodeURIComponent(q)}`, {
          headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' }
        });
        const html = await resp.text();
        const results = [];
        const re = /<h3[^>]*class="[^"]*entry-title[^"]*"[^>]*>\s*<a[^>]*href="([^"]+)"[^>]*>([^<]+)<\/a>/g;
        let m;
        while ((m = re.exec(html)) !== null) results.push({ title: m[2].trim(), url: m[1] });
        return json({ success: true, query: q, count: results.length, results }, cors);
      }

      // ═══ RESOLVE SDM → KISSORGRAB ═══
      if (path === '/api/resolve') {
        const sdmUrl = url.searchParams.get('sdm');
        if (!sdmUrl) return json({ error: "sdm parameter required" }, cors, 400);
        
        const decoded = decodeURIComponent(sdmUrl);
        const sdmResp = await fetch(decoded, {
          headers: { 'User-Agent': 'Mozilla/5.0', 'Referer': 'https://www.net9ja.tv/' },
          redirect: 'manual'
        });
        const meetUrl = sdmResp.headers.get('location');
        
        if (!meetUrl) {
          return json({
            success: false, error: "IP blocked. Use sdmUrl from a residential IP.",
            sdmUrl: decoded,
            manualResolve: `curl -sI "${decoded}" -H "User-Agent: Mozilla/5.0" -o /dev/null -w "%{redirect_url}"`
          }, cors);
        }
        
        const meetResp = await fetch(meetUrl, {
          headers: { 'User-Agent': 'Mozilla/5.0', 'Referer': decoded }
        });
        const meetHtml = await meetResp.text();
        const cdnMatch = meetHtml.match(/location\.href\s*=\s*'(https:\/\/[^']+kissorgrab[^']+)'/);
        
        if (!cdnMatch) return json({ error: "CDN URL not found" }, cors, 500);
        
        const cdnUrl = cdnMatch[1].replace(/\\\//g, '/');
        return json({
          success: true,
          download: {
            directUrl: cdnUrl,
            streamUrl: `${url.origin}/api/stream?url=${encodeURIComponent(cdnUrl)}`,
            usage: `curl -H "User-Agent: Mozilla/5.0" -H "Referer: ${meetUrl}" "${cdnUrl}" -o movie.mkv`,
          }
        }, cors);
      }

      // ═══ MOVIE DETAIL ═══
      if (path === '/api/movie') {
        const movieUrl = url.searchParams.get('url');
        if (!movieUrl) return json({ error: "url required" }, cors, 400);
        
        const decoded = decodeURIComponent(movieUrl);
        const resp = await fetch(decoded, {
          headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' }
        });
        const html = await resp.text();
        
        const title = (html.match(/<h1[^>]*class="[^"]*entry-title[^"]*"[^>]*>([^<]+)<\/h1>/) || [])[1] || '';
        const poster = (html.match(/<img[^>]*src="(https:\/\/[^"]*\.(?:jpg|png|webp))"[^>]*>/) || [])[1] || '';
        const desc = (html.match(/<meta[^>]*property="og:description"[^>]*content="([^"]+)"/) || [])[1] || '';
        const rating = (html.match(/class="rmp-avg-rating[^"]*">([^<]+)<\//) || [])[1] || '';
        const votes = (html.match(/class="rmp-vote-count[^"]*">([^<]+)<\//) || [])[1] || '';
        const castMatch = html.match(/Stars:\s*([^<]+)/);
        const cast = castMatch ? castMatch[1].split(',').map(s => s.trim()) : [];
        const genreMatch = html.match(/Genre:\s*([^<]+)/);
        const genres = genreMatch ? genreMatch[1].split(',').map(s => s.trim()) : [];
        const yearMatch = title.match(/\((\d{4})\)/);
        const year = yearMatch ? yearMatch[1] : '';
        const sdmMatch = html.match(/href="(https:\/\/dldownload\.com\.ng\/sdm_downloads\/[^"]+)"/);
        const seriesLink = html.match(/href="(https:\/\/net9jaseries\.com\/[^"]+)"/);
        
        const result = {
          title: title.trim(), poster, description: desc, year,
          rating: rating ? parseFloat(rating) : null, votes: votes ? parseInt(votes) : null,
          cast, genres,
          type: seriesLink ? 'series' : 'movie',
        };

        if (sdmMatch) {
          result.sdmUrl = sdmMatch[1];
          result.resolveEndpoint = `/api/resolve?sdm=${encodeURIComponent(sdmMatch[1])}`;
          result.resolveUsage = `curl "${url.origin}/api/resolve?sdm=${encodeURIComponent(sdmMatch[1])}"`;
          result.resolveNote = "Call the resolve endpoint from a residential IP to get the direct kissorgrab CDN URL.";
        }
        if (seriesLink) result.seriesPage = seriesLink[1];
        
        return json({ success: true, ...result }, cors);
      }

      

      // ═══ SERIES ═══
      if (path === '/api/series') {
        const seriesUrl = url.searchParams.get('url');
        if (!seriesUrl) return json({ error: "url required" }, cors, 400);
        
        const decoded = decodeURIComponent(seriesUrl);
        const resp = await fetch(decoded, {
          headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' }
        });
        const html = await resp.text();
        
        const title = (html.match(/<h1[^>]*class="[^"]*entry-title[^"]*"[^>]*>([^<]+)<\/h1>/) || [])[1] || '';
        const poster = (html.match(/<img[^>]*src="(https:\/\/[^"]*\.(?:jpg|png|webp))"[^>]*>/) || [])[1] || '';
        
        const episodes = [];
        const epRe = /href="(https:\/\/wildshare\.net\/[^"]+)"[^>]*>Episode\s*(\d+)<\/a>/gi;
        let em;
        while ((em = epRe.exec(html)) !== null) {
          episodes.push({
            episode: parseInt(em[2]),
            downloadUrl: em[1],
            note: 'Open in browser to download. Click Download button.'
          });
        }
        
        return json({ success: true, title: title.trim(), poster, episodes }, cors);
      }

      // ═══ STREAM PROXY ═══
      if (path === '/api/stream') {
        const videoUrl = url.searchParams.get('url');
        if (!videoUrl) return json({ error: "url required" }, cors, 400);
        const decoded = decodeURIComponent(videoUrl);
        const resp = await fetch(decoded, {
          headers: { 'User-Agent': 'Mozilla/5.0', 'Referer': 'https://meetdownload.com/' }
        });
        if (!resp.ok) return new Response('Stream unavailable', { status: 404 });
        return new Response(resp.body, {
          headers: {
            'Content-Type': resp.headers.get('content-type') || 'video/x-matroska',
            'Accept-Ranges': 'bytes', 'Access-Control-Allow-Origin': '*', 'Cache-Control': 'public, max-age=3600',
          }
        });
      }

      return json({ error: "Not found" }, cors, 404);
    } catch (err) {
      return json({ error: err.message }, cors, 500);
    }
  }
};

function json(data, cors, status = 200) {
  return new Response(JSON.stringify(data, null, 2), { status, headers: { 'Content-Type': 'application/json', ...cors } });
}
