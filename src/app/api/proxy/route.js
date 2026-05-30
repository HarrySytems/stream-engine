import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const targetUrl = searchParams.get('url');

  if (!targetUrl) {
    return new Response('URL is required', { status: 400 });
  }

  try {
    const response = await fetch(targetUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Cache-Control': 'no-cache',
        'Pragma': 'no-cache'
      },
      cache: 'no-store',
      next: { revalidate: 0 }
    });

    if (!response.ok) {
      return new Response(`Failed to fetch target: ${response.status}`, { status: response.status });
    }

    const contentType = response.headers.get('content-type') || '';
    
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

      return new Response(rewrittenLines.join('\n'), {
        headers: {
          'Content-Type': 'application/vnd.apple.mpegurl',
          'Access-Control-Allow-Origin': '*',
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache',
          'Expires': '0'
        }
      });
    } else {
      // It is a segment (.ts, etc.) or raw continuous stream, stream it using response.body
      return new Response(response.body, {
        headers: {
          'Content-Type': contentType || 'video/MP2T',
          'Access-Control-Allow-Origin': '*',
          'Cache-Control': 'public, max-age=3600'
        }
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
