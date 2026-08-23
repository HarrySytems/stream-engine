/**
 * Convierte cualquier texto o título en un slug limpio para URL
 * Ejemplo: "¡Marcianos al ataque!" -> "marcianos-al-ataque"
 * Ejemplo: "América Televisión (1080p)" -> "america-television-1080p"
 */
export function createSlug(text) {
  if (!text) return '';
  return text
    .toString()
    .normalize('NFD') // Descompone caracteres con acento
    .replace(/[\u0300-\u036f]/g, '') // Elimina tildes y diacríticos
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '') // Elimina caracteres especiales (¡!¿?()[].,/:\'\" etc)
    .replace(/[\s_-]+/g, '-') // Convierte espacios y guiones bajos en un solo guión
    .replace(/^-+|-+$/g, ''); // Quita guiones iniciales o finales
}

/**
 * Genera la URL amigable correspondiente a un ítem
 */
export function getItemUrl(item) {
  if (!item) return '/';
  
  const title = item.nombre || item.titulo || item.id || '';
  const slug = createSlug(title);

  if (item.tipo === 'canal') {
    return `/canal/${slug}`;
  }
  if (item.tipo === 'serie') {
    if (item.categoria === 'Anime') return `/anime/${slug}`;
    return `/serie/${slug}`;
  }
  if (item.tipo === 'pelicula' || item.tipo === 'movie') {
    if (item.categoria === 'Clásicos') return `/clasicos/${slug}`;
    if (item.categoria === 'Anime') return `/anime/${slug}`;
    if (item.categoria && item.categoria !== 'Todos') {
      const catSlug = createSlug(item.categoria);
      return `/pelicula/${catSlug}/${slug}`;
    }
    return `/pelicula/${slug}`;
  }

  return `/pelicula/${slug}`;
}

/**
 * Busca un ítem en una lista mediante un slug o identificador
 */
export function findItemBySlug(items, slug, typeHint = null) {
  if (!items || !items.length || !slug) return null;

  const normalizedSlug = createSlug(slug);

  // 1. Coincidencia exacta de slug de título o nombre
  for (const item of items) {
    const itemSlug = createSlug(item.nombre || item.titulo || '');
    if (itemSlug === normalizedSlug) {
      return item;
    }
  }

  // 2. Coincidencia de ID directo o slug del ID
  for (const item of items) {
    if (item.id === slug || createSlug(item.id) === normalizedSlug) {
      return item;
    }
    if (item.tmdbId && String(item.tmdbId) === slug) {
      return item;
    }
  }

  // 3. Coincidencia parcial (por si el slug contiene el año o el id)
  for (const item of items) {
    const itemSlug = createSlug(item.nombre || item.titulo || '');
    if (itemSlug.includes(normalizedSlug) || normalizedSlug.includes(itemSlug)) {
      if (typeHint && item.tipo !== typeHint && item.categoria !== typeHint) {
        continue;
      }
      return item;
    }
  }

  return null;
}
