import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

const USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const action = searchParams.get('action');

  if (!action) {
    return NextResponse.json({ error: 'Action is required' }, { status: 400 });
  }

  try {
    if (action === 'search') {
      const q = searchParams.get('q');
      if (!q) {
        return NextResponse.json({ error: 'Query is required' }, { status: 400 });
      }

      const url = `https://tioanime.com/directorio?search=${encodeURIComponent(q)}`;
      const res = await fetch(url, {
        headers: { 'User-Agent': USER_AGENT }
      });

      if (!res.ok) {
        return NextResponse.json({ error: `TioAnime returned ${res.status}` }, { status: 502 });
      }

      const html = await res.text();
      const results = [];

      const regex = /<article class="anime">[\s\S]*?<a href="\/anime\/([^"]+)">[\s\S]*?<img src="([^"]+)"[\s\S]*?<h3 class="title">([^<]+)<\/h3>/g;
      let match;
      while ((match = regex.exec(html)) !== null) {
        results.push({
          slug: match[1],
          image: `https://tioanime.com${match[2]}`,
          title: match[3].trim()
        });
      }

      return NextResponse.json({ results });

    } else if (action === 'episodes') {
      const slug = searchParams.get('slug');
      if (!slug) {
        return NextResponse.json({ error: 'Slug is required' }, { status: 400 });
      }

      const url = `https://tioanime.com/anime/${slug}`;
      const res = await fetch(url, {
        headers: { 'User-Agent': USER_AGENT }
      });

      if (!res.ok) {
        return NextResponse.json({ error: `TioAnime returned ${res.status}` }, { status: 502 });
      }

      const html = await res.text();

      const match = html.match(/episodes\s*=\s*(\[[^\]]*\])/);
      let episodes = [];
      if (match) {
        try {
          const arr = JSON.parse(match[1]);
          episodes = arr.map(num => ({
            number: num,
            url: `https://tioanime.com/ver/${slug}-${num}`
          })).reverse();
        } catch (e) {
          console.error("Failed to parse episodes JSON", e);
        }
      }

      return NextResponse.json({ episodes });

    } else if (action === 'player') {
      const slug = searchParams.get('slug');
      const episode = searchParams.get('episode');
      if (!slug || !episode) {
        return NextResponse.json({ error: 'Slug and episode are required' }, { status: 400 });
      }

      const url = `https://tioanime.com/ver/${slug}-${episode}`;
      const res = await fetch(url, {
        headers: { 'User-Agent': USER_AGENT }
      });

      if (!res.ok) {
        return NextResponse.json({ error: `TioAnime returned ${res.status}` }, { status: 502 });
      }

      const html = await res.text();

      const match = html.match(/videos\s*=\s*(\[[\s\S]*?\]);/);
      const embeds = [];
      if (match) {
        try {
          const jsonStr = match[1].replace(/'/g, '"');
          const arr = JSON.parse(jsonStr);
          for (const item of arr) {
            if (Array.isArray(item) && item.length >= 2) {
              embeds.push({
                server: item[0],
                url: item[1].replace(/\\\//g, '/')
              });
            }
          }
        } catch (e) {
          const regexVideos = /\["([^"]+)","([^"]+)"\]/g;
          let m;
          while ((m = regexVideos.exec(match[1])) !== null) {
            embeds.push({
              server: m[1],
              url: m[2].replace(/\\\//g, '/')
            });
          }
        }
      }

      return NextResponse.json({ embeds });
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
  } catch (err) {
    console.error("Error in TioAnime route:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
