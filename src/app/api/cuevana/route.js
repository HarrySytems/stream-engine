import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const action = searchParams.get('action');

  if (!action) {
    return NextResponse.json({ error: 'Action is required' }, { status: 400 });
  }

  try {
    let targetUrl = '';
    
    if (action === 'search') {
      const q = searchParams.get('q');
      const postType = searchParams.get('postType') || 'any';
      if (!q) {
        return NextResponse.json({ error: 'Query is required' }, { status: 400 });
      }
      targetUrl = `https://cuevana.gs/wp-api/v1/search?q=${encodeURIComponent(q)}&postType=${encodeURIComponent(postType)}`;
    } else if (action === 'player') {
      const postId = searchParams.get('postId');
      const season = searchParams.get('season');
      const episode = searchParams.get('episode');
      if (!postId) {
        return NextResponse.json({ error: 'PostId is required' }, { status: 400 });
      }
      targetUrl = `https://cuevana.gs/wp-api/v1/player?postId=${postId}&demo=0`;
      if (season) targetUrl += `&season=${season}`;
      if (episode) targetUrl += `&episode=${episode}`;
    } else if (action === 'episodes') {
      const postId = searchParams.get('postId');
      if (!postId) {
        return NextResponse.json({ error: 'PostId is required' }, { status: 400 });
      }
      targetUrl = `https://cuevana.gs/wp-json/wpf/v1/episodes?post_id=${postId}`;
    } else {
      return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    }

    const res = await fetch(targetUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Referer': 'https://cuevana.gs/'
      },
      next: { revalidate: 0 }
    });

    if (!res.ok) {
      return NextResponse.json({ error: `Failed to fetch from Cuevana API: ${res.status}` }, { status: 502 });
    }

    const data = await res.json();
    return NextResponse.json(data);
  } catch (err) {
    console.error("Error in Cuevana proxy route:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
