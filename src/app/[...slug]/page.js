import fs from 'fs';
import path from 'path';
import StreamPage from '../StreamPage';
import { findItemBySlug, createSlug } from '../../utils/slugify';

export const dynamic = 'force-dynamic';

const VALID_TABS = ['inicio', 'estrenos', 'peliculas', 'series', 'anime', 'manga', 'clasicos', 'tdt', 'free', 'favoritos'];

const MOVIE_CATEGORIES = [
  'Todos',
  'Acción',
  'Terror',
  'Comedia',
  'Ciencia Ficción',
  'Drama',
  'Infantil',
  'Documentales'
];

const ESTRENOS_CATEGORIES = [
  'Todos',
  'Películas',
  'Series',
  'Acción',
  'Terror',
  'Comedia',
  'Ciencia Ficción',
  'Drama',
  'Infantil'
];

function loadData() {
  let peliculas = [];
  let estrenos = [];
  let canales = [];

  try {
    const filePeliculasPath = path.join(process.cwd(), 'peliculas.json');
    const filePeliculasData = fs.readFileSync(filePeliculasPath, 'utf-8');
    peliculas = JSON.parse(filePeliculasData);
  } catch (error) {
    console.error("Error reading peliculas.json in [...slug]:", error);
  }

  try {
    const fileEstrenosPath = path.join(process.cwd(), 'estrenos.json');
    if (fs.existsSync(fileEstrenosPath)) {
      const fileEstrenosData = fs.readFileSync(fileEstrenosPath, 'utf-8');
      estrenos = JSON.parse(fileEstrenosData);
    }
  } catch (error) {
    console.error("Error reading estrenos.json in [...slug]:", error);
  }

  try {
    const fileCanalesPath = path.join(process.cwd(), 'canales.json');
    const fileCanalesData = fs.readFileSync(fileCanalesPath, 'utf-8');
    canales = JSON.parse(fileCanalesData);
  } catch (error) {
    console.error("Error reading canales.json in [...slug]:", error);
  }

  return { peliculas, estrenos, canales };
}

export async function generateMetadata({ params }) {
  const { slug } = params;
  if (!slug || !slug.length) return {};

  const { peliculas, estrenos, canales } = loadData();
  const slugRoute = slug[0].toLowerCase();
  
  // Si tiene 3 partes (ej: /pelicula/terror/nombre-pelicula), el item es la última parte
  const targetSlug = slug[slug.length - 1];

  // Caso: Subcategoría de Estrenos (ej: /estrenos/series o /estrenos/terror)
  if (slugRoute === 'estrenos' && slug.length === 2) {
    const matchedCategory = ESTRENOS_CATEGORIES.find(c => createSlug(c) === createSlug(slug[1]));
    if (matchedCategory) {
      return {
        title: `Estrenos de ${matchedCategory} (2025 - 2026) - FilmTV`,
        description: `Descubre los últimos estrenos de ${matchedCategory} online en streaming gratis en FilmTV.`
      };
    }
  }

  // Caso: Subcategoría de Películas (ej: /peliculas/terror)
  if (slugRoute === 'peliculas' && slug.length === 2) {
    const matchedCategory = MOVIE_CATEGORIES.find(c => createSlug(c) === createSlug(slug[1]));
    if (matchedCategory) {
      return {
        title: `Películas de ${matchedCategory} - FilmTV`,
        description: `Explora las mejores películas de ${matchedCategory} online en español latino y subtitulado en FilmTV.`
      };
    }
  }

  let foundItem = null;

  if (slugRoute === 'canal' || slugRoute === 'tdt') {
    foundItem = findItemBySlug(canales, targetSlug, 'canal');
  } else if (slugRoute === 'estrenos') {
    foundItem = findItemBySlug(estrenos, targetSlug);
  } else if (slugRoute === 'pelicula' || slugRoute === 'peliculas') {
    foundItem = findItemBySlug(estrenos, targetSlug, 'pelicula') || findItemBySlug(peliculas, targetSlug, 'pelicula');
  } else if (slugRoute === 'serie' || slugRoute === 'series') {
    foundItem = findItemBySlug(estrenos, targetSlug, 'serie') || findItemBySlug(peliculas, targetSlug, 'serie');
  } else if (slugRoute === 'anime') {
    foundItem = findItemBySlug(peliculas, targetSlug, 'Anime');
  } else if (slugRoute === 'clasicos') {
    foundItem = findItemBySlug(peliculas, targetSlug, 'Clásicos');
  } else {
    // Buscar en todos
    foundItem = findItemBySlug(estrenos, targetSlug) || findItemBySlug(peliculas, targetSlug) || findItemBySlug(canales, targetSlug);
  }

  if (foundItem) {
    const title = foundItem.nombre || foundItem.titulo || 'FilmTV';
    const year = foundItem.año ? ` (${foundItem.año})` : '';
    const desc = foundItem.descripcion || `Ver ${title} online en streaming gratis en FilmTV.`;
    const image = foundItem.poster || foundItem.logo || '/icon.svg';

    return {
      title: `${title}${year} - FilmTV`,
      description: desc,
      openGraph: {
        title: `${title}${year} - Ver en FilmTV`,
        description: desc,
        images: image ? [{ url: image }] : [],
        type: foundItem.tipo === 'serie' ? 'video.tv_show' : 'video.movie',
      },
      twitter: {
        card: 'summary_large_image',
        title: `${title}${year} - FilmTV`,
        description: desc,
        images: image ? [image] : [],
      }
    };
  }

  if (slugRoute === 'estrenos') {
    return {
      title: '🔥 Estrenos 2025 - 2026 - FilmTV Streaming Gratis',
      description: 'Descubre los últimos estrenos de cine y series 2025 y 2026 en FilmTV. En streaming gratis en español latino.'
    };
  }

  if (VALID_TABS.includes(slugRoute)) {
    const tabName = slugRoute.charAt(0).toUpperCase() + slugRoute.slice(1);
    return {
      title: `${tabName} - FilmTV Streaming Gratis`,
      description: `Explora el catálogo de ${tabName} en FilmTV. Películas, series, animes y canales en vivo.`
    };
  }

  return {
    title: 'FilmTV - Películas, Series y Canales en Streaming Gratis',
    description: 'Disfruta de películas, series, animes y canales de televisión en vivo totalmente gratis.'
  };
}

