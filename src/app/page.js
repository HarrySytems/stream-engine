import fs from 'fs';
import path from 'path';
import StreamPage from './StreamPage';

export const dynamic = 'force-dynamic';

export default async function Home() {
  let initialPeliculas = [];
  let canales = [];

  try {
    const filePeliculasPath = path.join(process.cwd(), 'peliculas.json');
    const filePeliculasData = fs.readFileSync(filePeliculasPath, 'utf-8');
    const peliculas = JSON.parse(filePeliculasData);

    const featuredId = 'movie-157336';
    
    // Agregar película destacada
    const featured = peliculas.find(p => p.id === featuredId) || peliculas[0];
    if (featured) initialPeliculas.push(featured);

    // Helper para agregar ítems filtrados de forma segura
    const addFiltered = (filterFn, limit = 15) => {
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

    // Llenar categorías para la pantalla principal (Inicio)
    addFiltered(p => p.tipo === 'pelicula' && p.categoria === 'Acción');
    addFiltered(p => p.tipo === 'pelicula' && p.categoria === 'Ciencia Ficción');
    addFiltered(p => p.tipo === 'pelicula' && p.categoria === 'Terror');
    addFiltered(p => p.tipo === 'pelicula' && p.categoria === 'Comedia');
    addFiltered(p => p.tipo === 'pelicula' && p.categoria === 'Drama');
    addFiltered(p => p.tipo === 'pelicula' && p.categoria === 'Infantil');
    addFiltered(p => p.tipo === 'serie' && p.categoria !== 'Anime' && p.categoria !== 'Documentales');
    addFiltered(p => p.tipo === 'pelicula' && p.categoria !== 'Anime' && p.categoria !== 'Documentales' && p.categoria !== 'YouTube' && parseInt(p.año) >= 2020);
    addFiltered(p => p.tipo === 'serie' && p.categoria !== 'Anime' && p.categoria !== 'Documentales' && p.categoria !== 'YouTube' && parseInt(p.año) >= 2020);

  } catch (error) {
    console.error("Error reading or filtering peliculas.json:", error);
  }

  try {
    const fileCanalesPath = path.join(process.cwd(), 'canales.json');
    const fileCanalesData = fs.readFileSync(fileCanalesPath, 'utf-8');
    canales = JSON.parse(fileCanalesData);
  } catch (error) {
    console.error("Error reading canales.json:", error);
  }

  return <StreamPage initialPeliculas={initialPeliculas} initialCanales={canales} />;
}
