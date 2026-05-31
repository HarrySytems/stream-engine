import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const targetUrl = searchParams.get('url');

  if (!targetUrl) {
    return new Response('URL is required', { status: 400 });
  }

  try {
    // Dynamic Referer and Origin spoofing based on stream host to bypass anti-hotlink checks
    const urlObj = new URL(targetUrl);
    const referer = `${urlObj.protocol}//${urlObj.host}/`;
    
    // Cookie forwarding (bi-directional proxying) to maintain session/cookie validation (crucial for Pluto TV, etc.)
    const incomingCookies = request.headers.get('cookie') || '';

    const fetchHeaders = {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Cache-Control': 'no-cache',
      'Pragma': 'no-cache',
      'Referer': referer,
      'Origin': `${urlObj.protocol}//${urlObj.host}`
    };

    if (incomingCookies) {
      fetchHeaders['Cookie'] = incomingCookies;
    }

    const response = await fetch(targetUrl, {
      headers: fetchHeaders,
      cache: 'no-store',
      next: { revalidate: 0 }
    });

    if (!response.ok) {
      return new Response(`Failed to fetch target: ${response.status}`, { status: response.status });
    }

    const contentType = response.headers.get('content-type') || '';
    
    // Extract set-cookie headers from the target response to forward to the client browser
    let responseCookies = [];
    if (typeof response.headers.getSetCookie === 'function') {
      responseCookies = response.headers.getSetCookie();
    } else {
      const setCookieVal = response.headers.get('set-cookie');
      if (setCookieVal) {
        responseCookies = [setCookieVal];
      }
    }

    // Check if it is a playlist (.m3u8 or contains mpegurl type)
    const isM3u8 = targetUrl.toLowerCase().includes('.m3u8') || 
                   contentType.toLowerCase().includes('mpegurl') || 
                   contentType.toLowerCase().includes('application/x-mpegurl') ||
                   contentType.toLowerCase().includes('application/vnd.apple.mpegurl');

    if (isM3u8) {
      const text = await response.text();
      const finalUrl = response.url || targetUrl;
      const baseUrl = new URL(finalUrl);
      
      // Rewrite URLs in m3u8
      const lines = text.split('\n');
      const rewrittenLines = lines.map(line => {
        const trimmed = line.trim();
        if (!trimmed) return line;
        
        // Skip comment lines unless they contain URIs (like keys/licenses)
        if (trimmed.startsWith('#')) {
          return trimmed.replace(/URI="([^"]+)"/g, (match, p1) => {
            const absolute = resolveUrl(p1, baseUrl);
            return `URI="${request.nextUrl.origin}/api/proxy?url=${encodeURIComponent(absolute)}"`;
          });
        }
        
        // Resolve absolute URL and proxy it
        const absolute = resolveUrl(trimmed, baseUrl);
        return `${request.nextUrl.origin}/api/proxy?url=${encodeURIComponent(absolute)}`;
      });

      const resHeaders = new Headers({
        'Content-Type': 'application/vnd.apple.mpegurl',
        'Access-Control-Allow-Origin': '*',
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0'
      });

      // Append cookies to forward them to browser
      if (responseCookies && responseCookies.length > 0) {
        responseCookies.forEach(cookie => {
          resHeaders.append('Set-Cookie', cookie);
        });
      }

      return new Response(rewrittenLines.join('\n'), {
        headers: resHeaders
      });
    } else {
      // It is a segment (.ts, etc.) or raw continuous stream, stream it using response.body
      const resHeaders = new Headers({
        'Content-Type': contentType || 'video/MP2T',
        'Access-Control-Allow-Origin': '*',
        'Cache-Control': 'public, max-age=3600'
      });

      if (responseCookies && responseCookies.length > 0) {
        responseCookies.forEach(cookie => {
          resHeaders.append('Set-Cookie', cookie);
        });
      }

      return new Response(response.body, {
        headers: resHeaders
      });
    }
  } catch (err) {
    console.error("Proxy error:", err);
    return new Response(err.message, { status: 500 });
  }
}

function resolveUrl(urlStr, baseUrl) {
  try {
    const resolved = new URL(urlStr, baseUrl);
    // If the resolved URL does not have query parameters but the baseUrl does,
    // and they share the same host, copy the query parameters.
    if (!resolved.search && baseUrl.search && resolved.host === baseUrl.host) {
      resolved.search = baseUrl.search;
    }
    return resolved.href;
  } catch (e) {
    return urlStr;
  }
}
