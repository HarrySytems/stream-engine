import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const targetUrl = searchParams.get('url');

  if (!targetUrl) {
    return NextResponse.json({ error: 'URL is required' }, { status: 400 });
  }

  try {
    const res = await fetch(targetUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Referer': 'https://pltvhd.com/'
      },
      next: { revalidate: 0 }
    });

    if (!res.ok) {
      return NextResponse.json({ error: `Failed to fetch target URL: ${res.status}` }, { status: 502 });
    }

    const html = await res.text();

    // Pattern 1: playbackURL = "..." or playbackURL = '...'
    const matchPlayback = html.match(/playbackURL\s*=\s*['"]([^'"]+)['"]/);
    if (matchPlayback && matchPlayback[1]) {
      return NextResponse.json({ playbackURL: matchPlayback[1] });
    }

    // Pattern 2: source: "..."
    const matchSource = html.match(/source\s*:\s*['"]([^'"]+)['"]/);
    if (matchSource && matchSource[1]) {
      return NextResponse.json({ playbackURL: matchSource[1] });
    }

    // Pattern 3: file: "..."
    const matchFile = html.match(/file\s*:\s*['"]([^'"]+)['"]/);
    if (matchFile && matchFile[1]) {
      return NextResponse.json({ playbackURL: matchFile[1] });
    }

    // Pattern 4: any http/https URL ending in .m3u8 inside script
    const matchM3u8 = html.match(/(https?:\/\/[^'"\s>]+\.m3u8[^\'"\s>]*)/);
    if (matchM3u8 && matchM3u8[1]) {
      return NextResponse.json({ playbackURL: matchM3u8[1] });
    }

    return NextResponse.json({ error: 'No streaming URL found on the target page' }, { status: 404 });
  } catch (err) {
    console.error("Error resolving stream URL:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
