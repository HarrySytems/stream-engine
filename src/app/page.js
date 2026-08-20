import fs from 'fs';
import path from 'path';
import StreamPage from './StreamPage';

// Regeneración estática incremental / Caché CDN de Vercel para velocidad instantánea
export const revalidate = 3600;

export default async function Home() {
  let peliculas = [];
  let canales = [];

  try {
    const filePeliculasPath = path.join(process.cwd(), 'peliculas.json');
    if (fs.existsSync(filePeliculasPath)) {
      const filePeliculasData = fs.readFileSync(filePeliculasPath, 'utf-8');
      peliculas = JSON.parse(filePeliculasData);
    }
  } catch (error) {
    console.error("Error reading peliculas.json:", error);
  }

  try {
    const fileCanalesPath = path.join(process.cwd(), 'canales.json');
    if (fs.existsSync(fileCanalesPath)) {
      const fileCanalesData = fs.readFileSync(fileCanalesPath, 'utf-8');
      canales = JSON.parse(fileCanalesData);
    }
  } catch (error) {
    console.error("Error reading canales.json:", error);
  }

  // Helper para extraer colecciones limpias y ultraligeras (< 50 KB en vez de 10 MB)
  const getSlice = (filterFn, limit = 24) => {
    const result = [];
    for (const p of peliculas) {
      if (filterFn(p)) {
        result.push({
          id: p.id,
          titulo: p.titulo || p.nombre || '',
          nombre: p.nombre || p.titulo || '',
          poster: p.poster || '',
          banner: p.banner || p.poster || '',
          año: p.año || '',
          categoria: p.categoria || '',
          tipo: p.tipo || 'pelicula',
          valoracion: p.valoracion || '7.5',
          sinopsis: p.sinopsis || '',
          tmdbId: p.tmdbId || ''
        });
        if (result.length >= limit) break;
      }
    }
    return result;
  };

  // Pre-agrupación optimizada
  const groupedData = {
    featured: peliculas.find(p => p.id === 'movie-157336') || peliculas[0] || null,
    estrenos: getSlice(p => p.tipo === 'pelicula' && parseInt(p.año) >= 2023, 24),
    accion: getSlice(p => p.tipo === 'pelicula' && (p.categoria === 'Acción' || p.categoria === 'Aventura'), 24),
    scifi: getSlice(p => p.tipo === 'pelicula' && p.categoria === 'Ciencia Ficción', 24),
    terror: getSlice(p => p.tipo === 'pelicula' && (p.categoria === 'Terror' || p.categoria === 'Suspenso'), 24),
    comedia: getSlice(p => p.tipo === 'pelicula' && p.categoria === 'Comedia', 24),
    drama: getSlice(p => p.tipo === 'pelicula' && p.categoria === 'Drama', 24),
    infantil: getSlice(p => p.tipo === 'pelicula' && (p.categoria === 'Infantil' || p.categoria === 'Animación'), 24),
    clasicos: getSlice(p => p.tipo === 'pelicula' && parseInt(p.año) < 2005, 24),
    series: getSlice(p => p.tipo === 'serie' && p.categoria !== 'Anime', 30),
    anime: getSlice(p => p.categoria === 'Anime' || p.tipo === 'anime', 30),
  };

  const cleanCanales = canales.map(c => ({
    id: c.id,
    nombre: c.nombre || c.titulo || 'Canal',
    url: c.url || '',
    logo: c.logo || '',
    categoria: c.categoria || 'General',
    pais: c.pais || '',
    tipo: 'canal'
  }));

  return (
    <StreamPage 
      groupedData={groupedData} 
      canalesData={cleanCanales} 
    />
  );
}