export default async function SlugPage({ params }) {
  const { slug } = params;
  const { peliculas, estrenos, canales } = loadData();

  let initialActiveItem = null;
  let initialTab = 'inicio';
  let initialMovieCategory = 'Todos';
  let initialEstrenosCategory = 'Todos';

  if (slug && slug.length > 0) {
    const firstPart = slug[0].toLowerCase();
    const secondPart = slug.length > 1 ? slug[1] : null;
    const thirdPart = slug.length > 2 ? slug[2] : null;

    if (VALID_TABS.includes(firstPart) && !secondPart) {
      initialTab = firstPart;
    } else {
      // 1. Caso: /estrenos/categoria o /estrenos/nombre-estreno
      if (firstPart === 'estrenos' && secondPart) {
        const matchedCategory = ESTRENOS_CATEGORIES.find(c => createSlug(c) === createSlug(secondPart));
        if (matchedCategory) {
          initialTab = 'estrenos';
          initialEstrenosCategory = matchedCategory;
          initialActiveItem = null;
        } else {
          initialActiveItem = findItemBySlug(estrenos, secondPart) || findItemBySlug(peliculas, secondPart);
          initialTab = 'estrenos';
        }
      }
      // 2. Caso: /pelicula/terror/nombre-pelicula (3 segmentos)
      else if (firstPart === 'pelicula' && thirdPart) {
        initialActiveItem = findItemBySlug(estrenos, thirdPart, 'pelicula') || findItemBySlug(peliculas, thirdPart, 'pelicula');
        initialTab = 'peliculas';
        if (initialActiveItem && initialActiveItem.categoria) {
          initialMovieCategory = initialActiveItem.categoria;
        }
      } 
      // 3. Caso: /peliculas/terror (2 segmentos de subcategoría)
      else if (firstPart === 'peliculas' && secondPart) {
        const matchedCategory = MOVIE_CATEGORIES.find(c => createSlug(c) === createSlug(secondPart));
        if (matchedCategory) {
          initialTab = 'peliculas';
          initialMovieCategory = matchedCategory;
          initialActiveItem = null;
        } else {
          // Si no era nombre de categoría, buscar si es película directa
          initialActiveItem = findItemBySlug(estrenos, secondPart, 'pelicula') || findItemBySlug(peliculas, secondPart, 'pelicula');
          initialTab = 'peliculas';
        }
      } 
      // 4. Caso: /pelicula/nombre-pelicula (2 segmentos directo)
      else if (firstPart === 'pelicula' && secondPart) {
        initialActiveItem = findItemBySlug(estrenos, secondPart, 'pelicula') || findItemBySlug(peliculas, secondPart, 'pelicula');
        initialTab = 'peliculas';
        if (initialActiveItem && initialActiveItem.categoria) {
          initialMovieCategory = initialActiveItem.categoria;
        }
      } 
      // 5. Caso: /canal/nombre-canal
      else if (firstPart === 'canal' && secondPart) {
        initialActiveItem = findItemBySlug(canales, secondPart, 'canal');
        initialTab = 'tdt';
      } 
      // 6. Caso: /serie/nombre-serie
      else if (firstPart === 'serie' && secondPart) {
        initialActiveItem = findItemBySlug(estrenos, secondPart, 'serie') || findItemBySlug(peliculas, secondPart, 'serie');
        initialTab = 'series';
      } 
      // 7. Caso: /anime/nombre-anime
      else if (firstPart === 'anime' && secondPart) {
        initialActiveItem = findItemBySlug(peliculas, secondPart, 'Anime');
        initialTab = 'anime';
      } 
      // 8. Caso: /clasicos/nombre-clasico
      else if (firstPart === 'clasicos' && secondPart) {
        initialActiveItem = findItemBySlug(peliculas, secondPart, 'Clásicos');
        initialTab = 'clasicos';
      } 
      // 9. Búsqueda genérica
      else {
        const targetSlug = slug[slug.length - 1];
        initialActiveItem = findItemBySlug(estrenos, targetSlug) || findItemBySlug(peliculas, targetSlug) || findItemBySlug(canales, targetSlug);
        if (initialActiveItem) {
          if (initialActiveItem.tipo === 'canal') initialTab = 'tdt';
          else if (initialActiveItem.categoria === 'Anime') initialTab = 'anime';
          else if (initialActiveItem.categoria === 'Clásicos') initialTab = 'clasicos';
          else if (initialActiveItem.tipo === 'serie') initialTab = 'series';
          else initialTab = 'peliculas';
        }
      }
    }
  }

  // Cargar catálogo inicial de películas para alimentar la portada y categorías
  let initialPeliculas = [];
  try {
    if (initialActiveItem && initialActiveItem.tipo !== 'canal') {
      initialPeliculas.push(initialActiveItem);
    }

    const featuredId = 'movie-157336';
    const featured = peliculas.find(p => p.id === featuredId) || peliculas[0];
    if (featured && !initialPeliculas.some(x => x.id === featured.id)) {
      initialPeliculas.push(featured);
    }

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

    addFiltered(p => p.tipo === 'pelicula' && p.categoria === 'Acción');
    addFiltered(p => p.tipo === 'pelicula' && p.categoria === 'Ciencia Ficción');
    addFiltered(p => p.tipo === 'pelicula' && p.categoria === 'Terror');
    addFiltered(p => p.tipo === 'pelicula' && p.categoria === 'Comedia');
    addFiltered(p => p.tipo === 'pelicula' && p.categoria === 'Drama');
    addFiltered(p => p.tipo === 'pelicula' && p.categoria === 'Infantil');
    addFiltered(p => p.tipo === 'serie' && p.categoria !== 'Anime' && p.categoria !== 'Documentales');
    addFiltered(p => p.tipo === 'pelicula' && p.categoria !== 'Anime' && p.categoria !== 'Documentales' && p.categoria !== 'YouTube' && parseInt(p.año) >= 2020);
    addFiltered(p => p.tipo === 'serie' && p.categoria !== 'Anime' && p.categoria !== 'Documentales' && p.categoria !== 'YouTube' && parseInt(p.año) >= 2020);
  } catch (err) {
    console.error("Error creating initialPeliculas array in SlugPage:", err);
  }

  return (
    <StreamPage 
      initialPeliculas={initialPeliculas} 
      initialEstrenos={estrenos}
      initialCanales={canales} 
      initialActiveItem={initialActiveItem}
      initialTab={initialTab}
      initialMovieCategory={initialMovieCategory}
      initialEstrenosCategory={initialEstrenosCategory}
    />
  );
}
