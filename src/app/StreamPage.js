"use client";

import { useState, useEffect, useRef, useMemo } from 'react';

// Helper determinista para badges de idioma
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

// Componente para logo de canales con fallback de iniciales
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
          alignItems: 'center',
          justifyContent: 'center',
          background: 'linear-gradient(135deg, #181a24 0%, #252838 100%)',
          color: '#ffffff',
          fontWeight: '800',
          fontSize: '12px',
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

// Carrusel horizontal de contenido On-Demand super optimizado
function ContentShelf({ title, items, onPlay }) {
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
              onClick={() => onPlay(item)}
            >
              <img 
                src={item.poster || "https://images.unsplash.com/photo-1489599849927-2ee91cede3ba?auto=format&fit=crop&w=400&q=80"} 
                alt={item.titulo || item.nombre} 
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

export default function StreamPage({ groupedData = {}, canalesData = [] }) {
  // Pestañas principales
  const [activeTab, setActiveTab] = useState('envivo'); // 'envivo' | 'peliculas' | 'series' | 'anime' | 'manga' | 'favoritos'
  const [liveCategory, setLiveCategory] = useState('Todos');

  // Elemento reproduciéndose activamente por pestaña
  const [activeLiveChannel, setActiveLiveChannel] = useState(canalesData[0] || null);
  const [activeMovie, setActiveMovie] = useState(groupedData.estrenos?.[0] || groupedData.featured || null);
  const [activeSeries, setActiveSeries] = useState(groupedData.series?.[0] || null);
  const [activeAnime, setActiveAnime] = useState(groupedData.anime?.[0] || null);
  const [activeFavorite, setActiveFavorite] = useState(null);

  // Estados de reproducción
  const [isMuted, setIsMuted] = useState(true);
  const [activeServer, setActiveServer] = useState(0); // 0: VidSrc, 1: Embed.su, 2: VidLink, 3: VidSrc.cc, 4: Smashy
  const [showSettings, setShowSettings] = useState(false);
  const [antiAds, setAntiAds] = useState(true);

  // Episodios para series y anime
  const [activeSeason, setActiveSeason] = useState(1);
  const [activeEpisode, setActiveEpisode] = useState(1);

  // Descargas
  const [downloadInfo, setDownloadInfo] = useState(null);
  const [isDownloading, setIsDownloading] = useState(false);

  // Favoritos
  const [favorites, setFavorites] = useState([]);

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
  const [loadingPages, setLoadingPages] = useState(false);

  const videoRef = useRef(null);
  const hlsRef = useRef(null);

  // Servidores
  const servers = [
    { id: 0, name: 'Servidor 1 (Ultra Rápido)' },
    { id: 1, name: 'Servidor 2 (Embed.su)' },
    { id: 2, name: 'Servidor 3 (VidLink Multi-Audio)' },
    { id: 3, name: 'Servidor 4 (VidSrc.cc)' },
    { id: 4, name: 'Servidor 5 (SmashyStream)' }
  ];

  // Cargar Favoritos de LocalStorage
  useEffect(() => {
    try {
      const stored = localStorage.getItem('filmtv_favorites');
      if (stored) setFavorites(JSON.parse(stored));
    } catch (e) {}
  }, []);

  const toggleFavorite = (item) => {
    if (!item) return;
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

  // Obtener el elemento activo según la pestaña seleccionada
  const currentActiveItem = useMemo(() => {
    switch (activeTab) {
      case 'envivo': return activeLiveChannel;
      case 'peliculas': return activeMovie;
      case 'series': return activeSeries;
      case 'anime': return activeAnime;
      case 'favoritos': return activeFavorite || favorites[0] || null;
      default: return activeLiveChannel;
    }
  }, [activeTab, activeLiveChannel, activeMovie, activeSeries, activeAnime, activeFavorite, favorites]);

  // Manejar reproducción de HLS para TV en Vivo
  useEffect(() => {
    let isCancelled = false;

    if (activeTab === 'envivo' && activeLiveChannel && !isYouTubeUrl(activeLiveChannel.url) && videoRef.current) {
      const video = videoRef.current;
      const streamUrl = activeLiveChannel.url;

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
              video.play().catch(() => {});
            });

            hls.on(Hls.Events.ERROR, (event, data) => {
              if (data.fatal) {
                if (data.type === Hls.ErrorTypes.NETWORK_ERROR) {
                  hls.startLoad();
                } else if (data.type === Hls.ErrorTypes.MEDIA_ERROR) {
                  hls.recoverMediaError();
                } else {
                  hls.destroy();
                }
              }
            });
          } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
            video.src = streamUrl;
            video.play().catch(() => {});
          }
        } catch (err) {
          console.error("Error HLS:", err);
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
  }, [activeTab, activeLiveChannel]);

  // Generar URL del iframe según la pestaña y servidor
  const getEmbedUrl = () => {
    if (!currentActiveItem) return '';
    if (currentActiveItem.tipo === 'canal') {
      if (isYouTubeUrl(currentActiveItem.url)) {
        const ytid = getYouTubeId(currentActiveItem.url);
        return `https://www.youtube-nocookie.com/embed/${ytid}?autoplay=1&mute=${isMuted ? 1 : 0}`;
      }
      return '';
    }

    const tmdbId = currentActiveItem.tmdbId || currentActiveItem.id?.replace('movie-', '')?.replace('serie-', '') || '157336';
    const isTv = activeTab === 'series' || activeTab === 'anime' || currentActiveItem.tipo === 'serie';

    switch (activeServer) {
      case 0:
        return isTv 
          ? `https://vidsrc.to/embed/tv/${tmdbId}/${activeSeason}/${activeEpisode}`
          : `https://vidsrc.to/embed/movie/${tmdbId}`;
      case 1:
        return isTv
          ? `https://embed.su/embed/tv/${tmdbId}/${activeSeason}/${activeEpisode}`
          : `https://embed.su/embed/movie/${tmdbId}`;
      case 2:
        return isTv
          ? `https://vidlink.pro/tv/${tmdbId}/${activeSeason}/${activeEpisode}`
          : `https://vidlink.pro/movie/${tmdbId}`;
      case 3:
        return isTv
          ? `https://vidsrc.cc/v2/embed/tv/${tmdbId}/${activeSeason}/${activeEpisode}`
          : `https://vidsrc.cc/v2/embed/movie/${tmdbId}`;
      case 4:
        return isTv
          ? `https://player.smashystream.xyz/tv/${tmdbId}?s=${activeSeason}&e=${activeEpisode}`
          : `https://player.smashystream.xyz/movie/${tmdbId}`;
      default:
        return `https://vidsrc.to/embed/movie/${tmdbId}`;
    }
  };

  // Descarga limpia
  const handleDownload = async (item) => {
    if (!item || item.tipo === 'canal') return;
    setIsDownloading(true);
    setDownloadInfo(null);
    try {
      const tmdbId = item.tmdbId || item.id?.replace('movie-', '')?.replace('serie-', '') || '';
      const isTv = activeTab === 'series' || activeTab === 'anime' || item.tipo === 'serie';
      const res = await fetch(`/api/download?id=${encodeURIComponent(item.id)}&tmdbId=${encodeURIComponent(tmdbId)}&title=${encodeURIComponent(item.titulo || item.nombre)}&type=${isTv ? 'tv' : 'movie'}&season=${activeSeason}&episode=${activeEpisode}`);
      const data = await res.json();
      if (data.success) {
        setDownloadInfo(data);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setIsDownloading(false);
    }
  };

  // Categorías de Canales
  const liveCategories = useMemo(() => {
    const cats = new Set(['Todos']);
    canalesData.forEach(c => {
      if (c.categoria) cats.add(c.categoria);
    });
    return Array.from(cats);
  }, [canalesData]);

  const filteredCanales = useMemo(() => {
    let list = canalesData;
    if (liveCategory !== 'Todos') {
      list = list.filter(c => c.categoria === liveCategory);
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter(c => (c.nombre || '').toLowerCase().includes(q));
    }
    return list;
  }, [canalesData, liveCategory, searchQuery]);

  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#08080a', paddingBottom: '70px' }}>
      
      {/* 1. HEADER / NAVBAR SUPERIOR */}
      <header className="pluto-header">
        <div className="header-left">
          <div className="pluto-logo" onClick={() => { setActiveTab('envivo'); window.scrollTo({ top: 0, behavior: 'smooth' }); }}>
            <span className="logo-film">FILM</span>
            <span className="logo-badge">TV</span>
          </div>

          <nav className="pluto-nav-tabs">
            <button 
              className={`nav-tab-btn ${activeTab === 'envivo' ? 'active' : ''}`}
              onClick={() => { setActiveTab('envivo'); window.scrollTo({ top: 0, behavior: 'smooth' }); }}
            >
              TV en Vivo
            </button>
            <button 
              className={`nav-tab-btn ${activeTab === 'peliculas' ? 'active' : ''}`}
              onClick={() => { setActiveTab('peliculas'); window.scrollTo({ top: 0, behavior: 'smooth' }); }}
            >
              Películas
            </button>
            <button 
              className={`nav-tab-btn ${activeTab === 'series' ? 'active' : ''}`}
              onClick={() => { setActiveTab('series'); window.scrollTo({ top: 0, behavior: 'smooth' }); }}
            >
              Series
            </button>
            <button 
              className={`nav-tab-btn ${activeTab === 'anime' ? 'active' : ''}`}
              onClick={() => { setActiveTab('anime'); window.scrollTo({ top: 0, behavior: 'smooth' }); }}
            >
              Anime
            </button>
            <button 
              className={`nav-tab-btn ${activeTab === 'manga' ? 'active' : ''}`}
              onClick={() => { setActiveTab('manga'); window.scrollTo({ top: 0, behavior: 'smooth' }); }}
            >
              Manga
            </button>
            <button 
              className={`nav-tab-btn ${activeTab === 'favoritos' ? 'active' : ''}`}
              onClick={() => { setActiveTab('favoritos'); window.scrollTo({ top: 0, behavior: 'smooth' }); }}
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
              placeholder="Buscar en FilmTV..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
        </div>
      </header>

      {/* 2. REPRODUCTOR INTEGRADO PARA CADA SECCIÓN */}
      {activeTab !== 'manga' && currentActiveItem && (
        <section className="hero-player-section">
          <div className="hero-player-container">
            
            {/* Quick Controls: Mute para TV, Engranaje ⚙️ para Películas/Series */}
            <div className="player-quick-controls">
              {activeTab === 'envivo' && !isYouTubeUrl(currentActiveItem?.url) && (
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

              {activeTab !== 'envivo' && (
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
                      <span className="settings-popup-title">Cambiar Servidor</span>
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

            {/* Reproducción: Video HLS para Live TV, Iframe para On Demand */}
            {activeTab === 'envivo' && !isYouTubeUrl(currentActiveItem?.url) ? (
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
                key={`${currentActiveItem?.id}-${activeServer}-${activeSeason}-${activeEpisode}`}
                src={getEmbedUrl()}
                className="player-iframe-embed"
                allow="autoplay; fullscreen; encrypted-media; picture-in-picture"
                allowFullScreen
                sandbox={antiAds ? "allow-forms allow-scripts allow-same-origin allow-presentation" : undefined}
              />
            )}

            {/* Información del contenido activo */}
            <div className="hero-info-overlay">
              {activeTab === 'envivo' && (
                <span className="hero-live-tag">
                  <span className="live-dot"></span> EN VIVO
                </span>
              )}
              <h1 className="hero-title-text">{currentActiveItem?.titulo || currentActiveItem?.nombre || 'FilmTV'}</h1>
              <div className="hero-meta-row">
                {currentActiveItem?.año && <span className="meta-pill">{currentActiveItem.año}</span>}
                <span className="meta-pill">{currentActiveItem?.categoria || 'Streaming'}</span>
                <span className="meta-pill">{getLangBadge(currentActiveItem)}</span>
                {currentActiveItem?.valoracion && <span>★ {currentActiveItem.valoracion}</span>}
              </div>

              {/* Selector de Episodio para Series y Anime */}
              {(activeTab === 'series' || activeTab === 'anime' || currentActiveItem?.tipo === 'serie') && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', pointerEvents: 'auto', margin: '4px 0' }}>
                  <span style={{ fontSize: '12px', fontWeight: '700', color: '#ffe600' }}>Temporada 1:</span>
                  <div style={{ display: 'flex', gap: '6px', overflowX: 'auto', maxWidth: '400px', scrollbarWidth: 'none' }}>
                    {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20].map((ep) => (
                      <button
                        key={ep}
                        className={`category-pill-btn ${activeEpisode === ep ? 'active' : ''}`}
                        style={{ padding: '3px 9px', fontSize: '11px' }}
                        onClick={() => setActiveEpisode(ep)}
                      >
                        Cap {ep}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {currentActiveItem?.sinopsis && (
                <p className="hero-synopsis">{currentActiveItem.sinopsis}</p>
              )}

              <div className="hero-actions-bar">
                {activeTab !== 'envivo' && (
                  <button 
                    className="btn-secondary-action"
                    onClick={() => handleDownload(currentActiveItem)}
                    disabled={isDownloading}
                  >
                    {isDownloading ? 'Generando...' : '⬇️ Descargar'}
                  </button>
                )}
                <button 
                  className="btn-secondary-action"
                  onClick={() => toggleFavorite(currentActiveItem)}
                >
                  {favorites.some(f => f.id === currentActiveItem.id) ? '★ Guardado' : '☆ Guardar'}
                </button>
              </div>

              {/* Caja de descarga rápida debajo de los botones */}
              {downloadInfo && (
                <div className="download-dialog-box" style={{ maxWidth: '500px', pointerEvents: 'auto' }}>
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
        </section>
      )}

      {/* 3. CONTENIDO SEGÚN LA PESTAÑA */}

      {/* VISTA: TV EN VIVO */}
      {activeTab === 'envivo' && (
        <main className="live-guide-container">
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

          <div className="epg-channels-grid">
            {filteredCanales.map((canal) => {
              const isCurrent = activeLiveChannel?.id === canal.id;
              return (
                <div 
                  key={canal.id} 
                  className={`epg-channel-row ${isCurrent ? 'active' : ''}`}
                  onClick={() => {
                    setActiveLiveChannel(canal);
                    setIsMuted(false);
                    window.scrollTo({ top: 0, behavior: 'smooth' });
                  }}
                >
                  <div className="epg-channel-info">
                    <div className="epg-channel-logo-wrap">
                      <ChannelLogo item={canal} className="epg-channel-logo-img" />
                    </div>
                    <div className="epg-channel-name-col">
                      <span className="epg-channel-name">{canal.nombre}</span>
                      <span className="epg-channel-cat">{canal.pais || canal.categoria || 'Canal'}</span>
                    </div>
                  </div>

                  <div className="epg-program-info">
                    <span className="epg-program-title">{canal.nombre}</span>
                    <div className="epg-progress-bar-wrap">
                      <div className="epg-progress-bar-fill" style={{ width: `${(canal.id?.charCodeAt(0) || 50) % 65 + 30}%` }}></div>
                    </div>
                    <span className="epg-program-time">Señal 24/7 HD</span>
                  </div>

                  <div className="epg-equalizer-wrap">
                    {isCurrent ? (
                      <div className="sound-bars-anim" title="Reproduciendo">
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

      {/* VISTA: PELÍCULAS A LA CARTA */}
      {activeTab === 'peliculas' && (
        <main className="on-demand-section">
          <ContentShelf 
            title="Estrenos y Destacados"
            items={groupedData.estrenos}
            onPlay={(item) => { setActiveMovie(item); window.scrollTo({ top: 0, behavior: 'smooth' }); }}
          />
          <ContentShelf 
            title="Acción y Aventura"
            items={groupedData.accion}
            onPlay={(item) => { setActiveMovie(item); window.scrollTo({ top: 0, behavior: 'smooth' }); }}
          />
          <ContentShelf 
            title="Ciencia Ficción"
            items={groupedData.scifi}
            onPlay={(item) => { setActiveMovie(item); window.scrollTo({ top: 0, behavior: 'smooth' }); }}
          />
          <ContentShelf 
            title="Terror y Suspenso"
            items={groupedData.terror}
            onPlay={(item) => { setActiveMovie(item); window.scrollTo({ top: 0, behavior: 'smooth' }); }}
          />
          <ContentShelf 
            title="Comedia"
            items={groupedData.comedia}
            onPlay={(item) => { setActiveMovie(item); window.scrollTo({ top: 0, behavior: 'smooth' }); }}
          />
          <ContentShelf 
            title="Drama"
            items={groupedData.drama}
            onPlay={(item) => { setActiveMovie(item); window.scrollTo({ top: 0, behavior: 'smooth' }); }}
          />
          <ContentShelf 
            title="Infantil y Familiar"
            items={groupedData.infantil}
            onPlay={(item) => { setActiveMovie(item); window.scrollTo({ top: 0, behavior: 'smooth' }); }}
          />
          <ContentShelf 
            title="Clásicos"
            items={groupedData.clasicos}
            onPlay={(item) => { setActiveMovie(item); window.scrollTo({ top: 0, behavior: 'smooth' }); }}
          />
        </main>
      )}

      {/* VISTA: SERIES A LA CARTA */}
      {activeTab === 'series' && (
        <main className="on-demand-section">
          <ContentShelf 
            title="Series Populares y Temporadas Completas"
            items={groupedData.series}
            onPlay={(item) => { setActiveSeries(item); setActiveEpisode(1); window.scrollTo({ top: 0, behavior: 'smooth' }); }}
          />
        </main>
      )}

      {/* VISTA: ANIME */}
      {activeTab === 'anime' && (
        <main className="on-demand-section">
          <ContentShelf 
            title="Catálogo Anime HD"
            items={groupedData.anime}
            onPlay={(item) => { setActiveAnime(item); setActiveEpisode(1); window.scrollTo({ top: 0, behavior: 'smooth' }); }}
          />
        </main>
      )}

      {/* VISTA: MANGA */}
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
                      setLoadingPages(true);
                      try {
                        const res = await fetch(`/api/anime?chapterId=${ch.id}`);
                        const data = await res.json();
                        setChapterPages(data.pages || []);
                      } catch (e) {}
                      finally {
                        setLoadingPages(false);
                      }
                    }}
                  >
                    Cap. {ch.attributes?.chapter || '1'}
                  </button>
                ))}
              </div>
            </div>
          )}

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

      {/* VISTA: FAVORITOS */}
      {activeTab === 'favoritos' && (
        <main className="on-demand-section">
          <h2 className="shelf-title" style={{ marginBottom: '20px' }}>Mis Contenidos Guardados</h2>
          {favorites.length === 0 ? (
            <p style={{ color: 'var(--text-muted)', marginTop: '20px' }}>Aún no tienes contenidos guardados. Pulsa "☆ Guardar" en cualquier canal o película.</p>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: '18px' }}>
              {favorites.map((item) => (
                <div 
                  key={item.id} 
                  className="movie-card-poster"
                  onClick={() => {
                    setActiveFavorite(item);
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

      {/* 4. NAVEGACIÓN INFERIOR PARA SMARTPHONES */}
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
          onClick={() => { setActiveTab('peliculas'); window.scrollTo({ top: 0, behavior: 'smooth' }); }}
        >
          <svg viewBox="0 0 24 24"><path d="M18 4l2 4h-3l-2-4h-2l2 4h-3l-2-4H8l2 4H7L5 4H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V4h-4z"/></svg>
          <span>Películas</span>
        </button>

        <button 
          className={`mobile-nav-item ${activeTab === 'series' ? 'active' : ''}`}
          onClick={() => { setActiveTab('series'); window.scrollTo({ top: 0, behavior: 'smooth' }); }}
        >
          <svg viewBox="0 0 24 24"><path d="M4 6H2v14c0 1.1.9 2 2 2h14v-2H4V6zm16-4H8c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm0 14H8V4h12v12z"/></svg>
          <span>Series</span>
        </button>

        <button 
          className={`mobile-nav-item ${activeTab === 'anime' ? 'active' : ''}`}
          onClick={() => { setActiveTab('anime'); window.scrollTo({ top: 0, behavior: 'smooth' }); }}
        >
          <svg viewBox="0 0 24 24"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 17.93c-3.95-.49-7-3.85-7-7.93 0-.62.08-1.21.21-1.79L9 15v1c0 1.1.9 2 2 2v1.93zm6.9-2.54c-.26-.81-1-1.39-1.9-1.39h-1v-3c0-.55-.45-1-1-1H8v-2h2c.55 0 1-.45 1-1V7h2c1.1 0 2-.9 2-2v-.41c2.93 1.19 5 4.06 5 7.41 0 2.08-.8 3.97-2.1 5.39z"/></svg>
          <span>Anime</span>
        </button>

        <button 
          className={`mobile-nav-item ${activeTab === 'manga' ? 'active' : ''}`}
          onClick={() => { setActiveTab('manga'); window.scrollTo({ top: 0, behavior: 'smooth' }); }}
        >
          <svg viewBox="0 0 24 24"><path d="M19 2H6c-1.2 0-2 .8-2 2v16c0 1.2.8 2 2 2h13c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zM6 4h5v8l-2.5-1.5L6 12V4z"/></svg>
          <span>Manga</span>
        </button>
      </nav>

    </div>
  );
}
