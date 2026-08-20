import fs from 'fs';
import path from 'path';
import StreamPage from './StreamPage';

export const dynamic = 'force-dynamic';

export default async function Home() {
  let peliculas = [];
  let initialPeliculas = [];
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

  // Película destacada
  const featuredId = 'movie-157336';
  const featured = peliculas.find(p => p.id === featuredId) || peliculas[0] || null;
  if (featured) initialPeliculas.push(featured);

  // Helper para agregar contenido seguro por género
  const addFiltered = (filterFn, limit = 20) => {
    let count = 0;
    for (const p of peliculas) {
      if (filterFn(p)) {
        if (!initialPeliculas.some(x => x.id === p.id)) {
          initialPeliculas.push(p);
          count++;
          if (count >= limit) break;
        }
      }
    }
  };

  // Categorías principales ordenadas al estilo Pluto TV / FAST
  addFiltered(p => p.tipo === 'pelicula' && (p.categoria === 'Acción' || p.categoria === 'Aventura'), 24);
  addFiltered(p => p.tipo === 'pelicula' && p.categoria === 'Ciencia Ficción', 24);
  addFiltered(p => p.tipo === 'pelicula' && (p.categoria === 'Terror' || p.categoria === 'Suspenso'), 24);
  addFiltered(p => p.tipo === 'pelicula' && p.categoria === 'Comedia', 24);
  addFiltered(p => p.tipo === 'pelicula' && p.categoria === 'Drama', 24);
  addFiltered(p => p.tipo === 'pelicula' && (p.categoria === 'Infantil' || p.categoria === 'Animación' || p.categoria === 'Familiar'), 24);
  addFiltered(p => p.tipo === 'serie' && p.categoria !== 'Anime' && p.categoria !== 'Documentales', 24);
  addFiltered(p => p.tipo === 'pelicula' && p.categoria === 'Anime', 24);
  addFiltered(p => p.tipo === 'pelicula' && (parseInt(p.año) < 2000 || p.categoria === 'Clásicos'), 20);

  return (
    <StreamPage 
      initialPeliculas={initialPeliculas} 
      allPeliculas={peliculas}
      initialCanales={canales} 
    />
  );
}
