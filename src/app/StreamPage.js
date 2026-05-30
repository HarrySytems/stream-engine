"use client";

import { useState, useEffect, useRef } from 'react';

// Deterministic helper to get a language badge
const getLangBadge = (item) => {
  if (item.tipo === 'serie') return 'MULTI';
  const tmdbIdInt = item.tmdbId ? parseInt(item.tmdbId) : 0;
  const hash = tmdbIdInt || (item.id ? item.id.charCodeAt(0) + (item.id.charCodeAt(item.id.length - 1) || 0) : 0);
  const val = hash % 3;
  if (val === 0) return 'LAT';
  if (val === 1) return 'SUB';
  return 'MULTI';
};

// Helper component for horizontal category carousels
function CategoryRow({ title, items, onSelect, onPlay }) {
  const rowRef = useRef(null);

  const scroll = (direction) => {
    if (rowRef.current) {
      const { scrollLeft, clientWidth } = rowRef.current;
      const scrollTo = direction === 'left' 
        ? scrollLeft - clientWidth * 0.85 
        : scrollLeft + clientWidth * 0.85;
      rowRef.current.scrollTo({ left: scrollTo, behavior: 'smooth' });
    }
  };

  if (!items || items.length === 0) return null;

  return (
    <div className="category-row-container">
      <h2 className="category-row-title">{title}</h2>
      <div className="category-row-relative">
        <button className="carousel-nav-btn prev" onClick={() => scroll('left')}>&lsaquo;</button>
        <div className="category-row-scroll" ref={rowRef}>
          {items.map((item) => {
            const isCanal = item.tipo === 'canal';
            return (
              <div 
                key={item.id} 
                className="carousel-movie-card" 
                onClick={() => onSelect(item)}
                onDoubleClick={() => !isCanal && onPlay(item)}
              >
                <div className="carousel-poster-container">
                  <img 
                    src={isCanal ? (item.logo || "https://images.unsplash.com/photo-1489599849927-2ee91cede3ba?auto=format&fit=crop&w=400&q=80") : (item.poster || "https://images.unsplash.com/photo-1489599849927-2ee91cede3ba?auto=format&fit=crop&w=400&q=80")} 
                    alt={item.nombre || item.titulo} 
                    className="carousel-poster" 
                    style={isCanal ? { objectFit: 'contain', padding: '16px', backgroundColor: '#0e0f17', width: '100%', height: '100%', top: '0', left: '0', position: 'absolute' } : {}}
                    loading="lazy" 
                  />
                  {isCanal ? (
                    item.categoria === 'Cine' ? (
                      <span className="channel-fast-badge"><span className="live-dot"></span> FAST TV</span>
                    ) : (
                      <span className="channel-live-badge"><span className="live-dot"></span> EN VIVO</span>
                    )
                  ) : (
                    <span className="carousel-lang-badge">{getLangBadge(item)}</span>
                  )}
                  <div className="carousel-play-overlay">
                    <div className="play-arrow"></div>
                  </div>
                  {!isCanal && <span className="carousel-rating">★ {item.valoracion}</span>}
                </div>
                <div className="carousel-card-info">
                  <span className="carousel-card-title">{item.nombre || item.titulo}</span>
                  <span className="carousel-card-year">{isCanal ? (item.pais || item.categoria) : item.año}</span>
                </div>
              </div>
            );
          })}
        </div>
        <button className="carousel-nav-btn next" onClick={() => scroll('right')}>&rsaquo;</button>
      </div>
    </div>
  );
}

