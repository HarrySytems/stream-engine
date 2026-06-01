"use client";

import { useState, useEffect, useRef, useMemo } from 'react';

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

const getYouTubeId = (url) => {
  if (!url) return null;
  const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|\&v=|\/live\/)([^#\&\?]*).*/;
  const match = url.match(regExp);
  return (match && match[2].length === 11) ? match[2] : null;
};

const isYouTubeUrl = (url) => {
  if (!url) return false;
  return url.includes('youtube.com') || url.includes('youtu.be') || url.includes('youtube-nocookie.com');
};

const getMangaTitle = (manga) => {
  if (!manga || !manga.attributes || !manga.attributes.title) return 'Sin título';
  const titleObj = manga.attributes.title;
  return titleObj.es || titleObj.en || titleObj['ja-ro'] || titleObj['ko-ro'] || Object.values(titleObj)[0] || 'Sin título';
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
  const [tmdbSearchResults, setTmdbSearchResults] = useState([]);
  const [loadingTmdbSearch, setLoadingTmdbSearch] = useState(false);

  // ESTADOS DE MANGA
  const [mangaSearchQuery, setMangaSearchQuery] = useState('');
  const [mangas, setMangas] = useState([]);
  const [loadingMangas, setLoadingMangas] = useState(false);
  const [mangaOffset, setMangaOffset] = useState(0);
  const [hasMoreMangas, setHasMoreMangas] = useState(true);
  const [selectedManga, setSelectedManga] = useState(null);
  const [mangaChapters, setMangaChapters] = useState([]);
  const [loadingChapters, setLoadingChapters] = useState(false);
  const [mangaLanguage, setMangaLanguage] = useState('es'); // 'es' o 'en'
  const [activeChapter, setActiveChapter] = useState(null);
  const [chapterPages, setChapterPages] = useState([]);
  const [loadingPages, setLoadingPages] = useState(false);
  const [mangaReaderMode, setMangaReaderMode] = useState('single'); // 'single', 'double' o 'vertical'
  const [currentMangaPage, setCurrentMangaPage] = useState(0);
  const [isMangaFullscreen, setIsMangaFullscreen] = useState(false);

  const [cuevanaServers, setCuevanaServers] = useState([]);
  const [loadingCuevana, setLoadingCuevana] = useState(false);
  
  // Pestaña activa ('inicio', 'peliculas', 'series', 'anime', 'documentales', 'youtube', 'tdt', 'free', 'favoritos')
  const [activeTab, setActiveTab] = useState('inicio');
  const [tdtFilter, setTdtFilter] = useState('Todos');

  const videoRef = useRef(null);
  const hlsRef = useRef(null);

  // Nuevos estados para favoritos, sidebar responsive, cookies consentimiento y trailers
  const [favorites, setFavorites] = useState([]);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [showCookieBanner, setShowCookieBanner] = useState(false);
  const [trailerKey, setTrailerKey] = useState(null);
  const [showTrailerModal, setShowTrailerModal] = useState(false);
  const [loadingTrailer, setLoadingTrailer] = useState(false);

  const [animeLimit, setAnimeLimit] = useState(32);
  const [docLimit, setDocLimit] = useState(32);
  const [ytLimit, setYtLimit] = useState(32);

  // Efecto para inicializar el reproductor HLS para canales en vivo
  useEffect(() => {
    let active = true;
    if (activeItem && activeItem.tipo === 'canal' && !isYouTubeUrl(activeItem.url) && videoRef.current) {
      const video = videoRef.current;
      const streamUrl = `${window.location.origin}/api/proxy?url=${encodeURIComponent(activeItem.url)}`;

      const initHls = async () => {
        try {
          const Hls = (await import('hls.js')).default;
          if (!active) return;
          
          if (hlsRef.current) {
            hlsRef.current.destroy();
          }

          if (Hls.isSupported()) {
            const hls = new Hls({
              maxBufferSize: 60 * 1024 * 1024,
              maxBufferLength: 60,
              maxMaxBufferLength: 120,
              liveSyncDurationCount: 6,
              enableWorker: true,
              lowLatencyMode: false
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

  // Cargar Favoritos y Consentimiento de Cookies
  useEffect(() => {
    const stored = localStorage.getItem('filmtv_favorites');
    if (stored) {
      try {
        setFavorites(JSON.parse(stored));
      } catch (e) {
        console.error("Error al cargar favoritos:", e);
      }
    }
    const consent = localStorage.getItem('filmtv_cookie_consent');
    if (!consent) {
      setShowCookieBanner(true);
    }
  }, []);

  // Forzar repintado de iframe al volver a enfocar la pestaña (evita congelación de video con sonido activo)
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        const iframes = document.querySelectorAll('.player-iframe');
        iframes.forEach(iframe => {
          const originalDisplay = iframe.style.display || 'block';
          iframe.style.display = 'none';
          void iframe.offsetHeight; // Forzar reflow
          iframe.style.display = originalDisplay;

          const originalTransform = iframe.style.transform || 'none';
          iframe.style.transform = 'scale(0.999)';
          setTimeout(() => {
            iframe.style.transform = originalTransform;
          }, 50);
        });
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, []);

  const toggleFavorite = (item) => {
    let updated;
    if (favorites.some(fav => fav.id === item.id)) {
      updated = favorites.filter(fav => fav.id !== item.id);
    } else {
      updated = [...favorites, item];
    }
    setFavorites(updated);
    localStorage.setItem('filmtv_favorites', JSON.stringify(updated));
  };

  const playTrailer = (item) => {
    if (!item.tmdbId) return;
    setLoadingTrailer(true);
    const mediaType = item.tipo === 'serie' ? 'tv' : 'movie';
    fetch(`https://api.themoviedb.org/3/${mediaType}/${item.tmdbId}/videos?api_key=04c35731a5ee918f014970082a0088b1&language=es-MX`)
      .then(res => res.json())
      .then(data => {
        let video = data.results?.find(v => v.type === 'Trailer' && v.site === 'YouTube');
        if (!video) video = data.results?.find(v => v.site === 'YouTube');
        if (video) {
          setTrailerKey(video.key);
          setShowTrailerModal(true);
        } else {
          return fetch(`https://api.themoviedb.org/3/${mediaType}/${item.tmdbId}/videos?api_key=04c35731a5ee918f014970082a0088b1`)
            .then(res => res.json())
            .then(dataEn => {
              const videoEn = dataEn.results?.find(v => v.type === 'Trailer' && v.site === 'YouTube') || dataEn.results?.find(v => v.site === 'YouTube');
              if (videoEn) {
                setTrailerKey(videoEn.key);
                setShowTrailerModal(true);
              } else {
                alert("Trailer no disponible.");
              }
            });
        }
      })
      .catch(err => {
        console.error("Error al obtener trailer:", err);
        alert("Error al cargar el trailer.");
      })
      .finally(() => {
        setLoadingTrailer(false);
      });
  };

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
      name: 'Servidor 3 (VidSrc.to)',
      url: (tmdbId, imdbId, type, s, e) => 
        type === 'pelicula' 
          ? `https://vidsrc.to/embed/movie/${tmdbId}`
          : `https://vidsrc.to/embed/tv/${tmdbId}/${s}/${e}`
    },
    {
      name: 'Servidor 4 (VidSrc.me / xyz)',
      url: (tmdbId, imdbId, type, s, e) => 
        type === 'pelicula' 
          ? `https://vidsrc.xyz/embed/movie?tmdb=${tmdbId}`
          : `https://vidsrc.xyz/embed/tv?tmdb=${tmdbId}&sea=${s}&epi=${e}`
    },
    {
      name: 'Servidor 5 (VidSrc.pm)',
      url: (tmdbId, imdbId, type, s, e) => 
        type === 'pelicula' 
          ? `https://vidsrc.pm/embed/movie/${tmdbId}`
          : `https://vidsrc.pm/embed/tv/${tmdbId}/${s}/${e}`
    },
    {
      name: 'Servidor 6 (Embed.su)',
      url: (tmdbId, imdbId, type, s, e) => 
        type === 'pelicula' 
          ? `https://embed.su/embed/movie/${tmdbId}`
          : `https://embed.su/embed/tv/${tmdbId}/${s}/${e}`
    },
    {
      name: 'Servidor 7 (SmashyStream)',
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
    if (!activeItem || activeItem.tipo === 'canal' || !activeItem.tmdbId) {
      setCuevanaServers([]);
      setLoadingCuevana(false);
      return;
    }

    setLoadingCuevana(true);
    
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
        if (host.includes('uqload')) return 'Uqload';
        if (host.includes('mega')) return 'Mega';
        if (host.includes('streamwish') || host.includes('awish')) return 'Streamwish';
        if (host.includes('mp4upload')) return 'Mp4upload';
        if (host.includes('fembed') || host.includes('feurl')) return 'Fembed';
      } catch (e) {}
      return "Online";
    };

    const cleanTitle = (title) => {
      return title
        .toLowerCase()
        .normalize("NFD")
        .replace(/[̀-ͯ]/g, "")
        .replace(/[^a-z0-9\s]/g, '')
        .trim();
    };

    const isValidMatch = (query, candidate) => {
      if (!query || !candidate) return false;
      const qWords = cleanTitle(query).split(/\s+/).filter(w => w.length > 3);
      const cWords = cleanTitle(candidate).split(/\s+/).filter(w => w.length > 3);
      
      if (qWords.length === 0) return true;
      
      const matches = qWords.filter(w => cWords.includes(w));
      
      if (qWords.length <= 2) {
        return matches.length === qWords.length;
      }
      
      return (matches.length / qWords.length) >= 0.5;
    };

    const tituloOriginal = activeItem.titulo;
    const originalTitle = tmdbData ? (tmdbData.original_title || tmdbData.original_name) : null;
    const postType = activeItem.categoria === 'Anime' ? 'animes' : (activeItem.tipo === 'serie' ? 'tvshows' : 'movies');

    const extractTitles = (title) => {
      if (!title) return [];
      const list = [title];
      // Si el título contiene paréntesis, e.g. "Attack on Titan (Ataque a los Titanes)"
      const match = title.match(/^([^(]+)\(([^)]+)\)/);
      if (match) {
        list.push(match[1].trim());
        list.push(match[2].trim());
      }
      return list;
    };

    // Función para obtener reproductores de un proveedor y título específico
    const fetchFromProvider = async (provider, titleToSearch) => {
      try {
        if (provider === 'tioanime') {
          const searchRes = await fetch(`/api/anime?action=search&q=${encodeURIComponent(titleToSearch)}`);
          if (!searchRes.ok) return [];
          const searchData = await searchRes.json();
          if (searchData.error || !searchData.results || searchData.results.length === 0) {
            return [];
          }

          const cleanedQuery = cleanTitle(titleToSearch);
          let matchedPost = searchData.results.find(p => cleanTitle(p.title).includes(cleanedQuery) || cleanedQuery.includes(cleanTitle(p.title)));
          if (!matchedPost) {
            if (searchData.results[0] && isValidMatch(titleToSearch, searchData.results[0].title)) {
              matchedPost = searchData.results[0];
            }
          }

          if (!matchedPost) return [];
          const slug = matchedPost.slug;
          const epsRes = await fetch(`/api/anime?action=episodes&slug=${slug}`);
          if (!epsRes.ok) return [];
          const epsData = await epsRes.json();
          if (epsData.error || !epsData.episodes || epsData.episodes.length === 0) {
            return [];
          }

          const matchedEpisode = epsData.episodes.find(ep => ep.number === episode);
          if (!matchedEpisode) {
            return [];
          }

          const playerRes = await fetch(`/api/anime?action=player&slug=${slug}&episode=${episode}`);
          if (!playerRes.ok) return [];
          const playerData = await playerRes.json();
          if (playerData.error || !playerData.embeds) {
            return [];
          }
          return playerData.embeds;
        }

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
          if (posts[0] && isValidMatch(titleToSearch, posts[0].title)) {
            matchedPost = posts[0];
          }
        }

        if (!matchedPost) return [];
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
        console.error(`Error buscando en ${provider} con "${titleToSearch}":`, err.message);
        return [];
      }
    };

    // Lanzar búsquedas en paralelo para Cuevana y LaMovie, con fallbacks de títulos en inglés y traducciones
    const runSearch = async () => {
      const searchTitles = [];
      extractTitles(tituloOriginal).forEach(t => {
        if (!searchTitles.includes(t)) searchTitles.push(t);
      });
      if (originalTitle) {
        extractTitles(originalTitle).forEach(t => {
          if (!searchTitles.includes(t)) searchTitles.push(t);
        });
      }

      let cuevanaEmbeds = [];
      let lamovieEmbeds = [];
      let tioAnimeEmbeds = [];

      for (const titleCandidate of searchTitles) {
        if (cuevanaEmbeds.length === 0) {
          cuevanaEmbeds = await fetchFromProvider('cuevana', titleCandidate);
        }
        if (lamovieEmbeds.length === 0) {
          lamovieEmbeds = await fetchFromProvider('lamovie', titleCandidate);
        }
        if (activeItem.categoria === 'Anime' && tioAnimeEmbeds.length === 0) {
          tioAnimeEmbeds = await fetchFromProvider('tioanime', titleCandidate);
        }
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

      const tioAnimeServersList = tioAnimeEmbeds
        .filter(emb => emb.url)
        .map(emb => ({
          name: `Anime - ${getServerName(emb.url)} (TioAnime)`,
          url: emb.url
        }));

      // Fusionar y dedupicar por URL del reproductor
      const combined = [...cuevanaServersList, ...lamovieServersList, ...tioAnimeServersList];
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
    if (!activeItem || activeItem.tipo !== 'serie' || !activeItem.tmdbId) {
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
      .filter(p => p.tipo === 'pelicula' && p.categoria !== 'Anime' && p.categoria !== 'Documentales' && p.categoria !== 'YouTube' && parseInt(p.año) >= 2020 && parseInt(p.año) <= 2026)
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
      .filter(p => p.tipo === 'serie' && p.categoria !== 'Anime' && p.categoria !== 'Documentales' && p.categoria !== 'YouTube' && parseInt(p.año) >= 2020 && parseInt(p.año) <= 2026)
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
      const normalized = firstChar.normalize("NFD").replace(/[̀-ͯ]/g, "");
      return normalized === letter;
    });
  };

  // Memoized lists to eliminate CPU/Render Lag
  const estrenosPeliculas = useMemo(() => getEstrenosPeliculas(peliculas), [peliculas]);
  const estrenosSeries = useMemo(() => getEstrenosSeries(peliculas), [peliculas]);
  const topAccion = useMemo(() => getTop15(peliculas.filter(p => p.tipo === 'pelicula' && p.categoria === 'Acción')), [peliculas]);
  const topCienciaFiccion = useMemo(() => getTop15(peliculas.filter(p => p.tipo === 'pelicula' && p.categoria === 'Ciencia Ficción')), [peliculas]);
  const topTerror = useMemo(() => getTop15(peliculas.filter(p => p.tipo === 'pelicula' && p.categoria === 'Terror')), [peliculas]);
  const topComedia = useMemo(() => getTop15(peliculas.filter(p => p.tipo === 'pelicula' && p.categoria === 'Comedia')), [peliculas]);
  const topDrama = useMemo(() => getTop15(peliculas.filter(p => p.tipo === 'pelicula' && p.categoria === 'Drama')), [peliculas]);
  const topInfantil = useMemo(() => getTop15(peliculas.filter(p => p.tipo === 'pelicula' && p.categoria === 'Infantil')), [peliculas]);
  const topSeries = useMemo(() => getTop15(peliculas.filter(p => p.tipo === 'serie' && p.categoria !== 'Anime' && p.categoria !== 'Documentales')), [peliculas]);

  // Memoized lists for the new sections
  const animeItems = useMemo(() => peliculas.filter(p => p.categoria === 'Anime'), [peliculas]);
  const documentalItems = useMemo(() => peliculas.filter(p => p.categoria === 'Documentales'), [peliculas]);
  const youtubeItems = useMemo(() => peliculas.filter(p => p.categoria === 'YouTube'), [peliculas]);
  const recomendadas = useMemo(() => {
    return [...peliculas]
      .filter(p => p.categoria !== 'YouTube')
      .sort((a, b) => parseFloat(b.valoracion || 0) - parseFloat(a.valoracion || 0))
      .slice(0, 20);
  }, [peliculas]);

  const featuredMovie = useMemo(() => {
    const current = peliculas.filter(p => p.tipo === 'pelicula' && p.categoria !== 'YouTube' && (p.año === '2024' || p.año === '2025' || p.año === '2026'));
    if (current.length > 0) {
      return current.sort((a, b) => parseFloat(b.valoracion || 0) - parseFloat(a.valoracion || 0))[0];
    }
    return peliculas.find(p => p.id === 'movie-157336') || peliculas[0];
  }, [peliculas]);

  // Memoized FAST TV (FREE) categories
  const freeLatino = useMemo(() => canales.filter(c => c.categoria === 'Cine' && (c.nombre.toLowerCase().includes('latino') || c.nombre.toLowerCase().includes('espanol') || c.nombre.toLowerCase().includes('español') || c.nombre.toLowerCase().includes('mex') || c.nombre.toLowerCase().includes('cine premium') || c.nombre.toLowerCase().includes('cine familiar'))), [canales]);
  const freeAccion = useMemo(() => canales.filter(c => c.categoria === 'Cine' && (c.nombre.toLowerCase().includes('accion') || c.nombre.toLowerCase().includes('action') || c.nombre.toLowerCase().includes('thriller') || c.nombre.toLowerCase().includes('terror') || c.nombre.toLowerCase().includes('horror') || c.nombre.toLowerCase().includes('suspenso'))), [canales]);
  const freeGeneral = useMemo(() => canales.filter(c => c.categoria === 'Cine' && !(c.nombre.toLowerCase().includes('latino') || c.nombre.toLowerCase().includes('espanol') || c.nombre.toLowerCase().includes('español') || c.nombre.toLowerCase().includes('accion') || c.nombre.toLowerCase().includes('action') || c.nombre.toLowerCase().includes('thriller') || c.nombre.toLowerCase().includes('terror') || c.nombre.toLowerCase().includes('horror'))).slice(0, 20), [canales]);

  // Memoized sorting for A-Z tabs
  const sortedMovies = useMemo(() => {
    return peliculas
      .filter(p => p.tipo === 'pelicula' && p.categoria !== 'Anime' && p.categoria !== 'Documentales' && p.categoria !== 'YouTube')
      .sort((a, b) => a.titulo.localeCompare(b.titulo, 'es'));
  }, [peliculas]);

  const sortedSeries = useMemo(() => {
    return peliculas
      .filter(p => p.tipo === 'serie' && p.categoria !== 'Anime' && p.categoria !== 'Documentales')
      .sort((a, b) => a.titulo.localeCompare(b.titulo, 'es'));
  }, [peliculas]);

  // Memoized filters for search and live tabs to prevent UI freezing
  const filteredItems = useMemo(() => {
    if (!searchQuery) return [];
    const q = searchQuery.toLowerCase();
    return peliculas.filter(item => {
      return item.titulo.toLowerCase().includes(q) ||
             item.descripcion.toLowerCase().includes(q);
    });
  }, [peliculas, searchQuery]);

  // Búsqueda en TMDB en tiempo real
  useEffect(() => {
    if (!searchQuery || searchQuery.trim().length < 2) {
      setTmdbSearchResults([]);
      return;
    }

    const delayDebounceFn = setTimeout(() => {
      setLoadingTmdbSearch(true);
      fetch(`https://api.themoviedb.org/3/search/multi?api_key=04c35731a5ee918f014970082a0088b1&language=es-MX&query=${encodeURIComponent(searchQuery)}`)
        .then(res => res.json())
        .then(data => {
          if (data && data.results) {
            const parsed = data.results
              .filter(item => item.media_type === 'movie' || item.media_type === 'tv')
              .map(item => {
                const isTv = item.media_type === 'tv';
                return {
                  id: `tmdb-${item.media_type}-${item.id}`,
                  titulo: item.title || item.name || item.original_title || item.original_name || 'Sin título',
                  descripcion: item.overview || 'Sin descripción disponible.',
                  tipo: isTv ? 'serie' : 'pelicula',
                  tmdbId: item.id.toString(),
                  imdbId: '',
                  poster: item.poster_path 
                    ? `https://image.tmdb.org/t/p/w342${item.poster_path}` 
                    : "https://images.unsplash.com/photo-1489599849927-2ee91cede3ba?auto=format&fit=crop&w=400&q=80",
                  backdrop: item.backdrop_path 
                    ? `https://image.tmdb.org/t/p/w1280${item.backdrop_path}` 
                    : '',
                  año: (item.release_date || item.first_air_date || '').substring(0, 4) || 'N/A',
                  valoracion: item.vote_average ? item.vote_average.toFixed(1) : 'N/A',
                  categoria: isTv ? 'Series' : 'Películas',
                  idioma: 'Latino / Sub',
                  duracion: 'N/A'
                };
              });
            setTmdbSearchResults(parsed);
          } else {
            setTmdbSearchResults([]);
          }
          setLoadingTmdbSearch(false);
        })
        .catch(err => {
          console.error("Error fetching TMDB search:", err);
          setTmdbSearchResults([]);
          setLoadingTmdbSearch(false);
        });
    }, 500);

    return () => clearTimeout(delayDebounceFn);
  }, [searchQuery]);

  const mergedSearchResults = useMemo(() => {
    const local = filteredItems;
    const localTmdbIds = new Set(local.map(item => item.tmdbId).filter(Boolean));
    const uniqueTmdb = tmdbSearchResults.filter(item => !localTmdbIds.has(item.tmdbId));
    return [...local, ...uniqueTmdb];
  }, [filteredItems, tmdbSearchResults]);

  // --- MANGA IMPLEMENTATION HANDLERS & EFFECTS ---
  const filteredChaptersByLanguage = useMemo(() => {
    return mangaChapters.filter(ch => {
      const lang = ch.attributes.translatedLanguage;
      if (mangaLanguage === 'es') {
        return lang === 'es' || lang === 'es-la';
      }
      return lang === mangaLanguage;
    });
  }, [mangaChapters, mangaLanguage]);

  useEffect(() => {
    setMangaOffset(0);
    setHasMoreMangas(true);
  }, [mangaSearchQuery, activeTab]);

  useEffect(() => {
    if (activeTab !== 'manga') return;

    const delayDebounceFn = setTimeout(() => {
      setLoadingMangas(true);
      const url = mangaSearchQuery.trim() === ''
        ? `https://api.mangadex.org/manga?limit=30&offset=${mangaOffset}&includes[]=cover_art&order[followedCount]=desc&availableTranslatedLanguage[]=es&availableTranslatedLanguage[]=es-la`
        : `https://api.mangadex.org/manga?title=${encodeURIComponent(mangaSearchQuery)}&limit=30&offset=${mangaOffset}&includes[]=cover_art&availableTranslatedLanguage[]=es&availableTranslatedLanguage[]=es-la`;

      fetch(`/api/proxy?url=${encodeURIComponent(url)}`)
        .then(res => res.json())
        .then(data => {
          if (data && data.data) {
            if (mangaOffset === 0) {
              setMangas(data.data);
            } else {
              setMangas(prev => {
                const existingIds = new Set(prev.map(m => m.id));
                const uniqueNew = data.data.filter(m => !existingIds.has(m.id));
                return [...prev, ...uniqueNew];
              });
            }
            setHasMoreMangas(data.data.length === 30);
          } else {
            if (mangaOffset === 0) {
              setMangas([]);
            }
            setHasMoreMangas(false);
          }
          setLoadingMangas(false);
        })
        .catch(err => {
          console.error("Error fetching mangas:", err);
          if (mangaOffset === 0) {
            setMangas([]);
          }
          setHasMoreMangas(false);
          setLoadingMangas(false);
        });
    }, mangaOffset === 0 ? 400 : 0);

    return () => clearTimeout(delayDebounceFn);
  }, [activeTab, mangaSearchQuery, mangaOffset]);

  const handleSelectManga = (manga) => {
    setSelectedManga(manga);
    setMangaChapters([]);
    setActiveChapter(null);
    setChapterPages([]);
    setLoadingChapters(true);
    
    const mangaId = manga.id;
    const feedUrl = `https://api.mangadex.org/manga/${mangaId}/feed?translatedLanguage[]=es&translatedLanguage[]=es-la&translatedLanguage[]=en&limit=500&order[chapter]=asc&includes[]=scanlation_group`;
    fetch(`/api/proxy?url=${encodeURIComponent(feedUrl)}`)
      .then(res => res.json())
      .then(data => {
        if (data && data.data) {
          const sorted = data.data.sort((a, b) => {
            const numA = parseFloat(a.attributes.chapter) || 0;
            const numB = parseFloat(b.attributes.chapter) || 0;
            return numA - numB;
          });
          setMangaChapters(sorted);
        } else {
          setMangaChapters([]);
        }
        setLoadingChapters(false);
      })
      .catch(err => {
        console.error("Error fetching manga chapters:", err);
        setMangaChapters([]);
        setLoadingChapters(false);
      });
  };

  const handleSelectChapter = (chapter) => {
    setActiveChapter(chapter);
    setChapterPages([]);
    setCurrentMangaPage(0);
    setLoadingPages(true);

    const pagesUrl = `https://api.mangadex.org/at-home/server/${chapter.id}`;
    fetch(`/api/proxy?url=${encodeURIComponent(pagesUrl)}`)
      .then(res => res.json())
      .then(data => {
        if (data && data.baseUrl && data.chapter) {
          const baseUrl = data.baseUrl;
          const hash = data.chapter.hash;
          const isSaver = !!data.chapter.dataSaver;
          const files = isSaver ? data.chapter.dataSaver : data.chapter.data;
          const pathType = isSaver ? 'data-saver' : 'data';
          const urls = files.map(file => `/api/proxy?url=${encodeURIComponent(`${baseUrl}/${pathType}/${hash}/${file}`)}`);
          setChapterPages(urls);
        } else {
          setChapterPages([]);
        }
        setLoadingPages(false);
      })
      .catch(err => {
        console.error("Error loading chapter pages:", err);
        setChapterPages([]);
        setLoadingPages(false);
      });
  };

  const scrollToTop = () => {
    const elem = document.querySelector('.manga-reader-view');
    if (elem) {
      elem.scrollTo({ top: 0, behavior: 'smooth' });
    }
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleNextPage = () => {
    if (mangaReaderMode === 'double') {
      if (currentMangaPage === 0) {
        setCurrentMangaPage(1);
      } else {
        setCurrentMangaPage(prev => Math.min(chapterPages.length - 1, prev + 2));
      }
    } else {
      setCurrentMangaPage(prev => Math.min(chapterPages.length - 1, prev + 1));
    }
    scrollToTop();
  };

  const handlePrevPage = () => {
    if (mangaReaderMode === 'double') {
      if (currentMangaPage <= 2) {
        setCurrentMangaPage(0);
      } else {
        setCurrentMangaPage(prev => Math.max(1, prev - 2));
      }
    } else {
      setCurrentMangaPage(prev => Math.max(0, prev - 1));
    }
    scrollToTop();
  };

  const toggleFullscreen = () => {
    const elem = document.querySelector('.manga-reader-view');
    if (!elem) return;
    if (!document.fullscreenElement) {
      elem.requestFullscreen().catch(err => {
        console.error(`Error attempting to enable fullscreen: ${err.message}`);
      });
    } else {
      document.exitFullscreen();
    }
  };

  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsMangaFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, []);

  // Keyboard navigation for manga reader (page turn)
  useEffect(() => {
    if (activeTab !== 'manga' || !activeChapter || mangaReaderMode === 'vertical') return;

    const handleKeyDown = (e) => {
      if (e.key === 'ArrowLeft') {
        handlePrevPage();
      } else if (e.key === 'ArrowRight') {
        handleNextPage();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [activeTab, activeChapter, mangaReaderMode, chapterPages, currentMangaPage]);
  // --- END MANGA IMPLEMENTATION ---

  const filteredTdtCanales = useMemo(() => {
    return canales.filter(ch => {
      if (ch.categoria === 'Cine') return false;

      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        if (!ch.nombre.toLowerCase().includes(q) && !ch.categoria.toLowerCase().includes(q) && !(ch.pais || '').toLowerCase().includes(q)) {
          return false;
        }
      }

      if (tdtFilter === 'Todos') return true;
      if (['Deportes', 'Noticias', 'Infantil', 'Música'].includes(tdtFilter)) {
        return ch.categoria === tdtFilter;
      }
      return ch.pais === tdtFilter;
    });
  }, [canales, tdtFilter, searchQuery]);

  const filteredFreeCanales = useMemo(() => {
    return canales.filter(ch => {
      if (ch.categoria !== 'Cine') return false;

      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        return ch.nombre.toLowerCase().includes(q);
      }
      return true;
    });
  }, [canales, searchQuery]);

  // Unificar servidores de Cuevana (Latino) y servidores originales
  const originalServersList = servers.map((s) => ({
    name: s.name,
    url: s.url(activeItem ? activeItem.tmdbId : '', activeItem ? activeItem.imdbId : '', activeItem ? activeItem.tipo : '', season, episode)
  }));

  const allServers = activeItem 
    ? (activeItem.tipo === 'canal' 
        ? [{ name: "Canal en Vivo", url: isYouTubeUrl(activeItem.url) ? (activeItem.url.includes('/embed/') ? activeItem.url : `https://www.youtube.com/embed/${getYouTubeId(activeItem.url)}?autoplay=1&rel=0`) : `${window.location.origin}/api/proxy?url=${encodeURIComponent(activeItem.url)}` }]
        : [
            ...(activeItem.youtubeId ? [{ name: "Servidor Principal (YouTube)", url: `https://www.youtube.com/embed/${activeItem.youtubeId}?autoplay=1&rel=0` }] : []),
            ...originalServersList,
            ...cuevanaServers
          ])
    : [];

  const navItems = [
    {
      id: 'inicio',
      label: 'Inicio',
      icon: (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
          <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path>
          <polyline points="9 22 9 12 15 12 15 22"></polyline>
        </svg>
      )
    },
    {
      id: 'peliculas',
      label: 'Películas',
      icon: (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
          <rect x="2" y="2" width="20" height="20" rx="2.18" ry="2.18"></rect>
          <line x1="7" y1="2" x2="7" y2="22"></line>
          <line x1="17" y1="2" x2="17" y2="22"></line>
          <line x1="2" y1="12" x2="22" y2="12"></line>
          <line x1="2" y1="7" x2="7" y2="7"></line>
          <line x1="2" y1="17" x2="7" y2="17"></line>
          <line x1="17" y1="17" x2="22" y2="17"></line>
          <line x1="17" y1="7" x2="22" y2="7"></line>
        </svg>
      )
    },
    {
      id: 'series',
      label: 'Series',
      icon: (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
          <rect x="2" y="7" width="20" height="15" rx="2" ry="2"></rect>
          <polyline points="17 2 12 7 7 2"></polyline>
        </svg>
      )
    },
    {
      id: 'anime',
      label: 'Anime',
      icon: (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
          <polygon points="12 2 15 9 22 12 15 15 12 22 9 15 2 12 9 9"></polygon>
        </svg>
      )
    },
    {
      id: 'manga',
      label: 'Manga',
      icon: (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
          <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"></path>
          <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"></path>
        </svg>
      )
    },
    {
      id: 'documentales',
      label: 'Documentales',
      icon: (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
          <circle cx="12" cy="12" r="10"></circle>
          <line x1="2" y1="12" x2="22" y2="12"></line>
          <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"></path>
        </svg>
      )
    },
    {
      id: 'youtube',
      label: 'YouTube',
      icon: (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
          <path d="M23 7l-7 5 7 5V7z"></path>
          <rect x="1" y="5" width="15" height="14" rx="2" ry="2"></rect>
        </svg>
      )
    },
    {
      id: 'tdt',
      label: 'TDT',
      icon: (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
          <path d="M2 16.1A5 5 0 0 1 5.9 20M2 12.05A9 9 0 0 1 9.95 20M2 8A14 14 0 0 1 14 20M2 20h.01"></path>
        </svg>
      )
    },
    {
      id: 'free',
      label: 'FREE',
      icon: (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
          <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
          <path d="M12 2s-1.5 6-3 6c-1.5 0-3-1.5-3-3s1.5-3 3-3z"></path>
          <path d="M12 2s1.5 6 3 6c1.5 0 3-1.5 3-3s-1.5-3-3-3z"></path>
          <path d="M12 8v3"></path>
        </svg>
      )
    },
    {
      id: 'favoritos',
      label: 'Favoritos',
      icon: (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
          <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon>
        </svg>
      )
    }
  ];

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
              
              <text x="20" y="68" fill="#ffffff" fontSize="46" fontWeight="900" fontFamily="'Outfit', 'Inter', sans-serif" letterSpacing="3" className="animated-text">
                FILM
              </text>
              
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

      {/* 2. LEFT SIDEBAR (Desktop / Collapsed Mobile) */}
      <aside className={`main-sidebar ${mobileMenuOpen ? 'open' : ''}`}>
        <button className="sidebar-close-btn" onClick={() => setMobileMenuOpen(false)}>✕</button>
        
        <div className="sidebar-logo" onClick={() => { setActiveItem(null); setActiveTab('inicio'); setSearchQuery(''); setMobileMenuOpen(false); }}>
          <svg width="150" height="46" viewBox="0 0 200 60">
            <defs>
              <linearGradient id="sidebar-cyan-grad" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#00f5d4" />
                <stop offset="100%" stopColor="#00b8ff" />
              </linearGradient>
            </defs>
            <text x="10" y="42" fill="#ffffff" fontSize="28" fontWeight="900" fontFamily="'Outfit', sans-serif" letterSpacing="1">
              FILM
            </text>
            <rect x="95" y="10" width="75" height="38" rx="8" fill="url(#sidebar-cyan-grad)" />
            <text x="132" y="38" fill="#07070c" fontSize="22" fontWeight="900" fontFamily="'Outfit', sans-serif" textAnchor="middle">
              TV
            </text>
          </svg>
        </div>

        <nav className="sidebar-menu">
          {navItems.map((item) => (
            <button
              key={item.id}
              onClick={() => {
                setActiveItem(null);
                setActiveTab(item.id);
                setSearchQuery('');
                setMobileMenuOpen(false);
              }}
              className={`sidebar-menu-btn ${activeTab === item.id && searchQuery === '' ? 'active' : ''}`}
            >
              {item.icon}
              <span className="sidebar-btn-label">{item.label}</span>
            </button>
          ))}
        </nav>
      </aside>

      {/* Background overlay when mobile sidebar is open */}
      {mobileMenuOpen && <div className="sidebar-overlay-bg" onClick={() => setMobileMenuOpen(false)}></div>}

      {/* 3. CONTENT WRAPPER */}
      <div className="content-wrapper">
        {/* HEADER */}
        <header className="main-header">
          <div className="header-content">
            <button className="mobile-menu-toggle" onClick={() => setMobileMenuOpen(true)}>
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <line x1="3" y1="12" x2="21" y2="12"></line>
                <line x1="3" y1="6" x2="21" y2="6"></line>
                <line x1="3" y1="18" x2="21" y2="18"></line>
              </svg>
            </button>

            <div className="brand-logo" onClick={() => { setActiveItem(null); setSearchQuery(''); setActiveTab('inicio'); }}>
              <svg width="150" height="46" viewBox="0 0 200 60">
                <defs>
                  <linearGradient id="header-cyan-grad-mobile" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stopColor="#00f5d4" />
                    <stop offset="100%" stopColor="#00b8ff" />
                  </linearGradient>
                </defs>
                <text x="10" y="42" fill="#ffffff" fontSize="28" fontWeight="900" fontFamily="'Outfit', sans-serif" letterSpacing="1">
                  FILM
                </text>
                <rect x="95" y="10" width="75" height="38" rx="8" fill="url(#header-cyan-grad-mobile)" />
                <text x="132" y="38" fill="#07070c" fontSize="22" fontWeight="900" fontFamily="'Outfit', sans-serif" textAnchor="middle">
                  TV
                </text>
              </svg>
            </div>

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

        {/* CONTENIDO PRINCIPAL */}
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
                  {activeItem.tipo === 'canal' ? (
                    <>
                      <span className="player-item-title">{activeItem.nombre}</span>
                      {activeItem.pais && <span className="player-item-year">({activeItem.pais})</span>}
                    </>
                  ) : (
                    <>
                      <span className="player-item-title">{activeItem.titulo}</span>
                      <span className="player-item-year">({activeItem.año})</span>
                      <span className="player-item-rating">★ {activeItem.valoracion}</span>
                    </>
                  )}
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

              {/* Pestañas de servidores de transmisión (se omiten para canales) */}
              {activeItem.tipo !== 'canal' && (
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
              )}

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
                      isYouTubeUrl(activeItem.url) ? (
                        <iframe
                          src={activeItem.url.includes('/embed/') ? activeItem.url : `https://www.youtube.com/embed/${getYouTubeId(activeItem.url)}?autoplay=1&rel=0`}
                          onLoad={() => setIframeLoading(false)}
                          allowFullScreen
                          allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
                          className="player-iframe"
                        />
                      ) : (
                        <video
                          ref={videoRef}
                          controls
                          autoPlay
                          className="player-iframe"
                          style={{ width: '100%', height: '100%', border: 'none', backgroundColor: '#000' }}
                          onPlay={() => setIframeLoading(false)}
                          onLoadedData={() => setIframeLoading(false)}
                        />
                      )
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
                  
                  {activeItem.tipo !== 'canal' && (
                    <div className="playback-optimization-banner">
                      <span className="banner-icon">Optimización</span>
                      <span className="banner-text">
                        Si el reproductor falla o no carga en tu idioma, cambia de <strong>Servidor</strong> en la lista superior. Los servidores <strong>Latino</strong> se cargan dinámicamente.
                      </span>
                    </div>
                  )}
                </div>

                {/* Contenedor del Chat Watch Party */}
                <div className={`chat-wrapper ${chatCollapsed ? 'collapsed' : ''}`}>
                  <ChatBox 
                    channelId={activeItem.id} 
                    channelTitle={activeItem.tipo === 'canal' ? activeItem.nombre : activeItem.titulo} 
                    isCollapsed={chatCollapsed}
                    onToggleCollapse={() => setChatCollapsed(!chatCollapsed)}
                  />
                </div>
              </div>

              {/* Sinopsis y detalles debajo del reproductor en ancho completo */}
              <div className="player-details-full">
                <div className="player-details-card">
                  <h3>Sinopsis</h3>
                  <p>
                    {activeItem.tipo === 'canal' 
                      ? (activeItem.descripcion || `Transmisión oficial en vivo de ${activeItem.nombre} (${activeItem.pais}).`) 
                      : activeItem.descripcion}
                  </p>
                  <div className="tags-row">
                    <span className="category-tag">{activeItem.categoria}</span>
                    <span className="type-tag">
                      {activeItem.tipo === 'canal' ? 'Canal en Vivo' : (activeItem.tipo === 'serie' ? 'Serie de TV' : 'Película')}
                    </span>
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

                  {loadingTmdbSearch && (
                    <div className="search-loading-bar-container" style={{ width: '100%', height: '4px', backgroundColor: 'rgba(0, 245, 212, 0.1)', overflow: 'hidden', marginBottom: '20px', borderRadius: '2px' }}>
                      <div className="search-loading-bar" style={{ width: '30%', height: '100%', backgroundColor: '#00f5d4', borderRadius: '2px', animation: 'search-pulse 1.5s infinite ease-in-out' }}></div>
                    </div>
                  )}

                  <div className="cards-grid">
                    {mergedSearchResults.slice(0, searchLimit).map((item) => (
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

                  {mergedSearchResults.length === 0 && !loadingTmdbSearch && (
                    <div className="no-results">
                      No se encontraron películas o series con los criterios de búsqueda.
                    </div>
                  )}

                  {mergedSearchResults.length > searchLimit && (
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
                        const featured = featuredMovie;
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
                              <div style={{ display: 'flex', gap: '12px' }}>
                                <button className="hero-play-btn" onClick={() => handleCardClick(featured)}>
                                  Ver detalles
                                </button>
                                {featured.tmdbId && (
                                  <button className="hero-trailer-btn" onClick={() => playTrailer(featured)}>
                                    {loadingTrailer ? 'Cargando...' : 'Ver Tráiler'}
                                  </button>
                                )}
                              </div>
                            </div>
                          </div>
                        );
                      })()}

                      <div className="carruseles-container">
                        <CategoryRow 
                          title="Recomendadas por Valoración" 
                          items={recomendadas} 
                          onSelect={handleCardClick}
                          onPlay={handleCardDoubleClick}
                        />
                        <CategoryRow 
                          title="Películas de Estreno (2020 - 2026)" 
                          items={estrenosPeliculas} 
                          onSelect={handleCardClick}
                          onPlay={handleCardDoubleClick}
                        />
                        <CategoryRow 
                          title="Series de Estreno y Tendencia (Netflix, Max)" 
                          items={estrenosSeries} 
                          onSelect={handleCardClick}
                          onPlay={handleCardDoubleClick}
                        />
                        <CategoryRow 
                          title="Películas de Acción" 
                          items={topAccion} 
                          onSelect={handleCardClick}
                          onPlay={handleCardDoubleClick}
                        />
                        <CategoryRow 
                          title="Ciencia Ficción" 
                          items={topCienciaFiccion} 
                          onSelect={handleCardClick}
                          onPlay={handleCardDoubleClick}
                        />
                        <CategoryRow 
                          title="Terror y Suspenso" 
                          items={topTerror} 
                          onSelect={handleCardClick}
                          onPlay={handleCardDoubleClick}
                        />
                        <CategoryRow 
                          title="Comedia" 
                          items={topComedia} 
                          onSelect={handleCardClick}
                          onPlay={handleCardDoubleClick}
                        />
                        <CategoryRow 
                          title="Drama" 
                          items={topDrama} 
                          onSelect={handleCardClick}
                          onPlay={handleCardDoubleClick}
                        />
                        <CategoryRow 
                          title="Infantil y Familiar" 
                          items={topInfantil} 
                          onSelect={handleCardClick}
                          onPlay={handleCardDoubleClick}
                        />
                        <CategoryRow 
                          title="Series de TV más vistas" 
                          items={topSeries} 
                          onSelect={handleCardClick}
                          onPlay={handleCardDoubleClick}
                        />
                      </div>
                    </div>
                  )}

                  {activeTab === 'anime' && (
                    <div className="tab-anime-container">
                      <h2 className="section-title">Anime Completo</h2>
                      {(() => {
                        const visible = animeItems.slice(0, animeLimit);
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
                                    <img src={item.poster} alt={item.titulo} className="movie-poster" loading="lazy" />
                                    <div className="card-play-overlay"><div className="play-arrow"></div></div>
                                    <span className="movie-lang-badge">{getLangBadge(item)}</span>
                                    <span className="rating-badge">★ {item.valoracion}</span>
                                  </div>
                                  <div className="movie-card-info">
                                    <h3 className="movie-card-title">{item.titulo}</h3>
                                    <div className="movie-card-meta">
                                      <span className="movie-card-year">{item.año}</span>
                                      <span className="movie-card-genre">{item.tipo === 'serie' ? 'Serie' : 'Película'}</span>
                                    </div>
                                  </div>
                                </div>
                              ))}
                            </div>
                            {animeItems.length > animeLimit && (
                              <div className="load-more-container">
                                <button onClick={() => setAnimeLimit(prev => prev + 32)} className="load-more-btn">Cargar más</button>
                              </div>
                            )}
                          </>
                        );
                      })()}
                    </div>
                  )}

                  {activeTab === 'manga' && (
                    <div className="tab-manga-container">
                      {activeChapter ? (
                        /* ================== VISOR DE MANGA (READER) ================== */
                        <div 
                          className="manga-reader-view"
                          style={{
                            display: 'flex',
                            flexDirection: 'column',
                            backgroundColor: isMangaFullscreen ? '#000000' : 'transparent',
                            padding: isMangaFullscreen ? '20px 40px' : '0',
                            width: '100%',
                            height: isMangaFullscreen ? '100vh' : 'auto',
                            overflowY: 'auto'
                          }}
                        >
                          <div className="manga-reader-header" style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: '15px', padding: '15px 0', borderBottom: '1px solid #1a1a24', marginBottom: '20px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
                              <button 
                                onClick={() => {
                                  setActiveChapter(null);
                                  setChapterPages([]);
                                }} 
                                className="back-btn"
                                style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 16px', backgroundColor: '#13131a', border: '1px solid #27273a', borderRadius: '8px', color: '#fff', cursor: 'pointer', transition: 'all 0.2s', fontSize: '14px', fontWeight: 'bold' }}
                              >
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                                  <line x1="19" y1="12" x2="5" y2="12"></line>
                                  <polyline points="12 19 5 12 12 5"></polyline>
                                </svg>
                                Volver al Listado
                              </button>
                              <div>
                                <h2 style={{ fontSize: '18px', fontWeight: '900', color: '#fff', margin: 0 }}>
                                  {getMangaTitle(selectedManga)}
                                </h2>
                                <p style={{ fontSize: '13px', color: '#00f5d4', margin: '4px 0 0 0', fontWeight: 'bold' }}>
                                  Capítulo {activeChapter.attributes.chapter} {activeChapter.attributes.title ? `- ${activeChapter.attributes.title}` : ''} ({activeChapter.attributes.translatedLanguage === 'es' || activeChapter.attributes.translatedLanguage === 'es-la' ? 'Español' : 'Inglés'})
                                </p>
                              </div>
                            </div>

                            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                              <div style={{ display: 'flex', gap: '4px', backgroundColor: '#13131a', padding: '4px', borderRadius: '8px', border: '1px solid #27273a' }}>
                                {['single', 'double', 'vertical'].map((m) => (
                                  <button
                                    key={m}
                                    onClick={() => {
                                      setMangaReaderMode(m);
                                      if (m === 'double' && currentMangaPage % 2 === 0 && currentMangaPage > 0) {
                                        setCurrentMangaPage(prev => Math.max(1, prev - 1));
                                      }
                                    }}
                                    style={{
                                      padding: '6px 12px',
                                      backgroundColor: mangaReaderMode === m ? '#00f5d4' : 'transparent',
                                      color: mangaReaderMode === m ? '#09090d' : '#fff',
                                      border: 'none',
                                      borderRadius: '6px',
                                      cursor: 'pointer',
                                      fontSize: '12px',
                                      fontWeight: 'bold',
                                      transition: 'all 0.2s'
                                    }}
                                  >
                                    {m === 'single' ? 'Simple' : m === 'double' ? 'Doble' : 'Cascada'}
                                  </button>
                                ))}
                              </div>

                              <button
                                onClick={toggleFullscreen}
                                style={{
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: '6px',
                                  padding: '8px 16px',
                                  backgroundColor: isMangaFullscreen ? '#ff007f' : '#13131a',
                                  border: '1px solid #27273a',
                                  borderRadius: '8px',
                                  color: '#fff',
                                  cursor: 'pointer',
                                  fontSize: '13px',
                                  fontWeight: 'bold',
                                  transition: 'all 0.2s'
                                }}
                              >
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                                  {isMangaFullscreen ? (
                                    <path d="M4 14h6v6M20 10h-6V4M14 10l7-7M10 14l-7 7" />
                                  ) : (
                                    <path d="M8 3H5a2 2 0 0 0-2 2v3M21 8V5a2 2 0 0 0-2-2h-3M3 16v3a2 2 0 0 0 2 2h3M16 21h3a2 2 0 0 0 2-2v-3" />
                                  )}
                                </svg>
                                {isMangaFullscreen ? 'Salir' : 'Pantalla Completa'}
                              </button>

                              {mangaReaderMode !== 'vertical' && chapterPages.length > 0 && (
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                  <button
                                    onClick={handlePrevPage}
                                    disabled={currentMangaPage === 0}
                                    style={{ padding: '8px 12px', backgroundColor: '#13131a', border: '1px solid #27273a', borderRadius: '8px', color: '#fff', cursor: currentMangaPage === 0 ? 'not-allowed' : 'pointer', opacity: currentMangaPage === 0 ? 0.4 : 1 }}
                                  >
                                    Anterior
                                  </button>
                                  <span style={{ fontSize: '14px', color: '#8e8e9f', fontWeight: 'bold' }}>
                                    {mangaReaderMode === 'double' && currentMangaPage > 0 ? (
                                      `${currentMangaPage + 1}-${Math.min(chapterPages.length, currentMangaPage + 2)} / ${chapterPages.length}`
                                    ) : (
                                      `${currentMangaPage + 1} / ${chapterPages.length}`
                                    )}
                                  </span>
                                  <button
                                    onClick={handleNextPage}
                                    disabled={mangaReaderMode === 'double' ? currentMangaPage >= chapterPages.length - 1 : currentMangaPage === chapterPages.length - 1}
                                    style={{ padding: '8px 12px', backgroundColor: '#13131a', border: '1px solid #27273a', borderRadius: '8px', color: '#fff', cursor: (mangaReaderMode === 'double' ? currentMangaPage >= chapterPages.length - 1 : currentMangaPage === chapterPages.length - 1) ? 'not-allowed' : 'pointer', opacity: (mangaReaderMode === 'double' ? currentMangaPage >= chapterPages.length - 1 : currentMangaPage === chapterPages.length - 1) ? 0.4 : 1 }}
                                  >
                                    Siguiente
                                  </button>
                                </div>
                              )}
                            </div>
                          </div>

                          {loadingPages ? (
                            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '300px', gap: '15px' }}>
                              <div className="spinner" style={{ width: '40px', height: '40px', border: '4px solid rgba(0, 245, 212, 0.1)', borderTop: '4px solid #00f5d4', borderRadius: '50%', animation: 'spin 1s linear infinite' }}></div>
                              <span style={{ color: '#8e8e9f', fontSize: '15px' }}>Cargando páginas del manga...</span>
                            </div>
                          ) : chapterPages.length === 0 ? (
                            <div style={{ padding: '50px', textAlign: 'center', backgroundColor: '#13131a', borderRadius: '12px', border: '1px solid #1a1a24', color: '#8e8e9f' }}>
                              No se pudieron cargar las páginas de este capítulo. Prueba con otro capítulo o grupo de traducción.
                            </div>
                          ) : (
                            <div className="manga-pages-container" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '400px', backgroundColor: '#09090d', borderRadius: '12px', padding: '20px', border: '1px solid #1a1a24', width: '100%' }}>
                              {mangaReaderMode === 'vertical' ? (
                                <div className="manga-vertical-stack" style={{ display: 'flex', flexDirection: 'column', gap: '15px', maxWidth: '800px', width: '100%' }}>
                                  {chapterPages.map((url, index) => (
                                    <img 
                                      key={index} 
                                      src={url} 
                                      alt={`Página ${index + 1}`} 
                                      style={{ width: '100%', height: 'auto', borderRadius: '4px', border: '1px solid #1a1a24', backgroundColor: '#13131a' }} 
                                      loading="lazy"
                                    />
                                  ))}
                                </div>
                              ) : mangaReaderMode === 'double' ? (
                                <div 
                                  className="manga-double-page-container" 
                                  style={{ position: 'relative', width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center' }}
                                >
                                  <div 
                                    style={{ display: 'flex', gap: '15px', justifyContent: 'center', width: '100%', height: isMangaFullscreen ? '85vh' : '75vh', maxHeight: isMangaFullscreen ? '85vh' : '75vh' }}
                                    onClick={(e) => {
                                      const rect = e.currentTarget.getBoundingClientRect();
                                      const x = e.clientX - rect.left;
                                      if (x > rect.width / 2) {
                                        handleNextPage();
                                      } else {
                                        handlePrevPage();
                                      }
                                    }}
                                  >
                                    {currentMangaPage === 0 ? (
                                      <img 
                                        src={chapterPages[0]} 
                                        alt="Portada" 
                                        style={{ height: '100%', width: 'auto', objectFit: 'contain', borderRadius: '8px', border: '1px solid #27273a', boxShadow: '0 10px 30px rgba(0,0,0,0.5)', backgroundColor: '#13131a', cursor: 'pointer' }} 
                                      />
                                    ) : (
                                      <>
                                        <img 
                                          src={chapterPages[currentMangaPage]} 
                                          alt={`Página ${currentMangaPage + 1}`} 
                                          style={{ height: '100%', width: 'auto', objectFit: 'contain', borderRadius: '8px', border: '1px solid #27273a', boxShadow: '0 10px 30px rgba(0,0,0,0.5)', backgroundColor: '#13131a', cursor: 'pointer' }} 
                                        />
                                        {currentMangaPage + 1 < chapterPages.length && (
                                          <img 
                                            src={chapterPages[currentMangaPage + 1]} 
                                            alt={`Página ${currentMangaPage + 2}`} 
                                            style={{ height: '100%', width: 'auto', objectFit: 'contain', borderRadius: '8px', border: '1px solid #27273a', boxShadow: '0 10px 30px rgba(0,0,0,0.5)', backgroundColor: '#13131a', cursor: 'pointer' }} 
                                          />
                                        )}
                                      </>
                                    )}
                                  </div>
                                  <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%', maxWidth: '800px', marginTop: '15px', fontSize: '13px', color: '#8e8e9f' }}>
                                    <span>◄ Click Izquierda para Retroceder</span>
                                    <span style={{ color: '#00f5d4', fontWeight: 'bold' }}>
                                      {currentMangaPage === 0 ? (
                                        'Portada (Página 1)'
                                      ) : (
                                        `Páginas ${currentMangaPage + 1}${currentMangaPage + 1 < chapterPages.length ? ` - ${currentMangaPage + 2}` : ''} de ${chapterPages.length}`
                                      )}
                                    </span>
                                    <span>Click Derecha para Avanzar ►</span>
                                  </div>
                                </div>
                              ) : (
                                <div 
                                  className="manga-single-page-container" 
                                  style={{ position: 'relative', maxWidth: '800px', width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', cursor: 'pointer' }}
                                  onClick={(e) => {
                                    const rect = e.currentTarget.getBoundingClientRect();
                                    const x = e.clientX - rect.left;
                                    if (x > rect.width / 2) {
                                      handleNextPage();
                                    } else {
                                      handlePrevPage();
                                    }
                                  }}
                                >
                                  <img 
                                    src={chapterPages[currentMangaPage]} 
                                    alt={`Página ${currentMangaPage + 1}`} 
                                    style={{ width: '100%', height: 'auto', borderRadius: '8px', border: '1px solid #27273a', boxShadow: '0 10px 30px rgba(0,0,0,0.5)', backgroundColor: '#13131a' }} 
                                  />
                                  <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%', marginTop: '15px', fontSize: '13px', color: '#8e8e9f' }}>
                                    <span>◄ Click Izquierda para Retroceder</span>
                                    <span style={{ color: '#00f5d4', fontWeight: 'bold' }}>Página {currentMangaPage + 1} de {chapterPages.length}</span>
                                    <span>Click Derecha para Avanzar ►</span>
                                  </div>
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      ) : selectedManga ? (
                        /* ================== DETALLES DE MANGA ================== */
                        <div className="manga-detail-view">
                          <button 
                            onClick={() => setSelectedManga(null)} 
                            className="back-btn"
                            style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', padding: '10px 20px', backgroundColor: '#13131a', border: '1px solid #27273a', borderRadius: '8px', color: '#fff', cursor: 'pointer', transition: 'all 0.2s', fontSize: '14px', fontWeight: 'bold', marginBottom: '25px' }}
                          >
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                              <line x1="19" y1="12" x2="5" y2="12"></line>
                              <polyline points="12 19 5 12 12 5"></polyline>
                            </svg>
                            Volver al Catálogo
                          </button>

                          <div className="manga-details-container" style={{ display: 'flex', flexDirection: 'row', flexWrap: 'wrap', gap: '30px', backgroundColor: '#13131a', padding: '30px', borderRadius: '16px', border: '1px solid #1a1a24', marginBottom: '30px' }}>
                            <div className="manga-details-left" style={{ width: '220px', flexShrink: 0 }}>
                              <img 
                                src={
                                  (() => {
                                    const coverRel = selectedManga.relationships?.find(r => r.type === 'cover_art');
                                    const coverFileName = coverRel?.attributes?.fileName;
                                    return coverFileName 
                                      ? `/api/proxy?url=${encodeURIComponent(`https://uploads.mangadex.org/covers/${selectedManga.id}/${coverFileName}.512.jpg`)}` 
                                      : "https://images.unsplash.com/photo-1578632767115-351597cf2477?auto=format&fit=crop&w=400&q=80";
                                  })()
                                } 
                                alt={getMangaTitle(selectedManga)} 
                                style={{ width: '100%', borderRadius: '12px', border: '1px solid #27273a', boxShadow: '0 8px 24px rgba(0,0,0,0.4)', aspectRatio: '2/3', objectFit: 'cover' }}
                              />
                            </div>
                            <div className="manga-details-right" style={{ flex: 1, minWidth: '300px' }}>
                              <h1 style={{ fontSize: '28px', fontWeight: '900', color: '#fff', margin: '0 0 10px 0', fontFamily: "'Outfit', sans-serif" }}>
                                {getMangaTitle(selectedManga)}
                              </h1>
                              
                              {selectedManga.attributes.altTitles && selectedManga.attributes.altTitles.length > 0 && (
                                <p style={{ fontSize: '14px', color: '#8e8e9f', margin: '0 0 15px 0', fontStyle: 'italic' }}>
                                  {Object.values(selectedManga.attributes.altTitles[0])[0]}
                                </p>
                              )}

                              <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', marginBottom: '20px' }}>
                                <span style={{ padding: '4px 10px', backgroundColor: 'rgba(0, 245, 212, 0.1)', color: '#00f5d4', borderRadius: '6px', fontSize: '12px', fontWeight: 'bold' }}>
                                  Estado: {selectedManga.attributes.status === 'completed' ? 'Finalizado' : 'En Emisión'}
                                </span>
                                {selectedManga.attributes.year && (
                                  <span style={{ padding: '4px 10px', backgroundColor: '#1e1e2f', color: '#8e8e9f', borderRadius: '6px', fontSize: '12px', fontWeight: 'bold' }}>
                                    Año: {selectedManga.attributes.year}
                                  </span>
                                )}
                              </div>

                              <p style={{ fontSize: '15px', color: '#b5b5c6', lineHeight: '1.6', margin: '0 0 20px 0' }}>
                                {selectedManga.attributes.description?.es || selectedManga.attributes.description?.en || 'Sin descripción disponible en español o inglés.'}
                              </p>
                            </div>
                          </div>

                          <div className="manga-chapters-section" style={{ backgroundColor: '#13131a', borderRadius: '16px', border: '1px solid #1a1a24', padding: '25px' }}>
                            <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: '15px', borderBottom: '1px solid #1a1a24', paddingBottom: '15px', marginBottom: '20px' }}>
                              <h3 style={{ fontSize: '20px', fontWeight: '900', color: '#fff', margin: 0, fontFamily: "'Outfit', sans-serif" }}>
                                Capítulos Disponibles
                              </h3>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                <span style={{ fontSize: '13px', color: '#8e8e9f', fontWeight: 'bold' }}>Idioma:</span>
                                <select 
                                  value={mangaLanguage} 
                                  onChange={(e) => setMangaLanguage(e.target.value)}
                                  style={{ padding: '6px 12px', backgroundColor: '#09090d', border: '1px solid #27273a', borderRadius: '6px', color: '#fff', cursor: 'pointer', outline: 'none', fontSize: '13px', fontWeight: 'bold' }}
                                >
                                  <option value="es">Español (ES)</option>
                                  <option value="en">Inglés (EN)</option>
                                </select>
                              </div>
                            </div>

                            {loadingChapters ? (
                              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '50px 0', gap: '15px' }}>
                                <div className="spinner" style={{ width: '30px', height: '30px', border: '3px solid rgba(0, 245, 212, 0.1)', borderTop: '3px solid #00f5d4', borderRadius: '50%', animation: 'spin 1s linear infinite' }}></div>
                                <span style={{ color: '#8e8e9f', fontSize: '14px' }}>Buscando capítulos traducidos...</span>
                              </div>
                            ) : filteredChaptersByLanguage.length === 0 ? (
                              <div style={{ padding: '40px', textAlign: 'center', color: '#8e8e9f', fontSize: '14px' }}>
                                No se encontraron capítulos en el idioma seleccionado. Prueba cambiando a <strong>Inglés</strong> en el selector de arriba.
                              </div>
                            ) : (
                              <div className="chapters-list-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '12px', maxHeight: '500px', overflowY: 'auto', paddingRight: '5px' }}>
                                {filteredChaptersByLanguage.map((chapter) => {
                                  const group = chapter.relationships?.find(r => r.type === 'scanlation_group');
                                  const groupName = group?.attributes?.name || 'Traductor Independiente';
                                  return (
                                    <div 
                                      key={chapter.id}
                                      onClick={() => handleSelectChapter(chapter)}
                                      style={{ padding: '15px', backgroundColor: '#09090d', border: '1px solid #27273a', borderRadius: '10px', cursor: 'pointer', transition: 'all 0.2s', display: 'flex', flexDirection: 'column', gap: '6px' }}
                                    >
                                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                        <span style={{ fontSize: '14px', fontWeight: 'bold', color: '#fff' }}>
                                          Capítulo {chapter.attributes.chapter}
                                        </span>
                                        <span style={{ fontSize: '11px', padding: '2px 6px', backgroundColor: 'rgba(0, 245, 212, 0.1)', color: '#00f5d4', borderRadius: '4px', fontWeight: 'bold' }}>
                                          {chapter.attributes.translatedLanguage.toUpperCase()}
                                        </span>
                                      </div>
                                      {chapter.attributes.title && (
                                        <span style={{ fontSize: '13px', color: '#8e8e9f', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                          {chapter.attributes.title}
                                        </span>
                                      )}
                                      <span style={{ fontSize: '11px', color: '#52526b', marginTop: '4px' }}>
                                        Grupo: {groupName}
                                      </span>
                                    </div>
                                  );
                                })}
                              </div>
                            )}
                          </div>
                        </div>
                      ) : (
                        /* ================== LISTADO/BÚSQUEDA DE MANGA ================== */
                        <div className="manga-catalog-view">
                          <h2 className="section-title">Lector de Manga Online</h2>
                          
                          <div className="manga-search-bar-container" style={{ position: 'relative', maxWidth: '600px', marginBottom: '30px' }}>
                            <input 
                              type="text" 
                              placeholder="Buscar Manga por título (ej. One Piece, Demon Slayer, Chainsaw Man...)" 
                              value={mangaSearchQuery}
                              onChange={(e) => setMangaSearchQuery(e.target.value)}
                              style={{ width: '100%', padding: '14px 20px 14px 45px', backgroundColor: '#13131a', border: '1px solid #27273a', borderRadius: '12px', color: '#fff', fontSize: '15px', outline: 'none', transition: 'all 0.3s', fontFamily: "'Outfit', sans-serif" }}
                            />
                            <svg style={{ position: 'absolute', left: '16px', top: '16px', color: '#52526b' }} width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                              <circle cx="11" cy="11" r="8"></circle>
                              <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
                            </svg>
                          </div>

                          {loadingMangas && mangas.length === 0 ? (
                            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '300px', gap: '15px' }}>
                              <div className="spinner" style={{ width: '40px', height: '40px', border: '4px solid rgba(0, 245, 212, 0.1)', borderTop: '4px solid #00f5d4', borderRadius: '50%', animation: 'spin 1s linear infinite' }}></div>
                              <span style={{ color: '#8e8e9f', fontSize: '15px' }}>Buscando mangas en MangaDex...</span>
                            </div>
                          ) : mangas.length === 0 ? (
                            <div style={{ padding: '50px', textAlign: 'center', backgroundColor: '#13131a', borderRadius: '12px', border: '1px solid #1a1a24', color: '#8e8e9f' }}>
                              No se encontraron mangas. Intenta con otra palabra clave.
                            </div>
                          ) : (
                            <>
                              <div className="cards-grid">
                                {mangas.map((manga) => {
                                  const coverRel = manga.relationships?.find(r => r.type === 'cover_art');
                                  const coverFileName = coverRel?.attributes?.fileName;
                                  const coverUrl = coverFileName 
                                    ? `/api/proxy?url=${encodeURIComponent(`https://uploads.mangadex.org/covers/${manga.id}/${coverFileName}.256.jpg`)}` 
                                    : "https://images.unsplash.com/photo-1578632767115-351597cf2477?auto=format&fit=crop&w=400&q=80";
                                  return (
                                    <div 
                                      key={manga.id} 
                                      className="movie-card"
                                      onClick={() => handleSelectManga(manga)}
                                    >
                                      <div className="poster-container">
                                        <img src={coverUrl} alt={getMangaTitle(manga)} className="movie-poster" loading="lazy" style={{ aspectRatio: '2/3', objectFit: 'cover' }} />
                                        <div className="card-play-overlay"><div className="play-arrow" style={{ borderLeftColor: '#00f5d4', borderBottomColor: 'transparent', borderTopColor: 'transparent' }}></div></div>
                                        <span className="movie-lang-badge">MANGA</span>
                                        {manga.attributes.year && (
                                          <span className="rating-badge">{manga.attributes.year}</span>
                                        )}
                                      </div>
                                      <div className="movie-card-info">
                                        <h3 className="movie-card-title">{getMangaTitle(manga)}</h3>
                                        <div className="movie-card-meta">
                                          <span className="movie-card-genre" style={{ color: '#00f5d4' }}>
                                            {manga.attributes.status === 'completed' ? 'Finalizado' : 'Emisión'}
                                          </span>
                                        </div>
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>

                              {loadingMangas && (
                                <div style={{ display: 'flex', justifyContent: 'center', margin: '30px 0' }}>
                                  <div className="spinner" style={{ width: '30px', height: '30px', border: '3px solid rgba(0, 245, 212, 0.1)', borderTop: '3px solid #00f5d4', borderRadius: '50%', animation: 'spin 1s linear infinite' }}></div>
                                </div>
                              )}

                              {hasMoreMangas && !loadingMangas && (
                                <div className="load-more-container" style={{ display: 'flex', justifyContent: 'center', marginTop: '30px' }}>
                                  <button 
                                    onClick={() => setMangaOffset(prev => prev + 30)} 
                                    className="load-more-btn"
                                  >
                                    Cargar más mangas
                                  </button>
                                </div>
                              )}
                            </>
                          )}
                        </div>
                      )}
                    </div>
                  )}

                  {activeTab === 'documentales' && (
                    <div className="tab-documentales-container">
                      <h2 className="section-title">Documentales</h2>
                      {(() => {
                        const visible = documentalItems.slice(0, docLimit);
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
                                    <img src={item.poster} alt={item.titulo} className="movie-poster" loading="lazy" />
                                    <div className="card-play-overlay"><div className="play-arrow"></div></div>
                                    <span className="movie-lang-badge">{getLangBadge(item)}</span>
                                    <span className="rating-badge">★ {item.valoracion}</span>
                                  </div>
                                  <div className="movie-card-info">
                                    <h3 className="movie-card-title">{item.titulo}</h3>
                                    <div className="movie-card-meta">
                                      <span className="movie-card-year">{item.año}</span>
                                      <span className="movie-card-genre">{item.tipo === 'serie' ? 'Serie' : 'Película'}</span>
                                    </div>
                                  </div>
                                </div>
                              ))}
                            </div>
                            {documentalItems.length > docLimit && (
                              <div className="load-more-container">
                                <button onClick={() => setDocLimit(prev => prev + 32)} className="load-more-btn">Cargar más</button>
                              </div>
                            )}
                          </>
                        );
                      })()}
                    </div>
                  )}

                  {activeTab === 'youtube' && (
                    <div className="tab-youtube-container">
                      <h2 className="section-title">Películas Completas de YouTube</h2>
                      {(() => {
                        const visible = youtubeItems.slice(0, ytLimit);
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
                                    <img src={item.poster} alt={item.titulo} className="movie-poster" loading="lazy" />
                                    <div className="card-play-overlay"><div className="play-arrow"></div></div>
                                    <span className="movie-lang-badge">YT</span>
                                    <span className="rating-badge">★ {item.valoracion}</span>
                                  </div>
                                  <div className="movie-card-info">
                                    <h3 className="movie-card-title">{item.titulo}</h3>
                                    <div className="movie-card-meta">
                                      <span className="movie-card-year">{item.año}</span>
                                      <span className="movie-card-genre">YouTube</span>
                                    </div>
                                  </div>
                                </div>
                              ))}
                            </div>
                            {youtubeItems.length > ytLimit && (
                              <div className="load-more-container">
                                <button onClick={() => setYtLimit(prev => prev + 32)} className="load-more-btn">Cargar más</button>
                              </div>
                            )}
                          </>
                        );
                      })()}
                    </div>
                  )}

                  {activeTab === 'favoritos' && (
                    <div className="tab-favoritos-container">
                      <h2 className="section-title">Mis Favoritos</h2>
                      {(() => {
                        if (favorites.length === 0) {
                          return (
                            <div className="no-results" style={{ padding: '80px 20px', textAlign: 'center', color: '#6b7280', fontSize: '15px' }}>
                              Aún no tienes elementos guardados en tus favoritos. Haz clic en "Añadir a Favoritos" en la ficha técnica de tus contenidos preferidos para agregarlos aquí.
                            </div>
                          );
                        }
                        return (
                          <div className="cards-grid">
                            {favorites.map((item) => (
                              <div 
                                key={item.id} 
                                className="movie-card"
                                onClick={() => handleCardClick(item)}
                                onDoubleClick={() => handleCardDoubleClick(item)}
                              >
                                <div className="poster-container">
                                  <img src={item.poster} alt={item.titulo} className="movie-poster" loading="lazy" />
                                  <div className="card-play-overlay"><div className="play-arrow"></div></div>
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
                        );
                      })()}
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
                        if (filteredTdtCanales.length === 0) {
                          return (
                            <div className="no-results" style={{ padding: '40px 0', textAlign: 'center', color: '#6b7280' }}>
                              No se encontraron canales para este filtro.
                            </div>
                          );
                        }

                        return (
                          <div className="cards-grid">
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
                        if (searchQuery) {
                          if (filteredFreeCanales.length === 0) {
                            return (
                              <div className="no-results" style={{ padding: '40px 0', textAlign: 'center', color: '#6b7280' }}>
                                No se encontraron canales de cine para tu búsqueda.
                              </div>
                            );
                          }
                          return (
                            <div className="cards-grid">
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
                              items={freeLatino}
                              onSelect={handleCardClick}
                              onPlay={handleCardDoubleClick}
                            />
                            <CategoryRow 
                              title="Cine de Acción y Suspenso" 
                              items={freeAccion} 
                              onSelect={handleCardClick}
                              onPlay={handleCardDoubleClick}
                            />
                            <CategoryRow 
                              title="Cine General y Blockbusters" 
                              items={freeGeneral}
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
                        const filtered = filterByLetter(sortedMovies, selectedLetter);
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
                                      <span className="movie-card-year">{item.año}</span>
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
                        const filtered = filterByLetter(sortedSeries, selectedSeriesLetter);
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
                                      <span className="movie-card-year">{item.año}</span>
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
            </div>
          )}
        </main>

        {/* 4. FOOTER */}
        <footer className="main-footer">
          <div className="footer-content">
            <p>FilmTV - Portal elegante de streaming. Todos los derechos a sus respectivos servidores externos.</p>
          </div>
        </footer>
      </div>

      {/* 5. AVISO DE COOKIES */}
      {showCookieBanner && (
        <div className="cookie-banner-overlay">
          <div className="cookie-banner">
            <div className="cookie-content">
              <h3>Aviso de Cookies</h3>
              <p>Este portal elegante utiliza cookies locales para guardar tus canales y películas favoritos, y para recordar tus preferencias de reproducción. Al continuar navegando, aceptas su uso.</p>
            </div>
            <button className="cookie-accept-btn" onClick={() => {
              localStorage.setItem('filmtv_cookie_consent', 'accepted');
              setShowCookieBanner(false);
            }}>
              Aceptar
            </button>
          </div>
        </div>
      )}

      {/* 6. MODAL DE TRÁILER LIGHTBOX */}
      {showTrailerModal && trailerKey && (
        <div className="trailer-modal-overlay" onClick={() => { setShowTrailerModal(false); setTrailerKey(null); }}>
          <div className="trailer-modal-content" onClick={(e) => e.stopPropagation()}>
            <button className="trailer-close-btn" onClick={() => { setShowTrailerModal(false); setTrailerKey(null); }}>✕</button>
            <div className="trailer-video-wrapper">
              <iframe
                src={`https://www.youtube.com/embed/${trailerKey}?autoplay=1&rel=0`}
                allowFullScreen
                allow="autoplay; encrypted-media; fullscreen"
                className="trailer-iframe"
              />
            </div>
          </div>
        </div>
      )}

      {/* 7. MODAL DE DETALLES NETFLIX-STYLE */}
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
                  <span>{selectedItemDetails.año}</span>
                  <span className="modal-genre-tag">{selectedItemDetails.categoria}</span>
                  <span>{selectedItemDetails.tipo === 'serie' ? 'Serie de TV' : 'Película'}</span>
                </div>
                <div style={{ display: 'flex', gap: '12px' }}>
                  <button className="modal-play-action-btn" onClick={() => {
                    setActiveItem(selectedItemDetails);
                    setSelectedItemDetails(null);
                  }}>
                    Reproducir Ahora
                  </button>
                  <button 
                    className={`modal-fav-action-btn ${favorites.some(fav => fav.id === selectedItemDetails.id) ? 'is-fav' : ''}`}
                    onClick={() => toggleFavorite(selectedItemDetails)}
                  >
                    {favorites.some(fav => fav.id === selectedItemDetails.id) ? '★ Quitar de Favoritos' : '☆ Añadir a Favoritos'}
                  </button>
                </div>
              </div>
            </div>

            <div className="modal-body-desc">
              <div className="modal-desc-column">
                <h3>Sinopsis</h3>
                <p>{selectedItemDetails.descripcion}</p>
              </div>
              
              {/* ELENCO / CAST SECTION */}
              {selectedItemDetails.categoria !== 'YouTube' && (
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
              )}

              {/* RECOMENDACIONES SECTION */}
              {selectedItemDetails.categoria !== 'YouTube' && (
                <div className="modal-recs-section">
                  <h3>Recomendaciones</h3>
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
              )}
            </div>
          </div>
        </div>
      )}

      {/* 8. DISEÑO ESTÉTICO EN VANILLA CSS (CSS-in-JS Global) */}
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

      /* Style JSX Local Removed */
    </div>
  );
}
