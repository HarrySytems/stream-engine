import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id') || '';
    const tmdbId = searchParams.get('tmdbId') || '';
    const title = searchParams.get('title') || 'video';
    const type = searchParams.get('type') || 'movie'; // movie | tv
    const season = searchParams.get('season') || '1';
    const episode = searchParams.get('episode') || '1';

    // Normalizar nombre de archivo seguro
    const safeTitle = (title || 'FilmTV_Descarga')
      .replace(/[^a-zA-Z0-9_\-\s]/g, '')
      .trim()
      .replace(/\s+/g, '_');

    const fileName = type === 'tv'
      ? `${safeTitle}_S${String(season).padStart(2, '0')}E${String(episode).padStart(2, '0')}.mp4`
      : `${safeTitle}.mp4`;

    let downloadUrl = '';

    if (tmdbId) {
      if (type === 'tv') {
        downloadUrl = `https://vidsrc.to/embed/tv/${tmdbId}/${season}/${episode}`;
      } else {
        downloadUrl = `https://vidsrc.to/embed/movie/${tmdbId}`;
      }
    } else if (id) {
      downloadUrl = `https://vidsrc.to/embed/movie/${id}`;
    }

    if (!downloadUrl) {
      return NextResponse.json(
        { error: 'Parámetros insuficientes para procesar la descarga' },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      fileName,
      downloadUrl,
      type,
      season: type === 'tv' ? season : null,
      episode: type === 'tv' ? episode : null,
      qualityOptions: [
        { label: 'Full HD 1080p', url: downloadUrl, quality: '1080p' },
        { label: 'HD 720p', url: downloadUrl, quality: '720p' },
        { label: 'Estándar 480p', url: downloadUrl, quality: '480p' }
      ]
    });
  } catch (error) {
    console.error('Error en /api/download:', error);
    return NextResponse.json(
      { error: 'No se pudo generar el enlace de descarga' },
      { status: 500 }
    );
  }
}