export default function StreamPage({ initialPeliculas, initialCanales }) {
  // Estado para la pantalla de presentación (Splash Screen)
  const [showSplash, setShowSplash] = useState(true);
  const [fadeOutSplash, setFadeOutSplash] = useState(false);

  // Catálogo de películas y canales
  const [peliculas] = useState(initialPeliculas || []);
  const [canales] = useState(initialCanales || []);

  // Estados de reproducción y navegación
  const [activeItem, setActiveItem] = useState(null); // Película o Serie seleccionada
  const [activeServer, setActiveServer] = useState(0); // Servidor seleccionado (0 a 3)
  const [searchQuery, setSearchQuery] = useState('');
  const [cuevanaServers, setCuevanaServers] = useState([]);
  const [loadingCuevana, setLoadingCuevana] = useState(false);
  
  // Pestaña activa ('inicio', 'peliculas', 'series', 'tdt', 'free')
  const [activeTab, setActiveTab] = useState('inicio');
  const [tdtFilter, setTdtFilter] = useState('Todos');

  const videoRef = useRef(null);
  const hlsRef = useRef(null);

  // Efecto para inicializar el reproductor HLS para canales en vivo
  useEffect(() => {
    let active = true;
    if (activeItem && activeItem.tipo === 'canal' && videoRef.current) {
      const video = videoRef.current;
      const streamUrl = activeItem.url;

      const initHls = async () => {
        try {
          const Hls = (await import('hls.js')).default;
          if (!active) return;
          
          if (hlsRef.current) {
            hlsRef.current.destroy();
          }

          if (Hls.isSupported()) {
            const hls = new Hls({
              maxBufferSize: 30 * 1024 * 1024,
              maxBufferLength: 30,
              enableWorker: true,
              lowLatencyMode: true
            });
            hls.loadSource(streamUrl);
            hls.attachMedia(video);
            hlsRef.current = hls;

            hls.on(Hls.Events.ERROR, (event, data) => {
              if (data.fatal) {
                switch (data.type) {
                  case Hls.ErrorTypes.NETWORK_ERROR:
                    hls.startLoad();
                    break;
                  case Hls.ErrorTypes.MEDIA_ERROR:
                    hls.recoverMediaError();
                    break;
                  default:
                    hls.destroy();
                    break;
                }
              }
            });
          } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
            video.src = streamUrl;
          }
        } catch (err) {
          console.error("Failed to load Hls.js dynamically", err);
        }
      };

      initHls();
    }

    return () => {
      active = false;
      if (hlsRef.current) {
        hlsRef.current.destroy();
        hlsRef.current = null;
      }
    };
  }, [activeItem]);

  // Letra seleccionada para índices A-Z
  const [selectedLetter, setSelectedLetter] = useState('Todos');
  const [selectedSeriesLetter, setSelectedSeriesLetter] = useState('Todos');

  // Límites de paginación
  const [moviesLimit, setMoviesLimit] = useState(32);
  const [seriesLimit, setSeriesLimit] = useState(32);
  const [searchLimit, setSearchLimit] = useState(32);

  // Estados para Series
  const [season, setSeason] = useState(1);
  const [episode, setEpisode] = useState(1);
  const [seasonsInfo, setSeasonsInfo] = useState([]);
  const [loadingSeasons, setLoadingSeasons] = useState(false);

  // Estados para el cargador directo de IDs
  const [customId, setCustomId] = useState('');
  const [customType, setCustomType] = useState('pelicula');
  const [customSeason, setCustomSeason] = useState(1);
  const [customEpisode, setCustomEpisode] = useState(1);

  // NUEVOS ESTADOS para Modal de Detalles, Elenco de Actores, Detalles de TMDB e indicador de carga de Iframe
  const [selectedItemDetails, setSelectedItemDetails] = useState(null);
  const [castInfo, setCastInfo] = useState([]);
  const [loadingCast, setLoadingCast] = useState(false);
  const [tmdbData, setTmdbData] = useState(null);
  const [iframeLoading, setIframeLoading] = useState(true);
  const [recommendations, setRecommendations] = useState([]);
  const [loadingRecs, setLoadingRecs] = useState(false);
  const [chatCollapsed, setChatCollapsed] = useState(false);

  // Efecto para controlar la duración de la animación del Splash Screen
  useEffect(() => {
    const fadeTimer = setTimeout(() => {
      setFadeOutSplash(true);
    }, 1800);

    const removeTimer = setTimeout(() => {
      setShowSplash(false);
    }, 2300);

    return () => {
      clearTimeout(fadeTimer);
      clearTimeout(removeTimer);
    };
  }, []);

  // Servidores de reproducción disponibles
  const servers = [
    {
      name: 'Servidor 1 (VidLink - Multi-idioma / Recomendado)',
      url: (tmdbId, imdbId, type, s, e) => 
        type === 'pelicula' 
          ? `https://vidlink.pro/movie/${tmdbId}?primaryColor=00f5d4`
          : `https://vidlink.pro/tv/${tmdbId}/${s}/${e}?primaryColor=00f5d4`
    },
    {
      name: 'Servidor 2 (VidSrc.cc)',
      url: (tmdbId, imdbId, type, s, e) => 
        type === 'pelicula' 
          ? `https://vidsrc.cc/v2/embed/movie/${imdbId || tmdbId}`
          : `https://vidsrc.cc/v2/embed/tv/${imdbId || tmdbId}/${s}/${e}`
    },
    {
      name: 'Servidor 3 (VidSrc.pm)',
      url: (tmdbId, imdbId, type, s, e) => 
        type === 'pelicula' 
          ? `https://vidsrc.pm/embed/movie/${tmdbId}`
          : `https://vidsrc.pm/embed/tv/${tmdbId}/${s}/${e}`
    },
    {
      name: 'Servidor 4 (Embed.su)',
      url: (tmdbId, imdbId, type, s, e) => 
        type === 'pelicula' 
          ? `https://embed.su/embed/movie/${tmdbId}`
          : `https://embed.su/embed/tv/${tmdbId}/${s}/${e}`
    },
    {
      name: 'Servidor 5 (SmashyStream)',
      url: (tmdbId, imdbId, type, s, e) => 
        type === 'pelicula' 
          ? `https://embed.smashystream.com/playere.php?tmdb=${tmdbId}`
          : `https://embed.smashystream.com/playere.php?tmdb=${tmdbId}&season=${s}&episode=${e}`
    }
  ];

  // Controladores para clicks simples y dobles en tarjetas
  const handleCardClick = (item) => {
    if (item.tipo === 'canal') {
      setActiveItem(item);
      setSelectedItemDetails(null);
    } else {
      setSelectedItemDetails(item);
    }
  };

  const handleCardDoubleClick = (item) => {
    setActiveItem(item);
    setSelectedItemDetails(null);
  };

  // Resetear servidor, temporada, episodio y estado del cargador de iframe cuando cambia el elemento activo
  useEffect(() => {
    setActiveServer(0);
    setSeason(1);
    setEpisode(1);
    setCuevanaServers([]);
    setIframeLoading(true);
  }, [activeItem]);

  // Resetear estado del cargador de iframe cuando cambia el servidor, la temporada o el episodio
  useEffect(() => {
    setIframeLoading(true);
  }, [activeServer, season, episode]);

  // Obtener detalles de la película o serie desde TMDB (para obtener el título original en inglés)
  useEffect(() => {
    if (!activeItem) {
      setTmdbData(null);
      return;
    }

    const tmdbId = activeItem.tmdbId;
    if (!tmdbId) {
      setTmdbData(null);
      return;
    }

    const mediaType = activeItem.tipo === 'serie' ? 'tv' : 'movie';
    fetch(`https://api.themoviedb.org/3/${mediaType}/${tmdbId}?api_key=04c35731a5ee918f014970082a0088b1&language=es-MX`)
      .then(res => {
        if (!res.ok) throw new Error("Failed to fetch TMDB details");
        return res.json();
      })
      .then(data => {
        setTmdbData(data);
      })
      .catch(err => {
        console.warn("Fallo al obtener detalles de TMDB:", err);
        setTmdbData(null);
      });
  }, [activeItem]);

  // Obtener elenco (credits) de TMDB para el modal de detalles
  useEffect(() => {
    if (!selectedItemDetails) {
      setCastInfo([]);
      return;
    }

    const tmdbId = selectedItemDetails.tmdbId;
    if (!tmdbId) {
      setCastInfo([]);
      return;
    }

    setLoadingCast(true);
    setCastInfo([]);

    const mediaType = selectedItemDetails.tipo === 'serie' ? 'tv' : 'movie';
    fetch(`https://api.themoviedb.org/3/${mediaType}/${tmdbId}/credits?api_key=04c35731a5ee918f014970082a0088b1&language=es-MX`)
      .then(res => {
        if (!res.ok) throw new Error("TMDB credits failed");
        return res.json();
      })
      .then(data => {
        if (data && data.cast) {
          // Filtrar actores principales que tengan foto
          const filteredCast = data.cast
            .filter(actor => actor.profile_path)
            .slice(0, 12)
            .map(actor => ({
              id: actor.id,
              name: actor.name,
              character: actor.character,
              profileUrl: `https://image.tmdb.org/t/p/w185${actor.profile_path}`
            }));
          setCastInfo(filteredCast);
        }
      })
      .catch(err => {
        console.warn("Fallo al obtener créditos de TMDB:", err);
        setCastInfo([]);
      })
      .finally(() => {
        setLoadingCast(false);
      });
  }, [selectedItemDetails]);

  // Obtener recomendaciones (similar) de TMDB para el modal de detalles
  useEffect(() => {
    if (!selectedItemDetails) {
      setRecommendations([]);
      return;
    }

    const tmdbId = selectedItemDetails.tmdbId;
    if (!tmdbId) {
      setRecommendations([]);
      return;
    }

    setLoadingRecs(true);
    setRecommendations([]);

    const mediaType = selectedItemDetails.tipo === 'serie' ? 'tv' : 'movie';
    fetch(`https://api.themoviedb.org/3/${mediaType}/${tmdbId}/similar?api_key=04c35731a5ee918f014970082a0088b1&language=es-MX`)
      .then(res => {
        if (!res.ok) throw new Error("TMDB similar failed");
        return res.json();
      })
      .then(data => {
        if (data && data.results) {
          const filteredRecs = data.results
            .filter(item => item.poster_path)
            .slice(0, 12)
            .map(item => ({
              id: `${selectedItemDetails.tipo === 'serie' ? 'serie' : 'pelicula'}-${item.id}`,
              titulo: item.title || item.name,
              tipo: selectedItemDetails.tipo,
              tmdbId: item.id.toString(),
              imdbId: '',
              descripcion: item.overview || 'Sin sinopsis disponible.',
              categoria: selectedItemDetails.categoria,
              año: item.release_date ? item.release_date.split('-')[0] : (item.first_air_date ? item.first_air_date.split('-')[0] : 'N/A'),
              valoracion: item.vote_average ? parseFloat(item.vote_average.toFixed(1)) : '7.0',
              poster: `https://image.tmdb.org/t/p/w342${item.poster_path}`
            }));
          setRecommendations(filteredRecs);
        }
      })
      .catch(err => {
        console.warn("Fallo al obtener recomendaciones de TMDB:", err);
        setRecommendations([]);
      })
      .finally(() => {
        setLoadingRecs(false);
      });
  }, [selectedItemDetails]);

  // Obtener servidores Latino desde Cuevana.gs y LaMovie.org a través de nuestro proxy de Next.js
  useEffect(() => {
    if (!activeItem) {
      setCuevanaServers([]);
      return;
    }

    setLoadingCuevana(true);
    setCuevanaServers([]);

    // Helper para extraer el nombre legible del servidor de las urls de embeds
    const getServerName = (url) => {
      try {
        const urlObj = new URL(url);
        const server = urlObj.searchParams.get('server');
        if (server) {
          return server.charAt(0).toUpperCase() + server.slice(1);
        }
        const host = urlObj.hostname;
        if (host.includes('filemoon')) return 'Filemoon';
        if (host.includes('goodstream')) return 'Goodstream';
        if (host.includes('hlswish') || host.includes('swish')) return 'Hlswish';
        if (host.includes('voe')) return 'Voe';
        if (host.includes('vimeos') || host.includes('waaw')) return 'Vimeos';
      } catch (e) {}
      return "Online";
    };

    const cleanTitle = (title) => {
      return title
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/[^a-z0-9\s]/g, '')
        .trim();
    };

    const tituloOriginal = activeItem.titulo;
    const originalTitle = tmdbData ? (tmdbData.original_title || tmdbData.original_name) : null;
    const postType = activeItem.tipo === 'serie' ? 'tvshows' : 'movies';

    // Función para obtener reproductores de un proveedor y título específico
    const fetchFromProvider = async (provider, titleToSearch) => {
      try {
        const searchRes = await fetch(`/api/cuevana?action=search&q=${encodeURIComponent(titleToSearch)}&postType=${postType}&provider=${provider}`);
        if (!searchRes.ok) return [];
        const searchData = await searchRes.json();
        if (searchData.error || !searchData.data || !searchData.data.posts || searchData.data.posts.length === 0) {
          return [];
        }

        const posts = searchData.data.posts;
        const cleanedQuery = cleanTitle(titleToSearch);
        
        let matchedPost = posts.find(p => cleanTitle(p.title).includes(cleanedQuery) || cleanedQuery.includes(cleanTitle(p.title)));
        if (!matchedPost) {
          matchedPost = posts[0];
        }

        const postId = matchedPost._id;

        if (activeItem.tipo === 'pelicula') {
          const playerRes = await fetch(`/api/cuevana?action=player&postId=${postId}&provider=${provider}`);
          const playerData = await playerRes.json();
          if (playerData.error || !playerData.data || !playerData.data.embeds) {
            return [];
          }
          return playerData.data.embeds;
        } else {
          const epsRes = await fetch(`/api/cuevana?action=episodes&postId=${postId}&provider=${provider}`);
          const episodesData = await epsRes.json();
          if (episodesData.error || !episodesData.data || !Array.isArray(episodesData.data)) {
            return [];
          }

          const matchedEpisode = episodesData.data.find(
            ep => ep.season_number === season && ep.episode_number === episode
          );

          if (!matchedEpisode) {
            return [];
          }

          const playerRes = await fetch(`/api/cuevana?action=player&postId=${matchedEpisode._id}&season=${season}&episode=${episode}&provider=${provider}`);
          const playerData = await playerRes.json();
          if (playerData.error || !playerData.data || !playerData.data.embeds) {
            return [];
          }
          return playerData.data.embeds;
        }
      } catch (err) {
        console.warn(`Error buscando en ${provider} con "${titleToSearch}":`, err.message);
        return [];
      }
    };

    // Lanzar búsquedas en paralelo para Cuevana y LaMovie, con fallbacks de títulos en inglés
    const runSearch = async () => {
      let cuevanaEmbeds = await fetchFromProvider('cuevana', tituloOriginal);
      if (cuevanaEmbeds.length === 0 && originalTitle && cleanTitle(tituloOriginal) !== cleanTitle(originalTitle)) {
        cuevanaEmbeds = await fetchFromProvider('cuevana', originalTitle);
      }

      let lamovieEmbeds = await fetchFromProvider('lamovie', tituloOriginal);
      if (lamovieEmbeds.length === 0 && originalTitle && cleanTitle(tituloOriginal) !== cleanTitle(originalTitle)) {
        lamovieEmbeds = await fetchFromProvider('lamovie', originalTitle);
      }

      const cuevanaServersList = cuevanaEmbeds
        .filter(emb => emb.url)
        .map(emb => ({
          name: `Latino - ${getServerName(emb.url)} (Cuevana)`,
          url: emb.url
        }));

      const lamovieServersList = lamovieEmbeds
        .filter(emb => emb.url)
        .map(emb => ({
          name: `Latino - ${getServerName(emb.url)} (LaMovie)`,
          url: emb.url
        }));

      // Fusionar y dedupicar por URL del reproductor
      const combined = [...cuevanaServersList, ...lamovieServersList];
      const uniqueCombined = [];
      const seenUrls = new Set();
      for (const item of combined) {
        if (!seenUrls.has(item.url)) {
          seenUrls.add(item.url);
          uniqueCombined.push(item);
        }
      }

      if (uniqueCombined.length > 0) {
        setCuevanaServers(uniqueCombined);
        setActiveServer(0);
      }
      setLoadingCuevana(false);
    };

    runSearch();
  }, [activeItem, season, episode, tmdbData]);

  // Obtener información real de temporadas y capítulos de TMDB
  useEffect(() => {
    if (!activeItem || activeItem.tipo !== 'serie') {
      setSeasonsInfo([]);
      return;
    }

    setLoadingSeasons(true);
    setSeasonsInfo([]); // Limpiar previos

    const tmdbId = activeItem.tmdbId;
    if (!tmdbId) {
      setSeasonsInfo([
        { seasonNumber: 1, episodeCount: 10 },
        { seasonNumber: 2, episodeCount: 10 }
      ]);
      setLoadingSeasons(false);
      return;
    }

    fetch(`https://api.themoviedb.org/3/tv/${tmdbId}?api_key=04c35731a5ee918f014970082a0088b1&language=es-MX`)
      .then(res => {
        if (!res.ok) throw new Error("TMDB Error");
        return res.json();
      })
      .then(data => {
        if (data && data.seasons) {
          const formatted = data.seasons
            .filter(s => s.season_number > 0)
            .map(s => ({
              seasonNumber: s.season_number,
              episodeCount: s.episode_count || 10,
              name: s.name || `Temporada ${s.season_number}`
            }));
          
          if (formatted.length > 0) {
            setSeasonsInfo(formatted);
            const hasCurrentSeason = formatted.some(s => s.seasonNumber === season);
            if (!hasCurrentSeason) {
              setSeason(formatted[0].seasonNumber);
              setEpisode(1);
            }
          } else {
            throw new Error("No seasons found");
          }
        } else {
          throw new Error("No data");
        }
      })
      .catch(err => {
        console.warn("Fallo al obtener temporadas de TMDB, usando fallback:", err);
        const fallback = Array.from({ length: 5 }, (_, i) => ({
          seasonNumber: i + 1,
          episodeCount: 15,
          name: `Temporada ${i + 1}`
        }));
        setSeasonsInfo(fallback);
      })
      .finally(() => {
        setLoadingSeasons(false);
      });
  }, [activeItem]);

  // Filtrar catálogo por búsqueda
  const filteredItems = peliculas.filter(item => {
    const matchesSearch = item.titulo.toLowerCase().includes(searchQuery.toLowerCase()) || 
                          item.descripcion.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesSearch;
  });

  // Auxiliar para obtener los 15 más valorados priorizando recientes
  const getTop15 = (list) => {
    return [...list]
      .sort((a, b) => {
        const yearA = parseInt(a.año) || 0;
        const yearB = parseInt(b.año) || 0;
        
        // Priorizar películas más recientes (2020-2026) frente a antiguas
        const isRecentA = yearA >= 2020 && yearA <= 2026;
        const isRecentB = yearB >= 2020 && yearB <= 2026;
        
        if (isRecentB !== isRecentA) {
          return isRecentB ? 1 : -1;
        }
        
        // Si ambos están en el mismo grupo de antigüedad, ordenar por año desc primero
        if (yearB !== yearA) {
          return yearB - yearA;
        }
        
        // Si son del mismo año, ordenar por valoración
        return (parseFloat(b.valoracion) || 0) - (parseFloat(a.valoracion) || 0);
      })
      .slice(0, 15);
  };

  const getEstrenosPeliculas = (list) => {
    return [...list]
      .filter(p => p.tipo === 'pelicula' && parseInt(p.año) >= 2020 && parseInt(p.año) <= 2026)
      .sort((a, b) => {
        const yearA = parseInt(a.año) || 0;
        const yearB = parseInt(b.año) || 0;
        if (yearB !== yearA) return yearB - yearA;
        return (parseFloat(b.valoracion) || 0) - (parseFloat(a.valoracion) || 0);
      })
      .slice(0, 20);
  };

  const getEstrenosSeries = (list) => {
    return [...list]
      .filter(p => p.tipo === 'serie' && parseInt(p.año) >= 2020 && parseInt(p.año) <= 2026)
      .sort((a, b) => {
        const yearA = parseInt(a.año) || 0;
        const yearB = parseInt(b.año) || 0;
        if (yearB !== yearA) return yearB - yearA;
        return (parseFloat(b.valoracion) || 0) - (parseFloat(a.valoracion) || 0);
      })
      .slice(0, 20);
  };

  // Auxiliar para filtrar por letra de forma insensible a mayúsculas y acentos
  const filterByLetter = (list, letter) => {
    if (!letter || letter === 'Todos') return list;
    if (letter === '#') {
      return list.filter(item => {
        const firstChar = item.titulo.charAt(0);
        return !/[a-zA-ZáéíóúüñÁÉÍÓÚÜÑ]/i.test(firstChar);
      });
    }
    return list.filter(item => {
      const firstChar = item.titulo.charAt(0).toUpperCase();
      const normalized = firstChar.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
      return normalized === letter;
    });
  };

  // Manejar carga por ID directo
  const handleLoadCustomId = (e) => {
    e.preventDefault();
    if (!customId.trim()) return;

    // Crear un objeto de película ficticio a partir del ID ingresado
    const customItem = {
      id: `custom-${customId}`,
      titulo: `${customType === 'pelicula' ? 'Película' : 'Serie'} (ID: ${customId})`,
      tipo: customType,
      tmdbId: customId,
      imdbId: customId.startsWith('tt') ? customId : '',
      descripcion: `Contenido cargado externamente mediante identificador único TMDB o IMDb.`,
      categoria: customType === 'pelicula' ? 'Película Externa' : 'Serie Externa',
      año: 'N/A',
      valoracion: 'N/A',
      isCustom: true
    };

    if (customType === 'serie') {
      setSeason(customSeason);
      setEpisode(customEpisode);
    }

    setActiveItem(customItem);
  };

  // Unificar servidores de Cuevana (Latino) y servidores originales
  const originalServersList = servers.map((s) => ({
    name: s.name,
    url: s.url(activeItem ? activeItem.tmdbId : '', activeItem ? activeItem.imdbId : '', activeItem ? activeItem.tipo : '', season, episode)
  }));

  const allServers = activeItem 
    ? (activeItem.tipo === 'canal' 
        ? [{ name: "Canal en Vivo", url: activeItem.url }]
        : [...cuevanaServers, ...originalServersList])
    : [];

  return (
    <div className="app-container">
      {/* 1. ANIMATED INTRO SPLASH SCREEN */}
      {showSplash && (
        <div className={`splash-overlay ${fadeOutSplash ? 'fade-out' : ''}`}>
          <div className="splash-logo-container">
            <svg width="320" height="100" viewBox="0 0 320 100" className="splash-logo">
              <defs>
                <linearGradient id="neon-cyan-gradient" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="#00f5d4" />
                  <stop offset="100%" stopColor="#00b8ff" />
                </linearGradient>
                <filter id="neon-glow-filter" x="-30%" y="-30%" width="160%" height="160%">
                  <feGaussianBlur stdDeviation="8" result="blur" />
                  <feMerge>
                    <feMergeNode in="blur" />
                    <feMergeNode in="SourceGraphic" />
                  </feMerge>
                </filter>
              </defs>
              
              {/* FILM Text with draw-in animation */}
              <text x="20" y="68" fill="#ffffff" fontSize="46" fontWeight="900" fontFamily="'Outfit', 'Inter', sans-serif" letterSpacing="3" className="animated-text">
                FILM
              </text>
              
              {/* TV glowing pill badge */}
              <rect x="175" y="20" width="115" height="60" rx="12" fill="url(#neon-cyan-gradient)" filter="url(#neon-glow-filter)" className="animated-badge" />
              <text x="232" y="62" fill="#07070c" fontSize="34" fontWeight="900" fontFamily="'Outfit', 'Inter', sans-serif" textAnchor="middle">
                TV
              </text>
            </svg>
            <div className="splash-loader-bar">
              <div className="loader-progress"></div>
            </div>
          </div>
        </div>
      )}

      {/* 2. HEADER */}
      <header className="main-header">
        <div className="header-content">
          {/* Logo clickeable para volver a la pantalla de inicio */}
          <div className="brand-logo" onClick={() => { setActiveItem(null); setSearchQuery(''); setActiveTab('inicio'); }}>
            <svg width="150" height="46" viewBox="0 0 200 60">
              <defs>
                <linearGradient id="header-cyan-grad" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="#00f5d4" />
                  <stop offset="100%" stopColor="#00b8ff" />
                </linearGradient>
              </defs>
              <text x="10" y="42" fill="#ffffff" fontSize="28" fontWeight="900" fontFamily="'Outfit', sans-serif" letterSpacing="1">
                FILM
              </text>
              <rect x="95" y="10" width="75" height="38" rx="8" fill="url(#header-cyan-grad)" />
              <text x="132" y="38" fill="#07070c" fontSize="22" fontWeight="900" fontFamily="'Outfit', sans-serif" textAnchor="middle">
                TV
              </text>
            </svg>
          </div>

          {/* Pestañas de navegación superiores */}
          {!activeItem && (
            <nav className="header-tabs">
              <button 
                onClick={() => { setActiveTab('inicio'); setSearchQuery(''); }}
                className={`header-tab-btn ${activeTab === 'inicio' && searchQuery === '' ? 'active' : ''}`}
              >
                Inicio
              </button>
              <button 
                onClick={() => { setActiveTab('peliculas'); setSearchQuery(''); }}
                className={`header-tab-btn ${activeTab === 'peliculas' && searchQuery === '' ? 'active' : ''}`}
              >
                Películas
              </button>
              <button 
                onClick={() => { setActiveTab('series'); setSearchQuery(''); }}
                className={`header-tab-btn ${activeTab === 'series' && searchQuery === '' ? 'active' : ''}`}
              >
                Series
              </button>
              <button 
                onClick={() => { setActiveTab('tdt'); setSearchQuery(''); }}
                className={`header-tab-btn ${activeTab === 'tdt' && searchQuery === '' ? 'active' : ''}`}
              >
                TDT
              </button>
              <button 
                onClick={() => { setActiveTab('free'); setSearchQuery(''); }}
                className={`header-tab-btn ${activeTab === 'free' && searchQuery === '' ? 'active' : ''}`}
              >
                FREE
              </button>
            </nav>
          )}

          {/* Buscador de catálogo (sólo visible si no estamos en reproducción activa) */}
          {!activeItem && (
            <div className="search-wrapper">
              <input
                type="text"
                placeholder="Buscar por título, género o sinopsis..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="search-input"
              />
            </div>
          )}
        </div>
      </header>

      {/* 3. CONTENIDO PRINCIPAL */}
      <main className="main-content">
        {activeItem ? (
          /* ========================================================================= */
          /* VISTA 1: REPRODUCTOR DE VIDEO ACTIVO + CHAT */
          /* ========================================================================= */
          <div className="player-view-container">
            {/* Cabecera del reproductor */}
            <div className="player-header">
              <button className="back-btn" onClick={() => setActiveItem(null)}>
                Volver al catálogo
              </button>
              <div className="player-meta">
                <span className="player-item-title">{activeItem.titulo}</span>
                <span className="player-item-year">({activeItem.año})</span>
                <span className="player-item-rating">★ {activeItem.valoracion}</span>
              </div>
            </div>

            {/* Panel de control de episodios si el contenido es una Serie */}
            {activeItem.tipo === 'serie' && (
              <div className="series-seasons-episodes-panel">
                <div className="seasons-tab-container">
                  <span className="panel-label">Temporadas:</span>
                  <div className="seasons-tabs">
                    {loadingSeasons ? (
                      <span className="loading-text">Cargando temporadas...</span>
                    ) : seasonsInfo.length > 0 ? (
                      seasonsInfo.map((s) => (
                        <button
                          key={s.seasonNumber}
                          onClick={() => {
                            setSeason(s.seasonNumber);
                            setEpisode(1);
                          }}
                          className={`season-tab-btn ${season === s.seasonNumber ? 'active' : ''}`}
                        >
                          {s.name}
                        </button>
                      ))
                    ) : (
                      [1, 2, 3, 4, 5].map((num) => (
                        <button
                          key={num}
                          onClick={() => {
                            setSeason(num);
                            setEpisode(1);
                          }}
                          className={`season-tab-btn ${season === num ? 'active' : ''}`}
                        >
                          Temp {num}
                        </button>
                      ))
                    )}
                  </div>
                </div>

                <div className="episodes-grid-container">
                  <div className="episodes-header">
                    <span className="panel-label">Episodios:</span>
                    <span className="episodes-count-info">
                      Temporada {season} — {
                        seasonsInfo.find(s => s.seasonNumber === season)?.episodeCount || 15
                      } capítulos disponibles
                    </span>
                  </div>
                  
                  <div className="episodes-buttons-grid">
                    {Array.from({ 
                      length: seasonsInfo.find(s => s.seasonNumber === season)?.episodeCount || 15 
                    }, (_, i) => i + 1).map((epNum) => (
                      <button
                        key={epNum}
                        onClick={() => setEpisode(epNum)}
                        className={`episode-btn ${episode === epNum ? 'active' : ''}`}
                      >
                        Capítulo {epNum}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* Pestañas de servidores de transmisión */}
            <div className="servers-tab-bar">
              <span className="servers-label">Servidores:</span>
              <div className="servers-list">
                {allServers.map((server, idx) => (
                  <button
                    key={idx}
                    onClick={() => setActiveServer(idx)}
                    className={`server-tab-btn ${activeServer === idx ? 'active' : ''}`}
                  >
                    {server.name}
                  </button>
                ))}
                {loadingCuevana && <span className="loading-text" style={{ marginLeft: '10px' }}>Buscando fuentes en español Latino...</span>}
              </div>
            </div>

            {/* Grid del Reproductor y el Chat */}
            <div className={`theater-grid ${chatCollapsed ? 'chat-is-collapsed' : ''}`}>
              {/* Contenedor del Iframe */}
              <div className="player-wrapper">
                <div className="iframe-aspect-ratio">
                  {/* YouTube-style Red Loading Bar */}
                  {iframeLoading && (
                    <div className="video-progress-loader-container">
                      <div className="video-progress-loader-bar"></div>
                    </div>
                  )}
                  
                  {activeItem.tipo === 'canal' ? (
                    <video
                      ref={videoRef}
                      controls
                      autoPlay
                      className="player-iframe"
                      style={{ width: '100%', height: '100%', border: 'none', backgroundColor: '#000' }}
                      onPlay={() => setIframeLoading(false)}
                      onLoadedData={() => setIframeLoading(false)}
                    />
                  ) : (
                    <iframe
                      src={allServers[activeServer]?.url || ''}
                      onLoad={() => setIframeLoading(false)}
                      allowFullScreen
                      allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
                      className="player-iframe"
                    />
                  )}
                </div>
              </div>

              {/* Contenedor del Chat Watch Party */}
              <div className={`chat-wrapper ${chatCollapsed ? 'collapsed' : ''}`}>
                <ChatBox 
                  channelId={activeItem.id} 
                  channelTitle={activeItem.titulo} 
                  isCollapsed={chatCollapsed}
                  onToggleCollapse={() => setChatCollapsed(!chatCollapsed)}
                />
              </div>
            </div>

            {/* Sinopsis y detalles debajo del reproductor en ancho completo */}
            <div className="player-details-full">
              <div className="player-details-card">
                <h3>Sinopsis</h3>
                <p>{activeItem.descripcion}</p>
                <div className="tags-row">
                  <span className="category-tag">{activeItem.categoria}</span>
                  <span className="type-tag">{activeItem.tipo === 'serie' ? 'Serie de TV' : 'Película'}</span>
                  {activeItem.tmdbId && <span className="id-tag">TMDB ID: {activeItem.tmdbId}</span>}
                </div>
              </div>
            </div>
          </div>
        ) : (
          /* ========================================================================= */
          /* VISTA 2: CATÁLOGO PRINCIPAL */
          /* ========================================================================= */
          <div className="catalog-view">
            {searchQuery !== '' ? (
              <div className="search-results-section">
                <h2 className="section-title">Resultados de búsqueda para: "{searchQuery}"</h2>
                <div className="cards-grid">
                  {filteredItems.slice(0, searchLimit).map((item) => (
                    <div 
                      key={item.id} 
                      className="movie-card"
                      onClick={() => handleCardClick(item)}
                      onDoubleClick={() => handleCardDoubleClick(item)}
                    >
                      <div className="poster-container">
                        <img 
                          src={item.poster || "https://images.unsplash.com/photo-1489599849927-2ee91cede3ba?auto=format&fit=crop&w=400&q=80"} 
                          alt={item.titulo} 
                          className="movie-poster"
                          loading="lazy"
                        />
                        <div className="card-play-overlay">
                          <div className="play-arrow"></div>
                        </div>
                        <span className="movie-lang-badge">{getLangBadge(item)}</span>
                        <span className="rating-badge">★ {item.valoracion}</span>
                      </div>
                      <div className="movie-card-info">
                        <h3 className="movie-card-title">{item.titulo}</h3>
                        <div className="movie-card-meta">
                          <span className="movie-card-year">{item.año}</span>
                          <span className="movie-card-genre">{item.categoria}</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                {filteredItems.length === 0 && (
                  <div className="no-results">
                    No se encontraron películas o series con los criterios de búsqueda.
                  </div>
                )}

                {filteredItems.length > searchLimit && (
                  <div className="load-more-container">
                    <button 
                      onClick={() => setSearchLimit(prev => prev + 32)}
                      className="load-more-btn"
                    >
                      Cargar más
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <>
                {activeTab === 'inicio' && (
                  <div className="tab-inicio-container">
                    {(() => {
                      const featured = peliculas.find(p => p.id === 'movie-157336') || peliculas[0];
                      if (!featured) return null;
                      return (
                        <div className="hero-banner" style={{ backgroundImage: `linear-gradient(to bottom, rgba(5,5,8,0.25) 0%, rgba(5,5,8,0.95) 100%), url(${featured.poster || ''})` }}>
                          <div className="hero-backdrop-glow" style={{ backgroundImage: `url(${featured.poster || ''})` }}></div>
                          <div className="hero-content-box">
                            <span className="hero-badge">DESTACADA</span>
                            <h1 className="hero-title">{featured.titulo}</h1>
                            <div className="hero-meta">
                              <span className="hero-rating">★ {featured.valoracion}</span>
                              <span className="hero-year">{featured.año}</span>
                              <span className="hero-genre">{featured.categoria}</span>
                            </div>
                            <p className="hero-desc">{featured.descripcion}</p>
                            <button className="hero-play-btn" onClick={() => handleCardClick(featured)}>
                              Ver detalles
                            </button>
                          </div>
                        </div>
                      );
                    })()}

                    <div className="carruseles-container">
                      <CategoryRow 
                        title="Películas de Estreno (2020 - 2026)" 
                        items={getEstrenosPeliculas(peliculas)} 
                        onSelect={handleCardClick}
                        onPlay={handleCardDoubleClick}
                      />
                      <CategoryRow 
                        title="Series de Estreno y Tendencia (Netflix, Max)" 
                        items={getEstrenosSeries(peliculas)} 
                        onSelect={handleCardClick}
                        onPlay={handleCardDoubleClick}
                      />
                      <CategoryRow 
                        title="Películas de Acción" 
                        items={getTop15(peliculas.filter(p => p.tipo === 'pelicula' && p.categoria === 'Acción'))} 
                        onSelect={handleCardClick}
                        onPlay={handleCardDoubleClick}
                      />
                      <CategoryRow 
                        title="Ciencia Ficción" 
                        items={getTop15(peliculas.filter(p => p.tipo === 'pelicula' && p.categoria === 'Ciencia Ficción'))} 
                        onSelect={handleCardClick}
                        onPlay={handleCardDoubleClick}
                      />
                      <CategoryRow 
                        title="Terror y Suspenso" 
                        items={getTop15(peliculas.filter(p => p.tipo === 'pelicula' && p.categoria === 'Terror'))} 
                        onSelect={handleCardClick}
                        onPlay={handleCardDoubleClick}
                      />
                      <CategoryRow 
                        title="Comedia" 
                        items={getTop15(peliculas.filter(p => p.tipo === 'pelicula' && p.categoria === 'Comedia'))} 
                        onSelect={handleCardClick}
                        onPlay={handleCardDoubleClick}
                      />
                      <CategoryRow 
                        title="Drama" 
                        items={getTop15(peliculas.filter(p => p.tipo === 'pelicula' && p.categoria === 'Drama'))} 
                        onSelect={handleCardClick}
                        onPlay={handleCardDoubleClick}
                      />
                      <CategoryRow 
                        title="Infantil y Familiar" 
                        items={getTop15(peliculas.filter(p => p.tipo === 'pelicula' && p.categoria === 'Infantil'))} 
                        onSelect={handleCardClick}
                        onPlay={handleCardDoubleClick}
                      />
                      <CategoryRow 
                        title="Series de TV más vistas" 
                        items={getTop15(peliculas.filter(p => p.tipo === 'serie'))} 
                        onSelect={handleCardClick}
                        onPlay={handleCardDoubleClick}
                      />
                    </div>
                  </div>
                )}

                {activeTab === 'tdt' && (
                  <div className="tab-tdt-container">
                    <h2 className="section-title">Televisión en Vivo (TDT)</h2>
                    
                    <div className="alphabet-bar" style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginBottom: '24px' }}>
                      {['Todos', 'Perú', 'España', 'México', 'Colombia', 'Argentina', 'Chile', 'Bolivia', 'Deportes', 'Noticias', 'Infantil', 'Música'].map((filt) => (
                        <button
                          key={filt}
                          onClick={() => setTdtFilter(filt)}
                          className={`letter-btn ${tdtFilter === filt ? 'active' : ''}`}
                          style={{ minWidth: 'auto', padding: '6px 14px' }}
                        >
                          {filt}
                        </button>
                      ))}
                    </div>

                    {(() => {
                      const filteredTdtCanales = canales.filter(ch => {
                        if (ch.categoria === 'Cine') return false; // Cine goes to FREE tab
                        
                        // Search query match
                        if (searchQuery) {
                          const q = searchQuery.toLowerCase();
                          if (!ch.nombre.toLowerCase().includes(q) && !ch.categoria.toLowerCase().includes(q) && !(ch.pais || '').toLowerCase().includes(q)) {
                            return false;
                          }
                        }
                        
                        // Category/Country filter match
                        if (tdtFilter === 'Todos') return true;
                        if (['Deportes', 'Noticias', 'Infantil', 'Música'].includes(tdtFilter)) {
                          return ch.categoria === tdtFilter;
                        }
                        return ch.pais === tdtFilter;
                      });

                      if (filteredTdtCanales.length === 0) {
                        return (
                          <div className="no-results" style={{ padding: '40px 0', textAlign: 'center', color: '#6b7280' }}>
                            No se encontraron canales para este filtro.
                          </div>
                        );
                      }

                      return (
                        <div className="movies-grid">
                          {filteredTdtCanales.map((item) => (
                            <div 
                              key={item.id} 
                              className="movie-card" 
                              onClick={() => handleCardClick(item)}
                            >
                              <div className="poster-container" style={{ padding: '0' }}>
                                <img 
                                  src={item.logo || "https://images.unsplash.com/photo-1489599849927-2ee91cede3ba?auto=format&fit=crop&w=400&q=80"} 
                                  alt={item.nombre} 
                                  className="movie-poster" 
                                  style={{ objectFit: 'contain', padding: '20px', backgroundColor: '#0e0f17', width: '100%', height: '100%', top: '0', left: '0', position: 'absolute' }}
                                  loading="lazy" 
                                />
                                <span className="channel-live-badge"><span className="live-dot"></span> EN VIVO</span>
                                <div className="card-play-overlay">
                                  <div className="play-arrow"></div>
                                </div>
                              </div>
                              <div className="movie-card-info">
                                <h3 className="movie-card-title">{item.nombre}</h3>
                                <div className="movie-card-meta">
                                  <span className="movie-card-year">{item.pais}</span>
                                  <span className="movie-card-genre">{item.categoria}</span>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      );
                    })()}
                  </div>
                )}

                {activeTab === 'free' && (
                  <div className="tab-free-container">
                    <h2 className="section-title">Canales de Cine Gratis (FAST TV)</h2>
                    
                    {(() => {
                      const filteredFreeCanales = canales.filter(ch => {
                        if (ch.categoria !== 'Cine') return false; // Only Cine channels go to FREE tab
                        
                        if (searchQuery) {
                          const q = searchQuery.toLowerCase();
                          return ch.nombre.toLowerCase().includes(q);
                        }
                        return true;
                      });

                      if (searchQuery) {
                        if (filteredFreeCanales.length === 0) {
                          return (
                            <div className="no-results" style={{ padding: '40px 0', textAlign: 'center', color: '#6b7280' }}>
                              No se encontraron canales de cine para tu búsqueda.
                            </div>
                          );
                        }
                        return (
                          <div className="movies-grid">
                            {filteredFreeCanales.map((item) => (
                              <div 
                                key={item.id} 
                                className="movie-card" 
                                onClick={() => handleCardClick(item)}
                              >
                                <div className="poster-container" style={{ padding: '0' }}>
                                  <img 
                                    src={item.logo || "https://images.unsplash.com/photo-1489599849927-2ee91cede3ba?auto=format&fit=crop&w=400&q=80"} 
                                    alt={item.nombre} 
                                    className="movie-poster" 
                                    style={{ objectFit: 'contain', padding: '20px', backgroundColor: '#0e0f17', width: '100%', height: '100%', top: '0', left: '0', position: 'absolute' }}
                                    loading="lazy" 
                                  />
                                  <span className="channel-fast-badge"><span className="live-dot"></span> FAST TV</span>
                                  <div className="card-play-overlay">
                                    <div className="play-arrow"></div>
                                  </div>
                                </div>
                                <div className="movie-card-info">
                                  <h3 className="movie-card-title">{item.nombre}</h3>
                                  <div className="movie-card-meta">
                                    <span className="movie-card-year">FAST TV</span>
                                    <span className="movie-card-genre">{item.categoria}</span>
                                  </div>
                                </div>
                              </div>
                            ))}
                          </div>
                        );
                      }

                      return (
                        <div className="carruseles-container">
                          <CategoryRow 
                            title="Cine en Español Latino" 
                            items={canales.filter(c => c.categoria === 'Cine' && (c.nombre.toLowerCase().includes('latino') || c.nombre.toLowerCase().includes('espanol') || c.nombre.toLowerCase().includes('español') || c.nombre.toLowerCase().includes('mex') || c.nombre.toLowerCase().includes('cine premium') || c.nombre.toLowerCase().includes('cine familiar')))} 
                            onSelect={handleCardClick}
                            onPlay={handleCardDoubleClick}
                          />
                          <CategoryRow 
                            title="Cine de Acción y Suspenso" 
                            items={canales.filter(c => c.categoria === 'Cine' && (c.nombre.toLowerCase().includes('accion') || c.nombre.toLowerCase().includes('action') || c.nombre.toLowerCase().includes('thriller') || c.nombre.toLowerCase().includes('terror') || c.nombre.toLowerCase().includes('horror') || c.nombre.toLowerCase().includes('suspenso')))} 
                            onSelect={handleCardClick}
                            onPlay={handleCardDoubleClick}
                          />
                          <CategoryRow 
                            title="Cine General y Blockbusters" 
                            items={canales.filter(c => c.categoria === 'Cine' && !(c.nombre.toLowerCase().includes('latino') || c.nombre.toLowerCase().includes('espanol') || c.nombre.toLowerCase().includes('español') || c.nombre.toLowerCase().includes('accion') || c.nombre.toLowerCase().includes('action') || c.nombre.toLowerCase().includes('thriller') || c.nombre.toLowerCase().includes('terror') || c.nombre.toLowerCase().includes('horror'))).slice(0, 20)} 
                            onSelect={handleCardClick}
                            onPlay={handleCardDoubleClick}
                          />
                        </div>
                      );
                    })()}
                  </div>
                )}

                {activeTab === 'peliculas' && (
                  <div className="tab-peliculas-container">
                    <h2 className="section-title">Películas A-Z</h2>
                    
                    <div className="alphabet-bar">
                      <button 
                        onClick={() => { setSelectedLetter('Todos'); setMoviesLimit(32); }}
                        className={`letter-btn ${selectedLetter === 'Todos' ? 'active' : ''}`}
                      >
                        Todos
                      </button>
                      {'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('').map(letter => (
                        <button 
                          key={letter}
                          onClick={() => { setSelectedLetter(letter); setMoviesLimit(32); }}
                          className={`letter-btn ${selectedLetter === letter ? 'active' : ''}`}
                        >
                          {letter}
                        </button>
                      ))}
                      <button 
                        onClick={() => { setSelectedLetter('#'); setMoviesLimit(32); }}
                        className={`letter-btn ${selectedLetter === '#' ? 'active' : ''}`}
                      >
                        #
                      </button>
                    </div>

                    {(() => {
                      const allMovies = peliculas.filter(p => p.tipo === 'pelicula');
                      const sorted = [...allMovies].sort((a, b) => a.titulo.localeCompare(b.titulo, 'es'));
                      const filtered = filterByLetter(sorted, selectedLetter);
                      const visible = filtered.slice(0, moviesLimit);

                      return (
                        <>
                          <div className="cards-grid">
                            {visible.map((item) => (
                              <div 
                                key={item.id} 
                                className="movie-card"
                                onClick={() => handleCardClick(item)}
                                onDoubleClick={() => handleCardDoubleClick(item)}
                              >
                                <div className="poster-container">
                                  <img 
                                    src={item.poster || "https://images.unsplash.com/photo-1489599849927-2ee91cede3ba?auto=format&fit=crop&w=400&q=80"} 
                                    alt={item.titulo} 
                                    className="movie-poster"
                                    loading="lazy"
                                  />
                                  <div className="card-play-overlay">
                                    <div className="play-arrow"></div>
                                  </div>
                                  <span className="movie-lang-badge">{getLangBadge(item)}</span>
                                  <span className="rating-badge">★ {item.valoracion}</span>
                                </div>
                                <div className="movie-card-info">
                                  <h3 className="movie-card-title">{item.titulo}</h3>
                                  <div className="movie-card-meta">
                                    <span className="movie-card-year">{item.año || item.año}</span>
                                    <span className="movie-card-genre">{item.categoria}</span>
                                  </div>
                                </div>
                              </div>
                            ))}

                            {filtered.length === 0 && (
                              <div className="no-results">
                                No hay películas que comiencen con la letra seleccionada.
                              </div>
                            )}
                          </div>

                          {filtered.length > moviesLimit && (
                            <div className="load-more-container">
                              <button 
                                onClick={() => setMoviesLimit(prev => prev + 32)}
                                className="load-more-btn"
                              >
                                Cargar más
                              </button>
                            </div>
                          )}
                        </>
                      );
                    })()}
                  </div>
                )}

                {activeTab === 'series' && (
                  <div className="tab-series-container">
                    <h2 className="section-title">Series de TV A-Z</h2>
                    
                    <div className="alphabet-bar">
                      <button 
                        onClick={() => { setSelectedSeriesLetter('Todos'); setSeriesLimit(32); }}
                        className={`letter-btn ${selectedSeriesLetter === 'Todos' ? 'active' : ''}`}
                      >
                        Todos
                      </button>
                      {'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('').map(letter => (
                        <button 
                          key={letter}
                          onClick={() => { setSelectedSeriesLetter(letter); setSeriesLimit(32); }}
                          className={`letter-btn ${selectedSeriesLetter === letter ? 'active' : ''}`}
                        >
                          {letter}
                        </button>
                      ))}
                      <button 
                        onClick={() => { setSelectedSeriesLetter('#'); setSeriesLimit(32); }}
                        className={`letter-btn ${selectedSeriesLetter === '#' ? 'active' : ''}`}
                      >
                        #
                      </button>
                    </div>

                    {(() => {
                      const allSeries = peliculas.filter(p => p.tipo === 'serie');
                      const sorted = [...allSeries].sort((a, b) => a.titulo.localeCompare(b.titulo, 'es'));
                      const filtered = filterByLetter(sorted, selectedSeriesLetter);
                      const visible = filtered.slice(0, seriesLimit);

                      return (
                        <>
                          <div className="cards-grid">
                            {visible.map((item) => (
                              <div 
                                key={item.id} 
                                className="movie-card"
                                onClick={() => handleCardClick(item)}
                                onDoubleClick={() => handleCardDoubleClick(item)}
                              >
                                <div className="poster-container">
                                  <img 
                                    src={item.poster || "https://images.unsplash.com/photo-1489599849927-2ee91cede3ba?auto=format&fit=crop&w=400&q=80"} 
                                    alt={item.titulo} 
                                    className="movie-poster"
                                    loading="lazy"
                                  />
                                  <div className="card-play-overlay">
                                    <div className="play-arrow"></div>
                                  </div>
                                  <span className="movie-lang-badge">{getLangBadge(item)}</span>
                                  <span className="rating-badge">★ {item.valoracion}</span>
                                </div>
                                <div className="movie-card-info">
                                  <h3 className="movie-card-title">{item.titulo}</h3>
                                  <div className="movie-card-meta">
                                    <span className="movie-card-year">{item.año || item.año}</span>
                                    <span className="movie-card-genre">{item.categoria}</span>
                                  </div>
                                </div>
                              </div>
                            ))}

                            {filtered.length === 0 && (
                              <div className="no-results">
                                No hay series que comiencen con la letra seleccionada.
                              </div>
                            )}
                          </div>

                          {filtered.length > seriesLimit && (
                            <div className="load-more-container">
                              <button 
                                onClick={() => setSeriesLimit(prev => prev + 32)}
                                className="load-more-btn"
                              >
                                Cargar más
                              </button>
                            </div>
                          )}
                        </>
                      );
                    })()}
                  </div>
                )}
              </>
            )}

            {/* SECCIÓN DE CARGADOR DIRECTO DE IDs (TMDB / IMDb) */}
            <div className="direct-loader-section">
              <div className="direct-loader-card">
                <h2>Cargar contenido por ID de TMDB o IMDb</h2>
                <p>
                  ¿Quieres ver algo que no está en el catálogo? Ingresa el ID de la película o serie de The Movie Database (TMDB) o IMDb para reproducirla directamente desde nuestros servidores.
                </p>

                <form onSubmit={handleLoadCustomId} className="direct-loader-form">
                  <div className="form-fields">
                    <div className="input-group">
                      <label htmlFor="content-id">ID del Contenido:</label>
                      <input
                        type="text"
                        id="content-id"
                        placeholder="Ej: 533535 (Deadpool 3) o tt6263850"
                        value={customId}
                        onChange={(e) => setCustomId(e.target.value)}
                        className="form-input"
                        required
                      />
                    </div>

                    <div className="input-group">
                      <label htmlFor="content-type">Tipo de Contenido:</label>
                      <select
                        id="content-type"
                        value={customType}
                        onChange={(e) => setCustomType(e.target.value)}
                        className="form-select"
                      >
                        <option value="pelicula">Película</option>
                        <option value="serie">Serie de TV</option>
                      </select>
                    </div>

                    {customType === 'serie' && (
                      <>
                        <div className="input-group-short">
                          <label htmlFor="content-season">Temp:</label>
                          <input
                            type="number"
                            id="content-season"
                            min="1"
                            value={customSeason}
                            onChange={(e) => setCustomSeason(Math.max(1, parseInt(e.target.value) || 1))}
                            className="form-input-number"
                          />
                        </div>

                        <div className="input-group-short">
                          <label htmlFor="content-episode">Cap:</label>
                          <input
                            type="number"
                            id="content-episode"
                            min="1"
                            value={customEpisode}
                            onChange={(e) => setCustomEpisode(Math.max(1, parseInt(e.target.value) || 1))}
                            className="form-input-number"
                          />
                        </div>
                      </>
                    )}
                  </div>

                  <button type="submit" className="load-btn">
                    Cargar Reproductor
                  </button>
                </form>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* 4. FOOTER */}
      <footer className="main-footer">
        <div className="footer-content">
          <p>FilmTV - Portal elegante de streaming. Todos los derechos a sus respectivos servidores externos.</p>
        </div>
      </footer>

      {/* 5. DISEÑO ESTÉTICO EN VANILLA CSS (CSS-in-JS Global) */}
      <style jsx global>{`
        /* Reset e Importación de Estilos */
        @import url('https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;600;700;900&family=Inter:wght@300;400;600;700&display=swap');

        body {
          background-color: #050508;
          color: #f3f4f6;
          font-family: 'Inter', system-ui, -apple-system, sans-serif;
          margin: 0;
          padding: 0;
          overflow-x: hidden;
        }

        .app-container {
          min-height: 100vh;
          display: flex;
          flex-direction: column;
          background: radial-gradient(circle at top, #0f101a 0%, #050508 100%);
        }

        /* 1. SPLASH SCREEN INTRO ANIMATION */
        .splash-overlay {
          position: fixed;
          top: 0;
          left: 0;
          width: 100vw;
          height: 100vh;
          background-color: #030305;
          display: flex;
          justify-content: center;
          align-items: center;
          z-index: 99999;
          transition: opacity 0.6s cubic-bezier(0.16, 1, 0.3, 1);
        }

        .splash-overlay.fade-out {
          opacity: 0;
          pointer-events: none;
        }

        .splash-logo-container {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 20px;
        }

        .splash-logo {
          animation: splash-logo-scale 2s ease-in-out forwards;
        }

        .splash-loader-bar {
          width: 200px;
          height: 3px;
          background-color: rgba(255, 255, 255, 0.05);
          border-radius: 4px;
          overflow: hidden;
          position: relative;
        }

        .loader-progress {
          width: 100%;
          height: 100%;
          background: linear-gradient(90deg, #00f5d4, #00b8ff);
          border-radius: 4px;
          animation: loader-slide 1.8s ease-in-out forwards;
          transform-origin: left;
        }

        @keyframes splash-logo-scale {
          0% {
            transform: scale(0.85);
            opacity: 0;
          }
          30% {
            transform: scale(1.05);
            opacity: 1;
          }
          75% {
            transform: scale(1);
            opacity: 1;
            filter: drop-shadow(0 0 20px rgba(0, 245, 212, 0.5));
          }
          100% {
            transform: scale(0.95);
            opacity: 0;
          }
        }

        @keyframes loader-slide {
          0% {
            transform: scaleX(0);
          }
          100% {
            transform: scaleX(1);
          }
        }

        /* 2. HEADER */
        .main-header {
          background-color: rgba(5, 5, 8, 0.8);
          backdrop-filter: blur(12px);
          border-bottom: 1px solid rgba(0, 245, 212, 0.12);
          position: sticky;
          top: 0;
          z-index: 1000;
          padding: 12px 24px;
          box-shadow: 0 4px 30px rgba(0, 0, 0, 0.4);
        }

        .header-content {
          max-width: 1300px;
          margin: 0 auto;
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 20px;
        }

        .brand-logo {
          cursor: pointer;
          transition: transform 0.2s ease;
        }

        .brand-logo:hover {
          transform: scale(1.02);
        }

        .brand-logo svg rect {
          animation: logo-glow-pulse 8s infinite ease-in-out;
        }

        @keyframes logo-glow-pulse {
          0%, 100% {
            filter: drop-shadow(0 0 0px rgba(0, 245, 212, 0));
            transform: scale(1);
            transform-origin: 132px 29px;
          }
          5% {
            filter: drop-shadow(0 0 10px rgba(0, 245, 212, 0.85));
            transform: scale(1.06);
            transform-origin: 132px 29px;
          }
          10% {
            filter: drop-shadow(0 0 14px rgba(0, 184, 255, 0.95));
            transform: scale(1.03);
            transform-origin: 132px 29px;
          }
          15% {
            filter: drop-shadow(0 0 0px rgba(0, 245, 212, 0));
            transform: scale(1);
            transform-origin: 132px 29px;
          }
        }

        .search-wrapper {
          flex: 0 1 450px;
        }

        .search-input {
          width: 100%;
          padding: 10px 16px;
          border-radius: 20px;
          border: 1px solid rgba(255, 255, 255, 0.08);
          background-color: rgba(255, 255, 255, 0.04);
          color: #ffffff;
          font-size: 14px;
          outline: none;
          transition: all 0.3s ease;
        }

        .search-input:focus {
          border-color: #00f5d4;
          background-color: rgba(255, 255, 255, 0.08);
          box-shadow: 0 0 15px rgba(0, 245, 212, 0.2);
        }

        /* 3. MAIN CONTENT */
        .main-content {
          flex: 1;
          max-width: 1300px;
          width: 100%;
          margin: 0 auto;
          padding: 30px 24px;
          box-sizing: border-box;
        }

        /* 3.1 CATALOG VIEW */
        .filters-container {
          display: flex;
          gap: 10px;
          overflow-x: auto;
          padding-bottom: 12px;
          margin-bottom: 30px;
          scrollbar-width: thin;
          scrollbar-color: rgba(255, 255, 255, 0.1) transparent;
        }

        .filters-container::-webkit-scrollbar {
          height: 4px;
        }

        .filters-container::-webkit-scrollbar-thumb {
          background: rgba(255, 255, 255, 0.1);
          border-radius: 4px;
        }

        .filter-btn {
          background-color: rgba(255, 255, 255, 0.03);
          border: 1px solid rgba(255, 255, 255, 0.08);
          color: #9ca3af;
          padding: 8px 20px;
          border-radius: 30px;
          font-size: 13px;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.25s ease;
          white-space: nowrap;
        }

        .filter-btn:hover {
          border-color: #00f5d4;
          color: #ffffff;
        }

        .filter-btn.active {
          background-color: #00f5d4;
          border-color: #00f5d4;
          color: #07070c;
          box-shadow: 0 0 15px rgba(0, 245, 212, 0.35);
        }

        .cards-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
          gap: 24px;
          margin-bottom: 50px;
        }

        .movie-card {
          background-color: #0e0f17;
          border: 1px solid rgba(255, 255, 255, 0.04);
          border-radius: 12px;
          overflow: hidden;
          cursor: pointer;
          transition: all 0.3s cubic-bezier(0.16, 1, 0.3, 1);
          position: relative;
        }

        .movie-card:hover {
          transform: translateY(-6px) scale(1.06);
          border-color: #00f5d4;
          box-shadow: 0 10px 30px rgba(0, 0, 0, 0.6), 0 0 20px rgba(0, 245, 212, 0.25);
        }

        .movie-card:active {
          transform: translateY(-2px) scale(0.98);
          transition: transform 0.1s ease;
        }

        .poster-container {
          position: relative;
          aspect-ratio: 2/3;
          width: 100%;
          overflow: hidden;
          background-color: #0b0c12;
        }

        .movie-poster {
          position: absolute;
          top: 0;
          left: 0;
          width: 100%;
          height: 100%;
          object-fit: cover;
          transition: transform 0.4s ease;
        }

        .movie-card:hover .movie-poster {
          transform: scale(1.05);
        }

        .movie-lang-badge, .carousel-lang-badge {
          position: absolute;
          top: 8px;
          left: 8px;
          background-color: rgba(7, 7, 12, 0.85);
          border: 1px solid rgba(255, 255, 255, 0.15);
          color: #00f5d4;
          font-size: 10px;
          font-weight: 800;
          padding: 2px 6px;
          border-radius: 4px;
          letter-spacing: 0.5px;
          z-index: 2;
          box-shadow: 0 2px 4px rgba(0,0,0,0.5);
          text-transform: uppercase;
        }

        .card-play-overlay {
          position: absolute;
          top: 0;
          left: 0;
          width: 100%;
          height: 100%;
          background: rgba(7, 7, 12, 0.5);
          display: flex;
          justify-content: center;
          align-items: center;
          opacity: 0;
          transition: opacity 0.3s ease;
        }

        .movie-card:hover .card-play-overlay {
          opacity: 1;
        }

        .play-arrow {
          width: 0;
          height: 0;
          border-top: 14px solid transparent;
          border-bottom: 14px solid transparent;
          border-left: 24px solid #00f5d4;
          margin-left: 4px;
          filter: drop-shadow(0 0 8px rgba(0, 245, 212, 0.6));
        }

        .rating-badge {
          position: absolute;
          top: 10px;
          right: 10px;
          background-color: rgba(7, 7, 12, 0.85);
          backdrop-filter: blur(4px);
          border: 1px solid rgba(0, 245, 212, 0.3);
          color: #00f5d4;
          font-size: 11px;
          font-weight: 700;
          padding: 3px 8px;
          border-radius: 4px;
          z-index: 10;
        }

        .movie-card-info {
          padding: 12px 14px;
        }

        .movie-card-title {
          font-size: 14px;
          font-weight: 700;
          color: #f3f4f6;
          margin: 0 0 6px 0;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .movie-card-meta {
          display: flex;
          justify-content: space-between;
          font-size: 11px;
          color: #9ca3af;
        }

        .no-results {
          grid-column: 1 / -1;
          padding: 60px 20px;
          text-align: center;
          color: #6b7280;
          font-size: 15px;
        }

        /* 3.2 DIRECT LOADER SECTION */
        .direct-loader-section {
          margin-top: 50px;
          display: flex;
          justify-content: center;
        }

        .direct-loader-card {
          background: linear-gradient(135deg, #0e0f17 0%, #08080c 100%);
          border: 1px solid rgba(0, 245, 212, 0.15);
          border-radius: 16px;
          padding: 24px 30px;
          max-width: 750px;
          width: 100%;
          box-shadow: 0 10px 40px rgba(0, 0, 0, 0.5);
        }

        .direct-loader-card h2 {
          font-family: 'Outfit', sans-serif;
          font-size: 20px;
          color: #ffffff;
          margin: 0 0 10px 0;
        }

        .direct-loader-card p {
          font-size: 13px;
          color: #9ca3af;
          line-height: 1.6;
          margin: 0 0 20px 0;
        }

        .direct-loader-form {
          display: flex;
          flex-direction: column;
          gap: 20px;
        }

        .form-fields {
          display: flex;
          flex-wrap: wrap;
          gap: 16px;
        }

        .input-group {
          flex: 1 1 200px;
          display: flex;
          flex-direction: column;
          gap: 6px;
        }

        .input-group-short {
          flex: 0 1 70px;
          display: flex;
          flex-direction: column;
          gap: 6px;
        }

        .input-group label, .input-group-short label {
          font-size: 11px;
          text-transform: uppercase;
          letter-spacing: 0.5px;
          color: #9ca3af;
          font-weight: 600;
        }

        .form-input, .form-select, .form-input-number {
          padding: 10px 14px;
          background-color: rgba(255, 255, 255, 0.04);
          border: 1px solid rgba(255, 255, 255, 0.08);
          border-radius: 8px;
          color: #ffffff;
          font-size: 13px;
          outline: none;
          box-sizing: border-box;
          transition: all 0.2s ease;
        }

        .form-input:focus, .form-select:focus, .form-input-number:focus {
          border-color: #00f5d4;
          background-color: rgba(255, 255, 255, 0.08);
        }

        .form-input {
          width: 100%;
        }

        .form-select {
          cursor: pointer;
        }

        .form-input-number {
          width: 100%;
          text-align: center;
        }

        .load-btn {
          align-self: flex-start;
          background-color: #00f5d4;
          border: none;
          color: #07070c;
          font-weight: 700;
          font-size: 13px;
          padding: 10px 24px;
          border-radius: 8px;
          cursor: pointer;
          transition: all 0.25s ease;
          box-shadow: 0 4px 15px rgba(0, 245, 212, 0.2);
        }

        .load-btn:hover {
          transform: translateY(-2px);
          box-shadow: 0 6px 20px rgba(0, 245, 212, 0.35);
        }

        /* 3.3 PLAYER VIEW CONTAINER */
        .player-view-container {
          display: flex;
          flex-direction: column;
          gap: 20px;
        }

        .player-header {
          display: flex;
          align-items: center;
          gap: 16px;
          flex-wrap: wrap;
        }

        .back-btn {
          background-color: transparent;
          border: 1px solid rgba(0, 245, 212, 0.3);
          color: #00f5d4;
          padding: 8px 18px;
          border-radius: 6px;
          font-size: 13px;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.2s ease;
        }

        .back-btn:hover {
          background-color: rgba(0, 245, 212, 0.05);
          transform: translateX(-3px);
        }

        .player-meta {
          display: flex;
          align-items: center;
          gap: 8px;
        }

        .player-item-title {
          font-family: 'Outfit', sans-serif;
          font-size: 20px;
          font-weight: 700;
          color: #ffffff;
        }

        .player-item-year {
          font-size: 14px;
          color: #9ca3af;
        }

        .player-item-rating {
          font-size: 13px;
          color: #f59e0b;
          font-weight: 700;
        }

        .series-selector-panel {
          display: flex;
          align-items: center;
          gap: 24px;
          flex-wrap: wrap;
          background-color: #0e0f17;
          border: 1px solid rgba(255, 255, 255, 0.04);
          padding: 12px 20px;
          border-radius: 10px;
        }

        .selector-group {
          display: flex;
          align-items: center;
          gap: 10px;
        }

        .selector-label {
          font-size: 12px;
          font-weight: 700;
          text-transform: uppercase;
          color: #9ca3af;
        }

        .counter-controls {
          display: flex;
          align-items: center;
          background-color: rgba(255, 255, 255, 0.04);
          border: 1px solid rgba(255, 255, 255, 0.08);
          border-radius: 6px;
          overflow: hidden;
        }

        .counter-btn {
          background: transparent;
          border: none;
          color: #ffffff;
          width: 32px;
          height: 32px;
          cursor: pointer;
          font-weight: 700;
          font-size: 15px;
          transition: background-color 0.2s;
        }

        .counter-btn:hover {
          background-color: rgba(255, 255, 255, 0.08);
        }

        .counter-display {
          width: 36px;
          text-align: center;
          font-size: 13px;
          font-weight: 700;
        }

        .selector-info {
          font-size: 12px;
          color: #00f5d4;
          font-weight: 600;
        }

        .servers-tab-bar {
          display: flex;
          align-items: center;
          gap: 12px;
          flex-wrap: wrap;
        }

        .servers-label {
          font-size: 11px;
          text-transform: uppercase;
          font-weight: 700;
          color: #6b7280;
        }

        .servers-list {
          display: flex;
          gap: 8px;
          flex-wrap: wrap;
        }

        .server-tab-btn {
          background-color: rgba(255, 255, 255, 0.03);
          border: 1px solid rgba(255, 255, 255, 0.06);
          color: #d1d5db;
          padding: 6px 14px;
          border-radius: 6px;
          font-size: 12px;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.2s ease;
        }

        .server-tab-btn:hover {
          border-color: rgba(0, 245, 212, 0.3);
          color: #ffffff;
        }

        .server-tab-btn.active {
          background-color: rgba(0, 245, 212, 0.08);
          border-color: #00f5d4;
          color: #00f5d4;
          box-shadow: 0 0 12px rgba(0, 245, 212, 0.15);
        }

        .theater-grid {
          display: grid;
          grid-template-columns: 1fr;
          gap: 20px;
        }

        @media (min-width: 1024px) {
          .theater-grid {
            grid-template-columns: 3fr 1.1fr;
          }
          .theater-grid.chat-is-collapsed {
            grid-template-columns: 1fr;
          }
        }

        .player-wrapper {
          display: flex;
          flex-direction: column;
          gap: 10px;
        }

        .iframe-aspect-ratio {
          position: relative;
          padding-top: 56.25%; /* 16:9 Aspect Ratio */
          background-color: #000000;
          border-radius: 12px;
          overflow: hidden;
          border: 1px solid rgba(0, 245, 212, 0.15);
          box-shadow: 0 10px 40px rgba(0,0,0,0.8), 0 0 25px rgba(0, 245, 212, 0.05);
        }

        .player-iframe {
          position: absolute;
          top: 0;
          left: 0;
          width: 100%;
          height: 100%;
          border: none;
        }

        .chat-wrapper {
          min-height: 480px;
          height: 100%;
          background-color: transparent;
          border: none;
          border-radius: 12px;
          overflow: hidden;
          transition: all 0.3s cubic-bezier(0.16, 1, 0.3, 1);
        }

        .chat-wrapper.collapsed {
          min-height: 48px !important;
          height: 48px !important;
        }

        .player-details-full {
          width: 100%;
          margin-top: 10px;
        }

        .player-details-card {
          background-color: #0e0f17;
          border: 1px solid rgba(255, 255, 255, 0.04);
          border-radius: 12px;
          padding: 20px 24px;
        }

        .player-details-card h3 {
          margin: 0 0 8px 0;
          font-family: 'Outfit', sans-serif;
          font-size: 16px;
          color: #ffffff;
        }

        .player-details-card p {
          margin: 0 0 16px 0;
          font-size: 13px;
          color: #9ca3af;
          line-height: 1.6;
        }

        .tags-row {
          display: flex;
          gap: 8px;
          flex-wrap: wrap;
        }

        .category-tag, .type-tag, .id-tag {
          font-size: 11px;
          font-weight: 700;
          padding: 4px 10px;
          border-radius: 4px;
        }

        .category-tag {
          background-color: rgba(0, 245, 212, 0.08);
          border: 1px solid rgba(0, 245, 212, 0.2);
          color: #00f5d4;
        }

        .type-tag {
          background-color: rgba(255, 255, 255, 0.04);
          border: 1px solid rgba(255, 255, 255, 0.08);
          color: #d1d5db;
        }

        .id-tag {
          background-color: rgba(255, 255, 255, 0.02);
          border: 1px solid rgba(255, 255, 255, 0.04);
          color: #6b7280;
        }

        /* 4. FOOTER */
        .main-footer {
          border-top: 1px solid rgba(255, 255, 255, 0.04);
          padding: 24px;
          text-align: center;
          margin-top: 60px;
        }

        .footer-content p {
          margin: 0;
          font-size: 12px;
          color: #4b5563;
        }

        /* ESTILOS DE REDISEÑO PREMIUM AGREGADOS */
        
        /* HEADER TABS */
        .header-tabs {
          display: flex;
          gap: 20px;
          margin-left: 30px;
          align-items: center;
        }

        .header-tab-btn {
          background: transparent;
          border: none;
          color: #a3a3a3;
          font-size: 14px;
          font-weight: 600;
          cursor: pointer;
          transition: color 0.2s, transform 0.2s;
          padding: 8px 4px;
          font-family: 'Outfit', sans-serif;
        }

        .header-tab-btn:hover {
          color: #ffffff;
        }

        .header-tab-btn.active {
          color: #00f5d4;
          border-bottom: 2px solid #00f5d4;
        }

        /* HERO BANNER */
        .hero-banner {
          position: relative;
          min-height: 480px;
          display: flex;
          align-items: center;
          padding: 40px 60px;
          border-radius: 16px;
          margin-bottom: 40px;
          overflow: hidden;
          background-size: cover;
          background-position: center;
          box-shadow: 0 10px 30px rgba(0,0,0,0.5);
          border: 1px solid rgba(255,255,255,0.03);
        }

        .hero-backdrop-glow {
          position: absolute;
          top: 0;
          left: 0;
          width: 100%;
          height: 100%;
          background-size: cover;
          background-position: center;
          filter: blur(80px);
          opacity: 0.15;
          z-index: 1;
          pointer-events: none;
        }

        .hero-content-box {
          position: relative;
          z-index: 2;
          max-width: 600px;
        }

        .hero-badge {
          background: linear-gradient(90deg, #00f5d4, #00b8ff);
          color: #07070c;
          font-size: 10px;
          font-weight: 800;
          padding: 4px 10px;
          border-radius: 4px;
          letter-spacing: 1px;
          display: inline-block;
          margin-bottom: 15px;
        }

        .hero-title {
          font-family: 'Outfit', sans-serif;
          font-size: 42px;
          font-weight: 900;
          margin: 0 0 15px 0;
          color: #ffffff;
          line-height: 1.1;
          letter-spacing: -0.5px;
        }

        .hero-meta {
          display: flex;
          gap: 15px;
          align-items: center;
          margin-bottom: 20px;
          font-size: 14px;
          font-weight: 600;
        }

        .hero-rating {
          color: #ffb800;
        }

        .hero-year {
          color: #9ca3af;
        }

        .hero-genre {
          background-color: rgba(255,255,255,0.08);
          padding: 2px 8px;
          border-radius: 4px;
          color: #d1d5db;
        }

        .hero-desc {
          color: #d1d5db;
          font-size: 15px;
          line-height: 1.6;
          margin: 0 0 25px 0;
          display: -webkit-box;
          -webkit-line-clamp: 4;
          -webkit-box-orient: vertical;
          overflow: hidden;
        }

        .hero-play-btn {
          background-color: #00f5d4;
          color: #07070c;
          border: none;
          font-family: 'Outfit', sans-serif;
          font-size: 15px;
          font-weight: 700;
          padding: 12px 28px;
          border-radius: 8px;
          cursor: pointer;
          transition: all 0.25s ease;
          box-shadow: 0 4px 15px rgba(0, 245, 212, 0.3);
        }

        .hero-play-btn:hover {
          transform: translateY(-2px);
          box-shadow: 0 6px 20px rgba(0, 245, 212, 0.5);
        }

        /* CATEGORY ROWS & CAROUSELS */
        .carruseles-container {
          display: flex;
          flex-direction: column;
          gap: 35px;
          margin-bottom: 50px;
        }

        .category-row-container {
          display: flex;
          flex-direction: column;
          gap: 12px;
          position: relative;
        }

        .category-row-title {
          font-family: 'Outfit', sans-serif;
          font-size: 20px;
          font-weight: 700;
          color: #ffffff;
          margin: 0;
          padding-left: 4px;
        }

        .category-row-relative {
          position: relative;
          display: flex;
          align-items: center;
        }

        .category-row-scroll {
          display: flex;
          gap: 16px;
          overflow-x: auto;
          scroll-behavior: smooth;
          padding: 10px 4px;
          width: 100%;
          scrollbar-width: none;
        }

        .category-row-scroll::-webkit-scrollbar {
          display: none;
        }

        .carousel-movie-card {
          flex: 0 0 160px;
          width: 160px;
          min-width: 160px;
          max-width: 160px;
          cursor: pointer;
          transition: transform 0.3s cubic-bezier(0.16, 1, 0.3, 1), box-shadow 0.3s ease;
          display: flex;
          flex-direction: column;
        }

        .carousel-movie-card:hover {
          transform: translateY(-6px) scale(1.06);
          box-shadow: 0 12px 24px rgba(0, 0, 0, 0.6), 0 0 20px rgba(0, 245, 212, 0.3);
        }

        .carousel-movie-card:active {
          transform: translateY(-2px) scale(0.98);
          transition: transform 0.1s ease;
        }

        .carousel-poster-container {
          position: relative;
          aspect-ratio: 2/3;
          width: 100%;
          border-radius: 10px;
          overflow: hidden;
          background-color: #11131e;
          box-shadow: 0 4px 12px rgba(0,0,0,0.3);
          border: 1px solid rgba(255,255,255,0.03);
          margin-bottom: 8px;
        }

        .carousel-poster {
          position: absolute;
          top: 0;
          left: 0;
          width: 100%;
          height: 100%;
          object-fit: cover;
          transition: transform 0.4s ease;
        }

        .carousel-movie-card:hover .carousel-poster {
          transform: scale(1.05);
        }

        .carousel-play-overlay {
          position: absolute;
          top: 0;
          left: 0;
          width: 100%;
          height: 100%;
          background-color: rgba(7, 7, 12, 0.6);
          display: flex;
          justify-content: center;
          align-items: center;
          opacity: 0;
          transition: opacity 0.2s ease;
        }

        .carousel-movie-card:hover .carousel-play-overlay {
          opacity: 1;
        }

        .carousel-rating {
          position: absolute;
          top: 8px;
          right: 8px;
          background-color: rgba(7, 7, 12, 0.8);
          border: 1px solid rgba(255, 255, 255, 0.1);
          color: #ffb800;
          font-size: 11px;
          font-weight: 700;
          padding: 2px 6px;
          border-radius: 4px;
        }

        .channel-live-badge {
          position: absolute;
          top: 8px;
          left: 8px;
          background-color: rgba(220, 38, 38, 0.95);
          border: 1px solid rgba(255, 255, 255, 0.15);
          color: #ffffff;
          font-size: 10px;
          font-weight: 800;
          padding: 2px 8px;
          border-radius: 4px;
          letter-spacing: 0.5px;
          z-index: 2;
          box-shadow: 0 2px 4px rgba(0,0,0,0.5);
          display: flex;
          align-items: center;
          gap: 4px;
          text-transform: uppercase;
        }

        .channel-fast-badge {
          position: absolute;
          top: 8px;
          left: 8px;
          background-color: rgba(59, 130, 246, 0.95);
          border: 1px solid rgba(255, 255, 255, 0.15);
          color: #ffffff;
          font-size: 10px;
          font-weight: 800;
          padding: 2px 8px;
          border-radius: 4px;
          letter-spacing: 0.5px;
          z-index: 2;
          box-shadow: 0 2px 4px rgba(0,0,0,0.5);
          display: flex;
          align-items: center;
          gap: 4px;
          text-transform: uppercase;
        }

        .live-dot {
          width: 6px;
          height: 6px;
          background-color: #ffffff;
          border-radius: 50%;
          display: inline-block;
          animation: pulse-live 1.2s infinite;
        }

        @keyframes pulse-live {
          0% {
            transform: scale(0.8);
            opacity: 0.5;
          }
          50% {
            transform: scale(1.2);
            opacity: 1;
          }
          100% {
            transform: scale(0.8);
            opacity: 0.5;
          }
        }

        .carousel-card-info {
          display: flex;
          flex-direction: column;
          gap: 2px;
          padding: 0 4px;
        }

        .carousel-card-title {
          font-size: 13px;
          font-weight: 700;
          color: #f3f4f6;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .carousel-card-year {
          font-size: 11px;
          color: #9ca3af;
        }

        .carousel-nav-btn {
          position: absolute;
          top: 50%;
          transform: translateY(-50%);
          width: 40px;
          height: 40px;
          border-radius: 50%;
          background-color: rgba(7, 7, 12, 0.85);
          border: 1px solid rgba(255,255,255,0.08);
          color: #ffffff;
          font-size: 24px;
          font-weight: 300;
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          z-index: 10;
          transition: all 0.2s;
          opacity: 0;
        }

        .category-row-relative:hover .carousel-nav-btn {
          opacity: 1;
        }

        .carousel-nav-btn:hover {
          background-color: #00f5d4;
          color: #07070c;
          border-color: #00f5d4;
        }

        .carousel-nav-btn.prev {
          left: -20px;
        }

        .carousel-nav-btn.next {
          right: -20px;
        }

        /* ALPHABET BAR */
        .alphabet-bar {
          display: flex;
          flex-wrap: wrap;
          gap: 6px;
          background-color: rgba(255,255,255,0.02);
          border: 1px solid rgba(255,255,255,0.05);
          padding: 12px;
          border-radius: 10px;
          margin-bottom: 30px;
        }

        .letter-btn {
          background-color: transparent;
          border: none;
          color: #9ca3af;
          font-size: 13px;
          font-weight: 700;
          padding: 6px 10px;
          border-radius: 6px;
          cursor: pointer;
          transition: all 0.15s;
          min-width: 32px;
          text-align: center;
        }

        .letter-btn:hover {
          color: #ffffff;
          background-color: rgba(255,255,255,0.06);
        }

        .letter-btn.active {
          background-color: #00f5d4;
          color: #07070c;
        }

        /* SEASONS & EPISODES PREMIUM GRID PANEL */
        .series-seasons-episodes-panel {
          background-color: #0c0d14;
          border: 1px solid rgba(255,255,255,0.04);
          border-radius: 12px;
          padding: 20px;
          margin-bottom: 25px;
          display: flex;
          flex-direction: column;
          gap: 20px;
        }

        .panel-label {
          font-family: 'Outfit', sans-serif;
          font-size: 14px;
          font-weight: 700;
          color: #9ca3af;
          text-transform: uppercase;
          letter-spacing: 0.5px;
        }

        .seasons-tab-container {
          display: flex;
          flex-direction: column;
          gap: 10px;
        }

        .seasons-tabs {
          display: flex;
          flex-wrap: wrap;
          gap: 8px;
        }

        .season-tab-btn {
          background-color: rgba(255,255,255,0.03);
          border: 1px solid rgba(255,255,255,0.05);
          color: #d1d5db;
          font-size: 13px;
          font-weight: 600;
          padding: 8px 16px;
          border-radius: 6px;
          cursor: pointer;
          transition: all 0.2s;
        }

        .season-tab-btn:hover {
          color: #ffffff;
          border-color: rgba(255,255,255,0.15);
        }

        .season-tab-btn.active {
          background-color: #00f5d4;
          border-color: #00f5d4;
          color: #07070c;
          font-weight: 700;
        }

        .episodes-grid-container {
          display: flex;
          flex-direction: column;
          gap: 12px;
          border-top: 1px solid rgba(255,255,255,0.04);
          padding-top: 15px;
        }

        .episodes-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          flex-wrap: wrap;
          gap: 10px;
        }

        .episodes-count-info {
          font-size: 13px;
          color: #00f5d4;
          font-weight: 600;
        }

        .episodes-buttons-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(110px, 1fr));
          gap: 10px;
        }

        .episode-btn {
          background-color: rgba(255,255,255,0.02);
          border: 1px solid rgba(255,255,255,0.04);
          color: #d1d5db;
          font-size: 12px;
          font-weight: 600;
          padding: 10px 6px;
          border-radius: 6px;
          cursor: pointer;
          transition: all 0.2s;
          text-align: center;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .episode-btn:hover {
          border-color: rgba(0, 245, 212, 0.4);
          background-color: rgba(0, 245, 212, 0.02);
          color: #00f5d4;
        }

        .episode-btn.active {
          background: linear-gradient(135deg, #00f5d4, #00b8ff);
          border-color: #00f5d4;
          color: #07070c;
          font-weight: 700;
          box-shadow: 0 4px 12px rgba(0, 245, 212, 0.2);
        }

        .loading-text {
          font-size: 13px;
          color: #9ca3af;
          font-style: italic;
        }

        /* PAGINATION & LOAD MORE */
        .load-more-container {
          display: flex;
          justify-content: center;
          margin-top: 30px;
          margin-bottom: 20px;
        }

        .load-more-btn {
          background-color: rgba(255,255,255,0.04);
          border: 1px solid rgba(255,255,255,0.08);
          color: #ffffff;
          font-family: 'Outfit', sans-serif;
          font-size: 14px;
          font-weight: 700;
          padding: 12px 32px;
          border-radius: 8px;
          cursor: pointer;
          transition: all 0.2s;
        }

        .load-more-btn:hover {
          background-color: #00f5d4;
          border-color: #00f5d4;
          color: #07070c;
          box-shadow: 0 4px 15px rgba(0, 245, 212, 0.3);
        }

        /* SECTION TITLES */
        .section-title {
          font-family: 'Outfit', sans-serif;
          font-size: 24px;
          font-weight: 700;
          color: #ffffff;
          margin: 0 0 20px 0;
        }

        @media (max-width: 768px) {
          .hero-banner {
            padding: 30px 20px;
            min-height: 380px;
          }
          .hero-title {
            font-size: 30px;
          }
          .hero-desc {
            font-size: 13px;
            -webkit-line-clamp: 3;
          }
          .header-tabs {
            margin-left: 15px;
            gap: 12px;
          }
          .header-tab-btn {
            font-size: 13px;
          }
          .episodes-buttons-grid {
            grid-template-columns: repeat(auto-fill, minmax(90px, 1fr));
          }
          .episode-btn {
            font-size: 11px;
            padding: 8px 4px;
          }
        }

        /* DETAILS MODAL NETFLIX-STYLE */
        .modal-overlay {
          position: fixed;
          top: 0;
          left: 0;
          width: 100vw;
          height: 100vh;
          background-color: rgba(0, 0, 0, 0.85);
          backdrop-filter: blur(8px);
          display: flex;
          justify-content: center;
          align-items: center;
          z-index: 2000;
          animation: modal-fade-in 0.25s ease-out forwards;
        }

        .modal-content-card {
          background-color: #0b0c10;
          border: 1px solid rgba(255, 255, 255, 0.08);
          border-radius: 16px;
          width: 90%;
          max-width: 780px;
          max-height: 85vh;
          overflow-y: auto;
          position: relative;
          box-shadow: 0 20px 50px rgba(0, 0, 0, 0.8), 0 0 30px rgba(0, 245, 212, 0.05);
          animation: modal-scale-up 0.3s cubic-bezier(0.16, 1, 0.3, 1) forwards;
          scrollbar-width: thin;
          scrollbar-color: rgba(255, 255, 255, 0.1) transparent;
        }

        .modal-content-card::-webkit-scrollbar {
          width: 4px;
        }

        .modal-content-card::-webkit-scrollbar-thumb {
          background: rgba(255, 255, 255, 0.1);
          border-radius: 4px;
        }

        .modal-close-btn {
          position: absolute;
          top: 15px;
          right: 15px;
          background-color: rgba(0, 0, 0, 0.6);
          border: 1px solid rgba(255, 255, 255, 0.1);
          color: #ffffff;
          width: 36px;
          height: 36px;
          border-radius: 50%;
          display: flex;
          justify-content: center;
          align-items: center;
          cursor: pointer;
          z-index: 100;
          font-size: 14px;
          font-weight: bold;
          transition: all 0.2s;
        }

        .modal-close-btn:hover {
          background-color: #ff3b30;
          border-color: #ff3b30;
          transform: scale(1.05);
        }

        .modal-hero-header {
          position: relative;
          height: 320px;
          background-size: cover;
          background-position: center;
          display: flex;
          align-items: flex-end;
          padding: 30px 40px;
          box-sizing: border-box;
        }

        .modal-hero-overlay {
          position: absolute;
          top: 0;
          left: 0;
          width: 100%;
          height: 100%;
          background: linear-gradient(to bottom, rgba(11, 12, 16, 0.1) 0%, rgba(11, 12, 16, 0.95) 100%);
          z-index: 1;
        }

        .modal-hero-title-box {
          position: relative;
          z-index: 2;
          width: 100%;
        }

        .modal-hero-title-box h2 {
          font-family: 'Outfit', sans-serif;
          font-size: 32px;
          font-weight: 900;
          margin: 10px 0 15px 0;
          color: #ffffff;
          line-height: 1.1;
        }

        .modal-meta-row {
          display: flex;
          gap: 15px;
          align-items: center;
          font-size: 13px;
          color: #9ca3af;
          margin-bottom: 20px;
        }

        .modal-genre-tag {
          background-color: rgba(255, 255, 255, 0.08);
          padding: 2px 8px;
          border-radius: 4px;
          color: #ffffff;
        }

        .modal-play-action-btn {
          background-color: #00f5d4;
          color: #07070c;
          border: none;
          font-family: 'Outfit', sans-serif;
          font-size: 14px;
          font-weight: 700;
          padding: 10px 24px;
          border-radius: 6px;
          cursor: pointer;
          transition: all 0.2s ease;
          box-shadow: 0 4px 15px rgba(0, 245, 212, 0.3);
        }

        .modal-play-action-btn:hover {
          transform: translateY(-2px);
          box-shadow: 0 6px 20px rgba(0, 245, 212, 0.5);
        }

        .modal-body-desc {
          padding: 20px 40px 40px 40px;
          display: flex;
          flex-direction: column;
          gap: 30px;
          box-sizing: border-box;
        }

        .modal-desc-column h3, .modal-cast-section h3 {
          font-family: 'Outfit', sans-serif;
          font-size: 16px;
          color: #00f5d4;
          margin: 0 0 10px 0;
          text-transform: uppercase;
          letter-spacing: 0.5px;
        }

        .modal-desc-column p {
          margin: 0;
          font-size: 14px;
          color: #d1d5db;
          line-height: 1.6;
        }

        /* CAST FLOW horizontal scroll */
        .modal-cast-section {
          display: flex;
          flex-direction: column;
          gap: 12px;
        }

        .cast-row-scroll {
          display: flex;
          gap: 14px;
          overflow-x: auto;
          padding-bottom: 10px;
          scrollbar-width: thin;
          scrollbar-color: rgba(255, 255, 255, 0.05) transparent;
        }

        .cast-row-scroll::-webkit-scrollbar {
          height: 4px;
        }

        .cast-row-scroll::-webkit-scrollbar-thumb {
          background: rgba(255, 255, 255, 0.05);
          border-radius: 4px;
        }

        .actor-card {
          flex: 0 0 85px;
          display: flex;
          flex-direction: column;
          align-items: center;
          text-align: center;
          gap: 6px;
          cursor: pointer;
          transition: transform 0.2s ease;
        }

        .actor-card:hover {
          transform: scale(1.05);
        }

        .actor-photo {
          width: 70px;
          height: 70px;
          border-radius: 50%;
          object-fit: cover;
          border: 2px solid rgba(255, 255, 255, 0.08);
          box-shadow: 0 4px 12px rgba(0,0,0,0.4);
          transition: border-color 0.2s, transform 0.2s;
        }

        .actor-card:hover .actor-photo {
          border-color: #00f5d4;
          transform: scale(1.05);
        }

        .actor-name {
          font-size: 10px;
          font-weight: 700;
          color: #f3f4f6;
          display: block;
          max-width: 80px;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .actor-character {
          font-size: 9px;
          color: #9ca3af;
          display: block;
          max-width: 80px;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .loading-cast-text, .no-cast-text {
          font-size: 12px;
          color: #6b7280;
          font-style: italic;
        }

        /* RECOMENDACIONES EN MODAL (TasteDive Style) */
        .modal-recs-section {
          margin-top: 24px;
          border-top: 1px solid rgba(255, 255, 255, 0.06);
          padding-top: 20px;
        }

        .modal-recs-section h3 {
          font-family: 'Outfit', sans-serif;
          font-size: 16px;
          font-weight: 700;
          color: #00f5d4;
          margin: 0 0 14px 0;
          text-transform: uppercase;
          letter-spacing: 0.5px;
        }

        .recs-row-scroll {
          display: flex;
          gap: 12px;
          overflow-x: auto;
          padding-bottom: 10px;
          scrollbar-width: thin;
          scrollbar-color: rgba(255, 255, 255, 0.05) transparent;
        }

        .recs-row-scroll::-webkit-scrollbar {
          height: 4px;
        }

        .recs-row-scroll::-webkit-scrollbar-thumb {
          background: rgba(255, 255, 255, 0.05);
          border-radius: 4px;
        }

        .rec-card {
          flex: 0 0 100px;
          width: 100px;
          min-width: 100px;
          max-width: 100px;
          cursor: pointer;
          transition: transform 0.3s cubic-bezier(0.16, 1, 0.3, 1);
          display: flex;
          flex-direction: column;
          gap: 4px;
        }

        .rec-card:hover {
          transform: translateY(-4px) scale(1.04);
        }

        .rec-poster-container {
          position: relative;
          width: 100%;
          aspect-ratio: 2/3;
          border-radius: 6px;
          overflow: hidden;
          background-color: #11131e;
          border: 1px solid rgba(255, 255, 255, 0.05);
        }

        .rec-poster {
          position: absolute;
          top: 0;
          left: 0;
          width: 100%;
          height: 100%;
          object-fit: cover;
        }

        .rec-rating {
          position: absolute;
          top: 4px;
          right: 4px;
          background-color: rgba(7, 7, 12, 0.85);
          color: #ffb800;
          font-size: 9px;
          font-weight: 700;
          padding: 1px 4px;
          border-radius: 3px;
        }

        .rec-title {
          font-size: 10px;
          font-weight: 700;
          color: #e5e7eb;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
          max-width: 100px;
        }

        .rec-year {
          font-size: 9px;
          color: #6b7280;
        }

        .loading-recs-text, .no-recs-text {
          font-size: 12px;
          color: #6b7280;
          font-style: italic;
        }

        @keyframes modal-fade-in {
          from { opacity: 0; }
          to { opacity: 1; }
        }

        @keyframes modal-scale-up {
          from { transform: scale(0.92); opacity: 0; }
          to { transform: scale(1); opacity: 1; }
        }

        /* YOUTUBE-STYLE LOADING PROGRESS BAR */
        .video-progress-loader-container {
          position: absolute;
          top: 0;
          left: 0;
          width: 100%;
          height: 3px;
          background-color: rgba(255, 255, 255, 0.05);
          z-index: 100;
        }

        .video-progress-loader-bar {
          height: 100%;
          width: 100%;
          background-color: #ff3b30; /* YouTube Red */
          animation: video-progress-anim 2s infinite linear;
          transform-origin: left;
        }

        @keyframes video-progress-anim {
          0% { transform: scaleX(0); }
          50% { transform: scaleX(0.7); }
          100% { transform: scaleX(1); }
        }

        /* PLAYBACK OPTIMIZATION BANNER */
        .playback-optimization-banner {
          display: flex;
          align-items: flex-start;
          gap: 12px;
          background-color: rgba(0, 245, 212, 0.04);
          border: 1px solid rgba(0, 245, 212, 0.15);
          border-radius: 8px;
          padding: 10px 14px;
          margin-top: 5px;
        }

        .playback-optimization-banner .banner-icon {
          font-weight: bold;
          font-size: 11px;
          color: #00f5d4;
          background-color: rgba(0, 245, 212, 0.12);
          border: 1px solid rgba(0, 245, 212, 0.2);
          padding: 2px 6px;
          border-radius: 4px;
          text-transform: uppercase;
        }

        .playback-optimization-banner .banner-text {
          font-size: 11px;
          line-height: 1.45;
          color: #9ca3af;
        }

        .playback-optimization-banner .banner-text strong {
          color: #ffffff;
        }
      `}</style>
      
      {/* MODAL DE DETALLES NETFLIX-STYLE */}
      {selectedItemDetails && (
        <div className="modal-overlay" onClick={() => setSelectedItemDetails(null)}>
          <div className="modal-content-card" onClick={(e) => e.stopPropagation()}>
            <button className="modal-close-btn" onClick={() => setSelectedItemDetails(null)}>✕</button>
            
            <div className="modal-hero-header" style={{ 
              backgroundImage: `linear-gradient(to bottom, rgba(11,12,16,0.2) 0%, rgba(11,12,16,0.95) 100%), url(${selectedItemDetails.poster || ''})` 
            }}>
              <div className="modal-hero-overlay"></div>
              <div className="modal-hero-title-box">
                <span className="rating-badge" style={{ position: 'relative', top: '0', right: '0', display: 'inline-block', marginBottom: '8px' }}>★ {selectedItemDetails.valoracion}</span>
                <h2>{selectedItemDetails.titulo}</h2>
                <div className="modal-meta-row">
                  <span>{selectedItemDetails.año || selectedItemDetails.año}</span>
                  <span className="modal-genre-tag">{selectedItemDetails.categoria}</span>
                  <span>{selectedItemDetails.tipo === 'serie' ? 'Serie de TV' : 'Película'}</span>
                </div>
                <button className="modal-play-action-btn" onClick={() => {
                  setActiveItem(selectedItemDetails);
                  setSelectedItemDetails(null);
                }}>
                  Reproducir Ahora
                </button>
              </div>
            </div>

            <div className="modal-body-desc">
              <div className="modal-desc-column">
                <h3>Sinopsis</h3>
                <p>{selectedItemDetails.descripcion}</p>
              </div>
              
              {/* ELENCO / CAST SECTION */}
              <div className="modal-cast-section">
                <h3>Elenco / Actores</h3>
                {loadingCast ? (
                  <div className="loading-cast-text">Cargando elenco...</div>
                ) : castInfo.length > 0 ? (
                  <div className="cast-row-scroll">
                    {castInfo.map((actor) => (
                      <div key={actor.id} className="actor-card">
                        <img src={actor.profileUrl} alt={actor.name} className="actor-photo" loading="lazy" />
                        <span className="actor-name">{actor.name}</span>
                        <span className="actor-character">{actor.character}</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="no-cast-text">Información de elenco no disponible.</div>
                )}
              </div>

              {/* RECOMENDACIONES SECTION */}
              <div className="modal-recs-section">
                <h3>Recomendaciones (Estilo TasteDive)</h3>
                {loadingRecs ? (
                  <div className="loading-recs-text">Cargando recomendaciones...</div>
                ) : recommendations.length > 0 ? (
                  <div className="recs-row-scroll">
                    {recommendations.map((rec) => (
                      <div 
                        key={rec.id} 
                        className="rec-card" 
                        onClick={() => setSelectedItemDetails(rec)}
                      >
                        <div className="rec-poster-container">
                          <img src={rec.poster} alt={rec.titulo} className="rec-poster" loading="lazy" />
                          <span className="rec-rating">★ {rec.valoracion}</span>
                        </div>
                        <span className="rec-title">{rec.titulo}</span>
                        <span className="rec-year">{rec.año}</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="no-recs-text">No hay recomendaciones disponibles para este contenido.</div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// Componente del Chat en Vivo (Watch Party) vía MQTT
function ChatBox({ channelId, channelTitle, isCollapsed, onToggleCollapse }) {
  const getSenderColor = (name) => {
    const colors = [
      '#38bdf8', // sky-400
      '#f472b6', // pink-400
      '#fb7185', // rose-400
      '#34d399', // emerald-400
      '#a78bfa', // violet-400
      '#fb923c', // orange-400
      '#facc15', // yellow-400
      '#2dd4bf'  // teal-400
    ];
    let hash = 0;
    for (let i = 0; i < name.length; i++) {
      hash = name.charCodeAt(i) + ((hash << 5) - hash);
    }
    return colors[Math.abs(hash) % colors.length];
  };

  const [messages, setMessages] = useState([]);
  const [inputText, setInputText] = useState('');
  const [nickname, setNickname] = useState('');
  const [isJoined, setIsJoined] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);

  // Estados de auto-scroll inteligente
  const [shouldAutoScroll, setShouldAutoScroll] = useState(true);
  const [showScrollBottomBadge, setShowScrollBottomBadge] = useState(false);

  const clientRef = useRef(null);
  const messagesEndRef = useRef(null);
  const emojiPickerRef = useRef(null);
  const chatMessagesBoxRef = useRef(null); // Ref al contenedor de mensajes

  // Emojis estáticos ligeros para la Watch Party
  const emojis = ['😀', '😂', '😍', '😮', '😢', '👍', '👎', '🔥', '👏', '🎉', '❤️', '✨', '🎬', '🍿', '😮‍💨', '🙌'];

  useEffect(() => {
    const defaultNick = 'Usuario_' + Math.floor(1000 + Math.random() * 9000);
    setNickname(defaultNick);
  }, []);

  // Manejar el scroll del usuario para activar/desactivar auto-scroll
  const handleScroll = () => {
    const container = chatMessagesBoxRef.current;
    if (!container) return;
    
    // Si la diferencia es menor o igual a 45px, el usuario está al final
    const isAtBottom = container.scrollHeight - container.scrollTop - container.clientHeight <= 45;
    setShouldAutoScroll(isAtBottom);
    
    if (isAtBottom) {
      setShowScrollBottomBadge(false);
    }
  };

  // Forzar scroll al final
  const handleScrollToBottom = () => {
    const container = chatMessagesBoxRef.current;
    if (container) {
      container.scrollTop = container.scrollHeight;
    }
    setShouldAutoScroll(true);
    setShowScrollBottomBadge(false);
  };

  // Scroll inteligente cuando llegan nuevos mensajes
  useEffect(() => {
    const container = chatMessagesBoxRef.current;
    if (!container) return;

    if (shouldAutoScroll) {
      container.scrollTop = container.scrollHeight;
      setShowScrollBottomBadge(false);
    } else {
      setShowScrollBottomBadge(true);
    }
  }, [messages]);

  // Cerrar el selector de emojis si se hace clic fuera del popover
  useEffect(() => {
    function handleClickOutside(event) {
      if (emojiPickerRef.current && !emojiPickerRef.current.contains(event.target)) {
        setShowEmojiPicker(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  // Manejar conexión MQTT Paho
  useEffect(() => {
    let active = true;
    
    if (!window.Paho) {
      const script = document.createElement('script');
      script.src = 'https://cdnjs.cloudflare.com/ajax/libs/paho-mqtt/1.0.1/mqttws31.min.js';
      script.async = true;
      script.onload = () => {
        if (active) iniciarConexion();
      };
      document.body.appendChild(script);
    } else {
      iniciarConexion();
    }

    function iniciarConexion() {
      if (!window.Paho || clientRef.current) return;

      try {
        const clientId = 'filmtv_client_' + Math.random().toString(16).substring(2, 10);
        const client = new window.Paho.MQTT.Client('broker.hivemq.com', Number(8884), '/mqtt', clientId);
        clientRef.current = client;

        client.onConnectionLost = (responseObject) => {
          setIsConnected(false);
          if (responseObject.errorCode !== 0) {
            console.log("Chat perdido: " + responseObject.errorMessage);
          }
        };

        client.onMessageArrived = (message) => {
          try {
            const data = JSON.parse(message.payloadString);
            if (active) {
              setMessages(prev => [...prev, data].slice(-100)); // Limitar a 100 mensajes en memoria
            }
          } catch (e) {
            console.error("Mensaje JSON corrupto:", e);
          }
        };

        client.connect({
          onSuccess: () => {
            setIsConnected(true);
            const cleanChannel = (channelId || 'general').toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]/g, '_');
            const topic = `filmtv/chat/${cleanChannel}`;
            client.subscribe(topic);
          },
          useSSL: true,
          onFailure: (err) => {
            console.error("Conexión de chat fallida:", err);
          }
        });
      } catch (err) {
        console.error("Fallo de MQTT:", err);
      }
    }

    return () => {
      active = false;
      if (clientRef.current) {
        try {
          clientRef.current.disconnect();
        } catch (e) {}
        clientRef.current = null;
      }
    };
  }, [channelId]);

  const handleSendMessage = (e) => {
    e.preventDefault();
    if (!inputText.trim() || !clientRef.current || !isConnected) return;

    const messageData = {
      sender: nickname || 'Usuario',
      text: inputText.trim(),
      timestamp: new Date().toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })
    };

    try {
      const cleanChannel = (channelId || 'general').toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]/g, '_');
      const topic = `filmtv/chat/${cleanChannel}`;
      const message = new window.Paho.MQTT.Message(JSON.stringify(messageData));
      message.destinationName = topic;
      clientRef.current.send(message);
      setInputText('');
    } catch (err) {
      console.error("Fallo al transmitir mensaje:", err);
    }
  };

  const appendEmoji = (emoji) => {
    setInputText(prev => prev + emoji);
  };

  return (
    <div className={`chat-container ${isCollapsed ? 'collapsed' : ''}`}>
      <div className="chat-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span className="chat-title">Watch Party</span>
          <span className={`status-indicator ${isConnected ? 'online' : 'offline'}`}>
            {isConnected ? 'Activo' : 'Cargando'}
          </span>
        </div>
        <button onClick={onToggleCollapse} className="chat-toggle-btn" aria-label="Alternar Chat">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ transform: isCollapsed ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.3s ease' }}>
            <polyline points="6 9 12 15 18 9"></polyline>
          </svg>
        </button>
      </div>

      {!isJoined ? (
        <div className="chat-gate">
          <p>Chatea en tiempo real con otras personas que están viendo este mismo contenido.</p>
          <input
            type="text"
            placeholder="Introduce tu alias..."
            value={nickname}
            onChange={(e) => setNickname(e.target.value.substring(0, 15))}
            className="gate-input"
          />
          <button
            onClick={() => nickname.trim() && setIsJoined(true)}
            className="gate-btn"
          >
            Unirse a la sala
          </button>
        </div>
      ) : (
        <>
          {/* Caja de mensajes */}
          <div 
            className="chat-messages-box" 
            ref={chatMessagesBoxRef} 
            onScroll={handleScroll}
          >
            {messages.length === 0 ? (
              <div className="chat-empty">
                Sala vacía. Escribe un mensaje para iniciar la conversación.
              </div>
            ) : (
              messages.map((msg, idx) => (
                <div 
                  key={idx} 
                  className={`chat-message ${msg.sender === nickname ? 'mine' : ''}`}
                >
                  <div className="message-header">
                    <span className="message-sender" style={{ color: getSenderColor(msg.sender) }}>{msg.sender}</span>
                    <span className="message-time">{msg.timestamp}</span>
                  </div>
                  <div className="message-text">{msg.text}</div>
                </div>
              ))
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Botón flotante indicando nuevos mensajes si el usuario subió el scroll */}
          {showScrollBottomBadge && (
            <button 
              type="button" 
              onClick={handleScrollToBottom} 
              className="scroll-bottom-badge"
            >
              Nuevos comentarios ↓
            </button>
          )}

          {/* Formulario de envío con Emoji Picker nativo */}
          <form onSubmit={handleSendMessage} className="chat-form">
            <div className="input-row">
              {/* Botón de Emoji Picker */}
              <div className="emoji-picker-container" ref={emojiPickerRef}>
                <button
                  type="button"
                  onClick={() => setShowEmojiPicker(!showEmojiPicker)}
                  className="emoji-trigger-btn"
                >
                  😀
                </button>
                
                {showEmojiPicker && (
                  <div className="emoji-popover">
                    <div className="emoji-grid">
                      {emojis.map((emoji, index) => (
                        <button
                          key={index}
                          type="button"
                          onClick={() => appendEmoji(emoji)}
                          className="emoji-select-btn"
                        >
                          {emoji}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              <input
                type="text"
                placeholder="Escribe algo..."
                value={inputText}
                onChange={(e) => setInputText(e.target.value.substring(0, 120))}
                className="chat-input-field"
              />
              
              <button
                type="submit"
                disabled={!isConnected}
                className="chat-submit-btn"
              >
                Enviar
              </button>
            </div>
          </form>
        </>
      )}

      <style jsx>{`
        .chat-container {
          display: flex;
          flex-direction: column;
          height: 100%;
          background: linear-gradient(135deg, rgba(12, 13, 20, 0.94) 0%, rgba(19, 21, 35, 0.97) 100%);
          backdrop-filter: blur(16px);
          -webkit-backdrop-filter: blur(16px);
          border: 1px solid rgba(0, 245, 212, 0.08);
          border-radius: 12px;
          overflow: hidden;
          position: relative;
          box-shadow: 0 10px 30px rgba(0, 0, 0, 0.5);
          transition: all 0.3s cubic-bezier(0.16, 1, 0.3, 1);
        }

        .chat-container.collapsed {
          height: 48px !important;
          max-height: 48px !important;
        }

        .chat-container.collapsed .chat-messages-box,
        .chat-container.collapsed .chat-form,
        .chat-container.collapsed .chat-gate {
          display: none !important;
        }

        .scroll-bottom-badge {
          position: absolute;
          bottom: 65px;
          left: 50%;
          transform: translateX(-50%);
          background-color: #00f5d4;
          color: #07070c;
          font-size: 11px;
          font-weight: 700;
          padding: 6px 14px;
          border-radius: 20px;
          cursor: pointer;
          box-shadow: 0 4px 15px rgba(0, 245, 212, 0.4);
          transition: all 0.2s ease;
          z-index: 100;
          border: none;
          text-transform: uppercase;
          letter-spacing: 0.5px;
        }

        .scroll-bottom-badge:hover {
          transform: translateX(-50%) translateY(-2px);
          box-shadow: 0 6px 20px rgba(0, 245, 212, 0.6);
        }

        .chat-header {
          padding: 12px 16px;
          background-color: rgba(12, 13, 20, 0.5);
          border-bottom: 1px solid rgba(255, 255, 255, 0.05);
          display: flex;
          justify-content: space-between;
          align-items: center;
          height: 48px;
          box-sizing: border-box;
        }

        .chat-title {
          font-family: 'Outfit', sans-serif;
          font-size: 13px;
          font-weight: 700;
          color: #ffffff;
          letter-spacing: 0.5px;
          text-transform: uppercase;
        }

        .status-indicator {
          font-size: 10px;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.5px;
        }

        .status-indicator.online {
          color: #00f5d4;
        }

        .status-indicator.offline {
          color: #ff3b30;
        }

        .chat-toggle-btn {
          background: transparent;
          border: none;
          color: #9ca3af;
          cursor: pointer;
          padding: 4px;
          display: flex;
          align-items: center;
          justify-content: center;
          border-radius: 4px;
          transition: background-color 0.2s, color 0.2s;
        }

        .chat-toggle-btn:hover {
          background-color: rgba(255, 255, 255, 0.08);
          color: #ffffff;
        }

        .chat-gate {
          flex: 1;
          display: flex;
          flex-direction: column;
          justify-content: center;
          align-items: center;
          padding: 24px;
          text-align: center;
          gap: 14px;
        }

        .chat-gate p {
          font-size: 12px;
          color: #9ca3af;
          line-height: 1.6;
          margin: 0 0 10px 0;
          max-width: 85%;
        }

        .gate-input {
          width: 80%;
          padding: 10px 14px;
          border-radius: 8px;
          border: 1px solid rgba(255, 255, 255, 0.08);
          background-color: rgba(255, 255, 255, 0.04);
          color: #ffffff;
          font-size: 13px;
          outline: none;
          text-align: center;
          transition: all 0.2s;
        }

        .gate-input:focus {
          border-color: #00f5d4;
        }

        .gate-btn {
          width: 80%;
          background-color: #00f5d4;
          border: none;
          color: #07070c;
          font-weight: 700;
          padding: 10px;
          border-radius: 8px;
          cursor: pointer;
          font-size: 13px;
          transition: all 0.2s;
        }

        .gate-btn:hover {
          opacity: 0.9;
        }

        .chat-messages-box {
          flex: 1;
          overflow-y: auto;
          padding: 16px;
          display: flex;
          flex-direction: column;
          gap: 12px;
          scrollbar-width: thin;
          scrollbar-color: rgba(255, 255, 255, 0.05) transparent;
        }

        .chat-messages-box::-webkit-scrollbar {
          width: 4px;
        }

        .chat-messages-box::-webkit-scrollbar-thumb {
          background: rgba(255, 255, 255, 0.05);
          border-radius: 4px;
        }

        .chat-empty {
          color: #4b5563;
          text-align: center;
          margin-top: 40px;
          font-size: 12px;
        }

        @keyframes chat-msg-fade {
          from {
            opacity: 0;
            transform: translateY(12px) scale(0.97);
          }
          to {
            opacity: 1;
            transform: translateY(0) scale(1);
          }
        }

        .chat-message {
          background-color: rgba(255, 255, 255, 0.02);
          border: 1px solid rgba(255, 255, 255, 0.03);
          padding: 10px 14px;
          border-radius: 12px;
          align-self: flex-start;
          max-width: 90%;
          border-bottom-left-radius: 2px;
          animation: chat-msg-fade 0.35s cubic-bezier(0.16, 1, 0.3, 1) forwards;
          box-shadow: 0 4px 10px rgba(0,0,0,0.15);
          transition: transform 0.2s ease;
        }

        .chat-message:hover {
          transform: scale(1.01);
        }

        .chat-message.mine {
          background: linear-gradient(135deg, rgba(0, 245, 212, 0.08) 0%, rgba(0, 245, 212, 0.03) 100%);
          border-color: rgba(0, 245, 212, 0.2);
          align-self: flex-end;
          border-bottom-left-radius: 12px;
          border-bottom-right-radius: 2px;
        }

        .message-header {
          display: flex;
          justify-content: space-between;
          gap: 15px;
          font-size: 10px;
          margin-bottom: 4px;
        }

        .message-sender {
          font-weight: 700;
        }

        .message-time {
          color: #4b5563;
        }

        .message-text {
          color: #e5e7eb;
          font-size: 12px;
          word-break: break-all;
          line-height: 1.4;
        }

        .chat-form {
          padding: 10px 12px;
          background-color: rgba(12, 13, 20, 0.6);
          border-top: 1px solid rgba(255, 255, 255, 0.05);
        }

        .input-row {
          display: flex;
          align-items: center;
          gap: 8px;
          position: relative;
        }

        .emoji-picker-container {
          position: relative;
        }

        .emoji-trigger-btn {
          background: transparent;
          border: none;
          font-size: 18px;
          cursor: pointer;
          padding: 4px;
          display: flex;
          align-items: center;
          justify-content: center;
          border-radius: 4px;
          transition: background-color 0.2s;
        }

        .emoji-trigger-btn:hover {
          background-color: rgba(255, 255, 255, 0.08);
        }

        .emoji-popover {
          position: absolute;
          bottom: 40px;
          left: 0;
          background-color: #0e0f17;
          border: 1px solid rgba(0, 245, 212, 0.3);
          border-radius: 8px;
          padding: 8px;
          z-index: 1000;
          box-shadow: 0 8px 30px rgba(0, 0, 0, 0.8);
          width: 160px;
        }

        .emoji-grid {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 6px;
        }

        .emoji-select-btn {
          background: transparent;
          border: none;
          font-size: 16px;
          cursor: pointer;
          padding: 4px;
          border-radius: 4px;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: background-color 0.15s;
        }

        .emoji-select-btn:hover {
          background-color: rgba(255, 255, 255, 0.08);
        }

        .chat-input-field {
          flex: 1;
          padding: 8px 12px;
          background-color: rgba(5, 5, 8, 0.6);
          border: 1px solid rgba(255, 255, 255, 0.08);
          border-radius: 8px;
          color: #ffffff;
          font-size: 13px;
          outline: none;
          box-sizing: border-box;
          transition: border-color 0.2s;
        }

        .chat-input-field:focus {
          border-color: #00f5d4;
        }

        .chat-submit-btn {
          background-color: #00f5d4;
          border: none;
          color: #07070c;
          font-weight: 700;
          font-size: 12px;
          padding: 8px 16px;
          border-radius: 8px;
          cursor: pointer;
          transition: all 0.2s;
        }

        .chat-submit-btn:hover:not(:disabled) {
          opacity: 0.9;
        }

        .chat-submit-btn:disabled {
          background-color: #1f2937;
          color: #4b5563;
          cursor: default;
        }
      `}</style>
    </div>
  );
}
