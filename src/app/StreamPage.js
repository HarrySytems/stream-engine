"use client";

import { useState, useEffect, useRef, useMemo } from 'react';

// Helper determinista para badge de idioma
const getLangBadge = (item) => {
  if (!item) return 'MULTI';
  if (item.tipo === 'serie') return 'MULTI';
  const tmdbIdInt = item.tmdbId ? parseInt(item.tmdbId) : 0;
  const hash = tmdbIdInt || (item.id ? item.id.charCodeAt(0) + (item.id.charCodeAt(item.id.length - 1) || 0) : 0);
  const val = hash % 3;
  if (val === 0) return 'LAT';
  if (val === 1) return 'SUB';
  return 'MULTI';
};

const isYouTubeUrl = (url) => {
  if (!url) return false;
  return url.includes('youtube.com') || url.includes('youtu.be') || url.includes('youtube-nocookie.com');
};

const getYouTubeId = (url) => {
  if (!url) return null;
  const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|\&v=|\/live\/)([^#\&\?]*).*/;
  const match = url.match(regExp);
  return (match && match[2].length === 11) ? match[2] : null;
};

// Componente para logo de canales con fallback elegante
function ChannelLogo({ item, className, style }) {
  const [hasError, setHasError] = useState(false);
  const displayName = item?.nombre || item?.titulo || 'TV';

  if (hasError || !item?.logo || item.logo.includes('imgur.com') || item.logo.includes('example.com')) {
    const initials = displayName
      .replace(/[\(\[].*?[\)\]]/g, '')
      .split(/\s+/)
      .filter(w => w.length > 0)
      .slice(0, 3)
      .map(w => w[0].toUpperCase())
      .join('');

    return (
      <div 
        className={className}
        style={{
          ...style,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'linear-gradient(135deg, #1b1d28 0%, #2a2d3d 100%)',
          color: '#ffffff',
          fontWeight: '800',
          fontSize: '13px',
          fontFamily: 'Outfit, Inter, sans-serif'
        }}
      >
        <span>{initials || 'TV'}</span>
      </div>
    );
  }

  return (
    <img 
      src={item.logo} 
      alt={displayName} 
      className={className} 
      style={style}
      loading="lazy"
      onError={() => setHasError(true)}
    />
  );
}

// Carrusel horizontal de contenido On-Demand
function ContentShelf({ title, items, onSelect, onPlay }) {
  const scrollRef = useRef(null);

  const handleScroll = (dir) => {
    if (scrollRef.current) {
      const { scrollLeft, clientWidth } = scrollRef.current;
      const scrollAmount = dir === 'left' ? -clientWidth * 0.75 : clientWidth * 0.75;
      scrollRef.current.scrollTo({ left: scrollLeft + scrollAmount, behavior: 'smooth' });
    }
  };

  if (!items || items.length === 0) return null;

  return (
    <div className="content-shelf-container">
      <div className="shelf-header">
        <h2 className="shelf-title">{title}</h2>
      </div>
      <div className="shelf-carousel-wrap">
        <button className="shelf-nav-btn prev" onClick={() => handleScroll('left')}>&lsaquo;</button>
        <div className="shelf-scroll-track" ref={scrollRef}>
          {items.map((item) => (
            <div 
              key={item.id} 
              className="movie-card-poster"
              onClick={() => onSelect(item)}
              onDoubleClick={() => onPlay(item)}
            >
              <img 
                src={item.poster || "https://images.unsplash.com/photo-1489599849927-2ee91cede3ba?auto=format&fit=crop&w=400&q=80"} 
                alt={item.titulo} 
                className="movie-poster-img"
                loading="lazy" 
              />
              <span className="card-lang-badge">{getLangBadge(item)}</span>
              {item.valoracion && <span className="card-rating-badge">★ {item.valoracion}</span>}
              <div className="card-info-bottom">
                <span className="card-title-text">{item.titulo || item.nombre}</span>
                <span className="card-year-text">{item.año || item.categoria}</span>
              </div>
            </div>
          ))}
        </div>
        <button className="shelf-nav-btn next" onClick={() => handleScroll('right')}>&rsaquo;</button>
      </div>
    </div>
  );
}

export default function StreamPage({ initialPeliculas = [], allPeliculas = [], initialCanales = [] }) {
  // Navegación
  const [activeTab, setActiveTab] = useState('envivo'); // 'envivo' | 'peliculas' | 'series' | 'anime' | 'manga' | 'favoritos'
  const [liveCategory, setLiveCategory] = useState('Todos');
  const [movieGenreFilter, setMovieGenreFilter] = useState('Todos');

  // Catálogos
  const [peliculas] = useState(allPeliculas.length > 0 ? allPeliculas : initialPeliculas);
  const [canales] = useState(initialCanales);
  const [favorites, setFavorites] = useState([]);

  // Elemento reproduciéndose activamente
  const [activeItem, setActiveItem] = useState(() => {
    // Por defecto inicia reproduciendo el primer canal de TV o película
    if (initialCanales && initialCanales.length > 0) {
      return initialCanales[0];
    }
    return initialPeliculas[0] || null;
  });

  // Estado del reproductor
  const [isPlaying, setIsPlaying] = useState(true);
  const [isMuted, setIsMuted] = useState(true);
  const [isMiniPlayer, setIsMiniPlayer] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [activeServer, setActiveServer] = useState(0); // 0: VidSrc, 1: Embed.su, 2: VidLink, 3: VidSrc.cc, 4: Smashy
  const [antiAds, setAntiAds] = useState(true);

  // Series: Temporada y Episodio
  const [activeSeason, setActiveSeason] = useState(1);
  const [activeEpisode, setActiveEpisode] = useState(1);

  // Modal de detalles y descarga
  const [detailModalItem, setDetailModalItem] = useState(null);
  const [downloading, setDownloading] = useState(false);
  const [downloadInfo, setDownloadInfo] = useState(null);

  // Búsqueda
  const [searchQuery, setSearchQuery] = useState('');

  // Mangas
  const [mangas, setMangas] = useState([]);
  const [mangaSearch, setMangaSearch] = useState('');
  const [loadingMangas, setLoadingMangas] = useState(false);
  const [selectedManga, setSelectedManga] = useState(null);
  const [mangaChapters, setMangaChapters] = useState([]);
  const [activeChapter, setActiveChapter] = useState(null);
  const [chapterPages, setChapterPages] = useState([]);
  const [loadingChapterPages, setLoadingChapterPages] = useState(false);

  const videoRef = useRef(null);
  const hlsRef = useRef(null);
  const heroRef = useRef(null);

  // Lista de servidores de respaldo silencioso
  const servers = [
    { id: 0, name: 'Servidor 1 (Ultra Rápido)', provider: 'vidsrc.to' },
    { id: 1, name: 'Servidor 2 (Embed.su)', provider: 'embed.su' },
    { id: 2, name: 'Servidor 3 (VidLink Multi-Audio)', provider: 'vidlink.pro' },
    { id: 3, name: 'Servidor 4 (VidSrc.cc)', provider: 'vidsrc.cc' },
    { id: 4, name: 'Servidor 5 (SmashyStream)', provider: 'smashystream.xyz' },
  ];

  // Cargar Favoritos
  useEffect(() => {
    try {
      const stored = localStorage.getItem('filmtv_favorites');
      if (stored) setFavorites(JSON.parse(stored));
    } catch (e) {
      console.error(e);
    }
  }, []);

  const toggleFavorite = (item) => {
    let updated;
    if (favorites.some(f => f.id === item.id)) {
      updated = favorites.filter(f => f.id !== item.id);
    } else {
      updated = [...favorites, item];
    }
    setFavorites(updated);
    try {
      localStorage.setItem('filmtv_favorites', JSON.stringify(updated));
    } catch (e) {}
  };

  // Mini-Player automático al scrollear
  useEffect(() => {
    const handleScroll = () => {
      if (!heroRef.current) return;
      const rect = heroRef.current.getBoundingClientRect();
      // Si el reproductor sale de la pantalla por arriba, se activa el modo flotante
      if (rect.bottom < 100) {
        setIsMiniPlayer(true);
      } else {
        setIsMiniPlayer(false);
      }
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // Inicializar reproductor HLS para canales de televisión en vivo
  useEffect(() => {
    let isCancelled = false;

    if (activeItem && activeItem.tipo === 'canal' && !isYouTubeUrl(activeItem.url) && videoRef.current) {
      const video = videoRef.current;
      const streamUrl = activeItem.url;

      const initHls = async () => {
        try {
          const Hls = (await import('hls.js')).default;
          if (isCancelled) return;

          if (hlsRef.current) {
            hlsRef.current.destroy();
          }

          if (Hls.isSupported()) {
            const hls = new Hls({
              enableWorker: true,
              lowLatencyMode: true,
              liveSyncDurationCount: 3,
            });
            hls.loadSource(streamUrl);
            hls.attachMedia(video);
            hlsRef.current = hls;

            hls.on(Hls.Events.MANIFEST_PARSED, () => {
              if (isPlaying) {
                video.play().catch(() => {});
              }
            });

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
            if (isPlaying) video.play().catch(() => {});
          }
        } catch (err) {
          console.error("Error al iniciar HLS", err);
        }
      };

      initHls();
    }

    return () => {
      isCancelled = true;
      if (hlsRef.current) {
        hlsRef.current.destroy();
        hlsRef.current = null;
      }
    };
  }, [activeItem]);

  // Generar URL del reproductor según el servidor
  const getEmbedUrl = () => {
    if (!activeItem) return '';
    if (activeItem.tipo === 'canal') {
      if (isYouTubeUrl(activeItem.url)) {
        const ytid = getYouTubeId(activeItem.url);
        return `https://www.youtube-nocookie.com/embed/${ytid}?autoplay=1&mute=${isMuted ? 1 : 0}`;
      }
      return ''; // Canales normales usan el tag <video> HLS
    }

    const tmdbId = activeItem.tmdbId || activeItem.id?.replace('movie-', '')?.replace('serie-', '') || '157336';
    const isTv = activeItem.tipo === 'serie';

    switch (activeServer) {
      case 0: // VidSrc.to
        return isTv 
          ? `https://vidsrc.to/embed/tv/${tmdbId}/${activeSeason}/${activeEpisode}`
          : `https://vidsrc.to/embed/movie/${tmdbId}`;
      case 1: // Embed.su
        return isTv
          ? `https://embed.su/embed/tv/${tmdbId}/${activeSeason}/${activeEpisode}`
          : `https://embed.su/embed/movie/${tmdbId}`;
      case 2: // VidLink
        return isTv
          ? `https://vidlink.pro/tv/${tmdbId}/${activeSeason}/${activeEpisode}`
          : `https://vidlink.pro/movie/${tmdbId}`;
      case 3: // VidSrc.cc
        return isTv
          ? `https://vidsrc.cc/v2/embed/tv/${tmdbId}/${activeSeason}/${activeEpisode}`
          : `https://vidsrc.cc/v2/embed/movie/${tmdbId}`;
      case 4: // SmashyStream
        return isTv
          ? `https://player.smashystream.xyz/tv/${tmdbId}?s=${activeSeason}&e=${activeEpisode}`
          : `https://player.smashystream.xyz/movie/${tmdbId}`;
      default:
        return `https://vidsrc.to/embed/movie/${tmdbId}`;
    }
  };

  // Función para resolver descarga directa
  const handleDownload = async (item) => {
    if (!item || item.tipo === 'canal') return;
    setDownloading(true);
    try {
      const tmdbId = item.tmdbId || item.id?.replace('movie-', '')?.replace('serie-', '') || '';
      const isTv = item.tipo === 'serie';
      const res = await fetch(`/api/download?id=${encodeURIComponent(item.id)}&tmdbId=${encodeURIComponent(tmdbId)}&title=${encodeURIComponent(item.titulo || item.nombre)}&type=${isTv ? 'tv' : 'movie'}&season=${activeSeason}&episode=${activeEpisode}`);
      const data = await res.json();
      if (data.success) {
        setDownloadInfo(data);
      }
    } catch (err) {
      console.error("Error al obtener descarga:", err);
    } finally {
      setDownloading(false);
    }
  };

  // Filtros de TV en Vivo
  const liveCategories = useMemo(() => {
    const cats = new Set(['Todos']);
    canales.forEach(c => {
      if (c.categoria) cats.add(c.categoria);
    });
    return Array.from(cats);
  }, [canales]);

  const filteredCanales = useMemo(() => {
    let list = canales;
    if (liveCategory !== 'Todos') {
      list = list.filter(c => c.categoria === liveCategory);
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter(c => (c.nombre || c.titulo || '').toLowerCase().includes(q));
    }
    return list;
  }, [canales, liveCategory, searchQuery]);

  // Agrupación de Películas por Géneros
  const movieGenres = ['Todos', 'Acción', 'Ciencia Ficción', 'Terror', 'Comedia', 'Drama', 'Infantil', 'Anime', 'Clásicos'];

  const peliculasPorGenero = useMemo(() => {
    const grupos = {
      'Estrenos y Destacados': peliculas.filter(p => p.tipo === 'pelicula' && parseInt(p.año) >= 2023).slice(0, 20),
      'Acción y Aventura': peliculas.filter(p => p.tipo === 'pelicula' && (p.categoria === 'Acción' || p.categoria === 'Aventura')).slice(0, 20),
      'Ciencia Ficción': peliculas.filter(p => p.tipo === 'pelicula' && p.categoria === 'Ciencia Ficción').slice(0, 20),
      'Terror y Suspenso': peliculas.filter(p => p.tipo === 'pelicula' && (p.categoria === 'Terror' || p.categoria === 'Suspenso')).slice(0, 20),
      'Comedia': peliculas.filter(p => p.tipo === 'pelicula' && p.categoria === 'Comedia').slice(0, 20),
      'Drama': peliculas.filter(p => p.tipo === 'pelicula' && p.categoria === 'Drama').slice(0, 20),
      'Infantil y Familiar': peliculas.filter(p => p.tipo === 'pelicula' && (p.categoria === 'Infantil' || p.categoria === 'Animación')).slice(0, 20),
      'Clásicos Inolvidables': peliculas.filter(p => p.tipo === 'pelicula' && parseInt(p.año) < 2005).slice(0, 20)
    };
    return grupos;
  }, [peliculas]);

  const seriesPopulares = useMemo(() => {
    return peliculas.filter(p => p.tipo === 'serie' && p.categoria !== 'Anime').slice(0, 30);
  }, [peliculas]);

  const animeList = useMemo(() => {
    return peliculas.filter(p => p.categoria === 'Anime').slice(0, 30);
  }, [peliculas]);

  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#08080a', paddingBottom: '70px' }}>
      
      {/* 1. HEADER / TOP NAVBAR */}
      <header className="pluto-header">
        <div className="header-left">
          <div className="pluto-logo" onClick={() => { setActiveTab('envivo'); window.scrollTo({ top: 0, behavior: 'smooth' }); }}>
            <span className="logo-film">FILM</span>
            <span className="logo-badge">TV</span>
          </div>

          <nav className="pluto-nav-tabs">
            <button 
              className={`nav-tab-btn ${activeTab === 'envivo' ? 'active' : ''}`}
              onClick={() => setActiveTab('envivo')}
            >
              TV en Vivo
            </button>
            <button 
              className={`nav-tab-btn ${activeTab === 'peliculas' ? 'active' : ''}`}
              onClick={() => setActiveTab('peliculas')}
            >
              Películas
            </button>
            <button 
              className={`nav-tab-btn ${activeTab === 'series' ? 'active' : ''}`}
              onClick={() => setActiveTab('series')}
            >
              Series
            </button>
            <button 
              className={`nav-tab-btn ${activeTab === 'anime' ? 'active' : ''}`}
              onClick={() => setActiveTab('anime')}
            >
              Anime
            </button>
            <button 
              className={`nav-tab-btn ${activeTab === 'manga' ? 'active' : ''}`}
              onClick={() => setActiveTab('manga')}
            >
              Manga
            </button>
            <button 
              className={`nav-tab-btn ${activeTab === 'favoritos' ? 'active' : ''}`}
              onClick={() => setActiveTab('favoritos')}
            >
              Favoritos {favorites.length > 0 && `(${favorites.length})`}
            </button>
          </nav>
        </div>

        <div className="header-right">
          <div className="search-box-container">
            <svg className="search-icon-svg" viewBox="0 0 24 24">
              <path d="M15.5 14h-.79l-.28-.27C15.41 12.59 16 11.11 16 9.5 16 5.91 13.09 3 9.5 3S3 5.91 3 9.5 5.91 16 9.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z" />
            </svg>
            <input 
              type="text" 
              className="search-input-pluto" 
              placeholder="Buscar contenido..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
        </div>
      </header>

      {/* 2. HERO / REPRODUCTOR PRINCIPAL */}
      <section className="hero-player-section" ref={heroRef}>
        <div className="hero-player-container">
          
          {/* Quick Controls: Mute, Settings Gear ⚙️ */}
          <div className="player-quick-controls">
            {activeItem?.tipo === 'canal' && !isYouTubeUrl(activeItem?.url) && (
              <button 
                className="control-icon-btn"
                title={isMuted ? "Activar Sonido" : "Silenciar"}
                onClick={() => {
                  if (videoRef.current) {
                    videoRef.current.muted = !isMuted;
                    setIsMuted(!isMuted);
                  }
                }}
              >
                {isMuted ? '🔇' : '🔊'}
              </button>
            )}

            {activeItem?.tipo !== 'canal' && (
              <div style={{ position: 'relative' }}>
                <button 
                  className="control-icon-btn" 
                  title="Ajustes de Servidor"
                  onClick={() => setShowSettings(!showSettings)}
                >
                  ⚙️
                </button>

                {showSettings && (
                  <div className="player-settings-popup">
                    <span className="settings-popup-title">Seleccionar Fuente / Servidor</span>
                    {servers.map((srv) => (
                      <button
                        key={srv.id}
                        className={`server-option-btn ${activeServer === srv.id ? 'active' : ''}`}
                        onClick={() => {
                          setActiveServer(srv.id);
                          setShowSettings(false);
                        }}
                      >
                        <span>{srv.name}</span>
                        {activeServer === srv.id && <span>✓</span>}
                      </button>
                    ))}
                    <div style={{ borderTop: '1px solid rgba(255,255,255,0.08)', paddingTop: '8px', marginTop: '4px' }}>
                      <button 
                        className="server-option-btn"
                        onClick={() => setAntiAds(!antiAds)}
                      >
                        <span>Anti-Publicidad</span>
                        <span>{antiAds ? 'Activado' : 'Desactivado'}</span>
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Renderizado de Video: HLS para TV o Iframe Embed para Pelis */}
          {activeItem?.tipo === 'canal' && !isYouTubeUrl(activeItem?.url) ? (
            <video 
              ref={videoRef}
              className="player-video-element"
              controls
              playsInline
              muted={isMuted}
              autoPlay
            />
          ) : (
            <iframe 
              key={`${activeItem?.id}-${activeServer}-${activeSeason}-${activeEpisode}`}
              src={getEmbedUrl()}
              className="player-iframe-embed"
              allow="autoplay; fullscreen; encrypted-media; picture-in-picture"
              allowFullScreen
              sandbox={antiAds ? "allow-forms allow-scripts allow-same-origin allow-presentation" : undefined}
            />
          )}

          {/* Información y botones en el Hero */}
          <div className="hero-info-overlay">
            {activeItem?.tipo === 'canal' && (
              <span className="hero-live-tag">
                <span className="live-dot"></span> EN VIVO
              </span>
            )}
            <h1 className="hero-title-text">{activeItem?.titulo || activeItem?.nombre || 'FilmTV'}</h1>
            <div className="hero-meta-row">
              {activeItem?.año && <span className="meta-pill">{activeItem.año}</span>}
              <span className="meta-pill">{activeItem?.categoria || 'Streaming'}</span>
              <span className="meta-pill">{getLangBadge(activeItem)}</span>
              {activeItem?.valoracion && <span>★ {activeItem.valoracion}</span>}
            </div>
            {activeItem?.sinopsis && (
              <p className="hero-synopsis">{activeItem.sinopsis}</p>
            )}

            <div className="hero-actions-bar">
              {activeItem?.tipo !== 'canal' && (
                <button 
                  className="btn-secondary-action"
                  onClick={() => handleDownload(activeItem)}
                >
                  ⬇️ Descargar
                </button>
              )}
              <button 
                className="btn-secondary-action"
                onClick={() => activeItem && toggleFavorite(activeItem)}
              >
                {activeItem && favorites.some(f => f.id === activeItem.id) ? '★ Guardado' : '☆ Guardar'}
              </button>
            </div>
          </div>

        </div>
      </section>

      {/* 3. MINI-REPRODUCTOR FLOTANTE (PICTURE-IN-PICTURE AL HACER SCROLL) */}
      {isMiniPlayer && activeItem && (
        <div className="floating-mini-player">
          <div className="mini-player-overlay-bar">
            <span className="mini-player-title">{activeItem.titulo || activeItem.nombre}</span>
            <div className="mini-controls-group">
              <button 
                className="mini-btn" 
                title="Volver Arriba"
                onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
              >
                ▲
              </button>
              <button 
                className="mini-btn" 
                title="Cerrar Mini Player"
                onClick={() => setIsMiniPlayer(false)}
              >
                ✕
              </button>
            </div>
          </div>
          {activeItem.tipo === 'canal' && !isYouTubeUrl(activeItem.url) ? (
            <video 
              src={activeItem.url} 
              className="player-video-element" 
              autoPlay 
              muted={isMuted} 
              playsInline 
            />
          ) : (
            <iframe 
              src={getEmbedUrl()} 
              className="player-iframe-embed" 
              allow="autoplay; fullscreen"
            />
          )}
        </div>
      )}

      {/* 4. VISTA: TV EN VIVO (GUÍA EPG ESTILO PLUTO TV) */}
      {activeTab === 'envivo' && (
        <main className="live-guide-container">
          
          {/* Píldoras de categorías */}
          <div className="epg-category-pills">
            {liveCategories.map((cat) => (
              <button 
                key={cat}
                className={`category-pill-btn ${liveCategory === cat ? 'active' : ''}`}
                onClick={() => setLiveCategory(cat)}
              >
                {cat}
              </button>
            ))}
          </div>

          {/* Tabla / Cuadrícula EPG de Canales */}
          <div className="epg-channels-grid">
            {filteredCanales.map((canal) => {
              const isCurrent = activeItem?.id === canal.id;
              return (
                <div 
                  key={canal.id} 
                  className={`epg-channel-row ${isCurrent ? 'active' : ''}`}
                  onClick={() => {
                    setActiveItem(canal);
                    setIsMuted(false);
                    window.scrollTo({ top: 0, behavior: 'smooth' });
                  }}
                >
                  {/* Columna 1: Logo y Nombre */}
                  <div className="epg-channel-info">
                    <div className="epg-channel-logo-wrap">
                      <ChannelLogo item={canal} className="epg-channel-logo-img" />
                    </div>
                    <div className="epg-channel-name-col">
                      <span className="epg-channel-name">{canal.nombre || canal.titulo}</span>
                      <span className="epg-channel-cat">{canal.pais || canal.categoria || 'Canal'}</span>
                    </div>
                  </div>

                  {/* Columna 2: Programa Actual y Barra de Tiempo */}
                  <div className="epg-program-info">
                    <span className="epg-program-title">{canal.nombre || 'Transmisión en directo'}</span>
                    <div className="epg-progress-bar-wrap">
                      <div className="epg-progress-bar-fill" style={{ width: `${(canal.id?.charCodeAt(0) || 50) % 65 + 30}%` }}></div>
                    </div>
                    <span className="epg-program-time">Señal continua 24/7</span>
                  </div>

                  {/* Columna 3: Ecualizador Animado o Badge EN VIVO */}
                  <div className="epg-equalizer-wrap">
                    {isCurrent ? (
                      <div className="sound-bars-anim" title="Reproduciendo Ahora">
                        <span className="sound-bar"></span>
                        <span className="sound-bar"></span>
                        <span className="sound-bar"></span>
                      </div>
                    ) : (
                      <span className="live-badge-red">
                        <span className="live-dot"></span> EN VIVO
                      </span>
                    )}
                  </div>

                </div>
              );
            })}
          </div>

        </main>
      )}

      {/* 5. VISTA: PELÍCULAS A LA CARTA */}
      {activeTab === 'peliculas' && (
        <main className="on-demand-section">
          {Object.entries(peliculasPorGenero).map(([genreTitle, items]) => (
            <ContentShelf 
              key={genreTitle}
              title={genreTitle}
              items={items}
              onSelect={(item) => setDetailModalItem(item)}
              onPlay={(item) => {
                setActiveItem(item);
                window.scrollTo({ top: 0, behavior: 'smooth' });
              }}
            />
          ))}
        </main>
      )}

      {/* 6. VISTA: SERIES A LA CARTA */}
      {activeTab === 'series' && (
        <main className="on-demand-section">
          <ContentShelf 
            title="Series Populares y Temporadas Completas"
            items={seriesPopulares}
            onSelect={(item) => setDetailModalItem(item)}
            onPlay={(item) => {
              setActiveItem(item);
              window.scrollTo({ top: 0, behavior: 'smooth' });
            }}
          />
        </main>
      )}

      {/* 7. VISTA: ANIME */}
      {activeTab === 'anime' && (
        <main className="on-demand-section">
          <ContentShelf 
            title="Catálogo Anime HD"
            items={animeList}
            onSelect={(item) => setDetailModalItem(item)}
            onPlay={(item) => {
              setActiveItem(item);
              window.scrollTo({ top: 0, behavior: 'smooth' });
            }}
          />
        </main>
      )}

      {/* 8. VISTA: MANGA */}
      {activeTab === 'manga' && (
        <main className="on-demand-section" style={{ color: '#ffffff' }}>
          <h2 className="shelf-title" style={{ marginBottom: '16px' }}>Lector de Manga Online</h2>
          <div style={{ display: 'flex', gap: '10px', marginBottom: '24px' }}>
            <input 
              type="text"
              className="search-input-pluto"
              style={{ width: '100%', maxWidth: '400px' }}
              placeholder="Buscar título de manga (ej: One Piece, Naruto)..."
              value={mangaSearch}
              onChange={(e) => setMangaSearch(e.target.value)}
              onKeyDown={async (e) => {
                if (e.key === 'Enter' && mangaSearch.trim()) {
                  setLoadingMangas(true);
                  try {
                    const res = await fetch(`/api/anime?q=${encodeURIComponent(mangaSearch)}`);
                    const data = await res.json();
                    setMangas(data.data || []);
                  } catch (err) {
                    console.error(err);
                  } finally {
                    setLoadingMangas(false);
                  }
                }
              }}
            />
          </div>

          {loadingMangas && <p style={{ color: 'var(--text-muted)' }}>Buscando mangas en la base de datos...</p>}

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: '16px' }}>
            {mangas.map((m) => (
              <div 
                key={m.id}
                className="movie-card-poster"
                onClick={async () => {
                  setSelectedManga(m);
                  try {
                    const res = await fetch(`/api/anime?mangaId=${m.id}&lang=es`);
                    const data = await res.json();
                    setMangaChapters(data.data || []);
                  } catch (e) {}
                }}
              >
                <div style={{ padding: '12px', height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', background: 'linear-gradient(180deg, #1b1d28 0%, #0c0d12 100%)' }}>
                  <span className="card-title-text">{m.attributes?.title?.es || m.attributes?.title?.en || 'Manga'}</span>
                </div>
              </div>
            ))}
          </div>

          {/* Capítulos del manga */}
          {selectedManga && mangaChapters.length > 0 && (
            <div style={{ marginTop: '32px', background: '#12131b', padding: '20px', borderRadius: '12px' }}>
              <h3 style={{ fontSize: '18px', marginBottom: '14px' }}>Capítulos Disponibles</h3>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', maxHeight: '200px', overflowY: 'auto' }}>
                {mangaChapters.map((ch) => (
                  <button 
                    key={ch.id}
                    className="category-pill-btn"
                    onClick={async () => {
                      setActiveChapter(ch);
                      setLoadingChapterPages(true);
                      try {
                        const res = await fetch(`/api/anime?chapterId=${ch.id}`);
                        const data = await res.json();
                        setChapterPages(data.pages || []);
                      } catch (e) {}
                      finally {
                        setLoadingChapterPages(false);
                      }
                    }}
                  >
                    Cap. {ch.attributes?.chapter || '1'}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Visor de Páginas del Manga */}
          {chapterPages.length > 0 && (
            <div style={{ marginTop: '24px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '16px' }}>
              {chapterPages.map((pageUrl, idx) => (
                <img 
                  key={idx} 
                  src={pageUrl} 
                  alt={`Página ${idx + 1}`} 
                  style={{ maxWidth: '100%', maxHeight: '90vh', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.1)' }} 
                  loading="lazy"
                />
              ))}
            </div>
          )}
        </main>
      )}

      {/* 9. VISTA: FAVORITOS */}
      {activeTab === 'favoritos' && (
        <main className="on-demand-section">
          <h2 className="shelf-title" style={{ marginBottom: '20px' }}>Mis Contenidos Guardados</h2>
          {favorites.length === 0 ? (
            <p style={{ color: 'var(--text-muted)', marginTop: '20px' }}>Aún no tienes contenidos guardados. Explora el catálogo y pulsa "☆ Guardar" para añadirlos aquí.</p>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: '18px' }}>
              {favorites.map((item) => (
                <div 
                  key={item.id} 
                  className="movie-card-poster"
                  onClick={() => {
                    setActiveItem(item);
                    window.scrollTo({ top: 0, behavior: 'smooth' });
                  }}
                >
                  <img src={item.poster || item.logo} alt={item.titulo || item.nombre} className="movie-poster-img" />
                  <div className="card-info-bottom">
                    <span className="card-title-text">{item.titulo || item.nombre}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </main>
      )}

      {/* 10. MODAL DE DETALLES Y DESCARGA */}
      {detailModalItem && (
        <div className="modal-backdrop-blur" onClick={() => { setDetailModalItem(null); setDownloadInfo(null); }}>
          <div className="detail-modal-card" onClick={(e) => e.stopPropagation()}>
            <button className="modal-close-btn" onClick={() => { setDetailModalItem(null); setDownloadInfo(null); }}>✕</button>
            <div className="modal-body-grid">
              
              <div className="modal-poster-wrap">
                <img 
                  src={detailModalItem.poster || "https://images.unsplash.com/photo-1489599849927-2ee91cede3ba?auto=format&fit=crop&w=400&q=80"} 
                  alt={detailModalItem.titulo} 
                  className="modal-poster-img" 
                />
              </div>

              <div className="modal-info-col">
                <h2 className="modal-title-text">{detailModalItem.titulo || detailModalItem.nombre}</h2>
                <div className="hero-meta-row">
                  {detailModalItem.año && <span className="meta-pill">{detailModalItem.año}</span>}
                  <span className="meta-pill">{detailModalItem.categoria || 'Película'}</span>
                  <span className="meta-pill">{getLangBadge(detailModalItem)}</span>
                  {detailModalItem.valoracion && <span>★ {detailModalItem.valoracion}</span>}
                </div>

                <p className="modal-synopsis-text">
                  {detailModalItem.sinopsis || "Disfruta de este contenido en alta definición con reproducción fluida y múltiples opciones de servidor en FilmTV."}
                </p>

                {/* Botón para reproducir */}
                <div style={{ display: 'flex', gap: '10px', marginTop: '12px' }}>
                  <button 
                    className="btn-primary-play"
                    onClick={() => {
                      setActiveItem(detailModalItem);
                      setDetailModalItem(null);
                      window.scrollTo({ top: 0, behavior: 'smooth' });
                    }}
                  >
                    ▶ Reproducir Ahora
                  </button>

                  <button 
                    className="btn-secondary-action"
                    onClick={() => handleDownload(detailModalItem)}
                    disabled={downloading}
                  >
                    {downloading ? 'Generando...' : '⬇️ Descargar'}
                  </button>
                </div>

                {/* Panel de Descarga directa */}
                {downloadInfo && (
                  <div className="download-dialog-box">
                    <span className="download-box-header">
                      <span>✓ Enlace Listo:</span> {downloadInfo.fileName}
                    </span>
                    <div className="download-options-grid">
                      {downloadInfo.qualityOptions?.map((opt, i) => (
                        <a 
                          key={i}
                          href={opt.url}
                          target="_blank"
                          rel="noreferrer"
                          className="download-quality-btn"
                          style={{ textDecoration: 'none' }}
                        >
                          <span>{opt.label}</span>
                          <span className="tag">Descarga Directa</span>
                        </a>
                      ))}
                    </div>
                  </div>
                )}

              </div>

            </div>
          </div>
        </div>
      )}

      {/* 11. BARRA DE NAVEGACIÓN MÓVIL INFERIOR */}
      <nav className="mobile-bottom-navbar">
        <button 
          className={`mobile-nav-item ${activeTab === 'envivo' ? 'active' : ''}`}
          onClick={() => { setActiveTab('envivo'); window.scrollTo({ top: 0, behavior: 'smooth' }); }}
        >
          <svg viewBox="0 0 24 24"><path d="M21 3H3c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h5v2h8v-2h5c1.1 0 1.99-.9 1.99-2L23 5c0-1.1-.9-2-2-2zm0 14H3V5h18v12z"/></svg>
          <span>En Vivo</span>
        </button>

        <button 
          className={`mobile-nav-item ${activeTab === 'peliculas' ? 'active' : ''}`}
          onClick={() => setActiveTab('peliculas')}
        >
          <svg viewBox="0 0 24 24"><path d="M18 4l2 4h-3l-2-4h-2l2 4h-3l-2-4H8l2 4H7L5 4H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V4h-4z"/></svg>
          <span>Películas</span>
        </button>

        <button 
          className={`mobile-nav-item ${activeTab === 'series' ? 'active' : ''}`}
          onClick={() => setActiveTab('series')}
        >
          <svg viewBox="0 0 24 24"><path d="M4 6H2v14c0 1.1.9 2 2 2h14v-2H4V6zm16-4H8c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm0 14H8V4h12v12z"/></svg>
          <span>Series</span>
        </button>

        <button 
          className={`mobile-nav-item ${activeTab === 'manga' ? 'active' : ''}`}
          onClick={() => setActiveTab('manga')}
        >
          <svg viewBox="0 0 24 24"><path d="M19 2H6c-1.2 0-2 .8-2 2v16c0 1.2.8 2 2 2h13c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zM6 4h5v8l-2.5-1.5L6 12V4z"/></svg>
          <span>Manga</span>
        </button>

        <button 
          className={`mobile-nav-item ${activeTab === 'favoritos' ? 'active' : ''}`}
          onClick={() => setActiveTab('favoritos')}
        >
          <svg viewBox="0 0 24 24"><path d="M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z"/></svg>
          <span>Favoritos</span>
        </button>
      </nav>

    </div>
  );
}
