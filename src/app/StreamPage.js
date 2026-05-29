"use client";

import { useState, useEffect, useRef } from 'react';

export default function StreamPage({ initialPeliculas }) {
  // Estado para la pantalla de presentación (Splash Screen)
  const [showSplash, setShowSplash] = useState(true);
  const [fadeOutSplash, setFadeOutSplash] = useState(false);

  // Catálogo de películas
  const [peliculas] = useState(initialPeliculas || []);

  // Estados de reproducción y navegación
  const [activeItem, setActiveItem] = useState(null); // Película o Serie seleccionada
  const [activeServer, setActiveServer] = useState(0); // Servidor seleccionado (0 a 3)
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('Todos');

  // Estados para Series
  const [season, setSeason] = useState(1);
  const [episode, setEpisode] = useState(1);

  // Estados para el cargador directo de IDs
  const [customId, setCustomId] = useState('');
  const [customType, setCustomType] = useState('pelicula');
  const [customSeason, setCustomSeason] = useState(1);
  const [customEpisode, setCustomEpisode] = useState(1);

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
      name: 'Servidor 1 (VidSrc.to)',
      url: (tmdbId, imdbId, type, s, e) => 
        type === 'pelicula' 
          ? `https://vidsrc.to/embed/movie/${tmdbId}`
          : `https://vidsrc.to/embed/tv/${tmdbId}/${s}/${e}`
    },
    {
      name: 'Servidor 2 (VidSrc.me)',
      url: (tmdbId, imdbId, type, s, e) => 
        type === 'pelicula' 
          ? `https://vidsrc.me/embed/movie?id=${imdbId || tmdbId}`
          : `https://vidsrc.me/embed/tv?id=${imdbId || tmdbId}&s=${s}&e=${e}`
    },
    {
      name: 'Servidor 3 (Embed.su)',
      url: (tmdbId, imdbId, type, s, e) => 
        type === 'pelicula' 
          ? `https://embed.su/embed/movie/${tmdbId}`
          : `https://embed.su/embed/tv/${tmdbId}/${s}/${e}`
    },
    {
      name: 'Servidor 4 (SmashyStream)',
      url: (tmdbId, imdbId, type, s, e) => 
        type === 'pelicula' 
          ? `https://embed.smashystream.com/playere.php?tmdb=${tmdbId}`
          : `https://embed.smashystream.com/playere.php?tmdb=${tmdbId}&season=${s}&episode=${e}`
    }
  ];

  // Resetear servidor, temporada y episodio cuando cambia el elemento activo
  useEffect(() => {
    setActiveServer(0);
    setSeason(1);
    setEpisode(1);
  }, [activeItem]);

  // Categorías del catálogo
  const categorias = ['Todos', 'Acción', 'Ciencia Ficción', 'Terror', 'Comedia', 'Infantil', 'Series'];

  // Filtrar catálogo por búsqueda y categoría
  const filteredItems = peliculas.filter(item => {
    const matchesSearch = item.titulo.toLowerCase().includes(searchQuery.toLowerCase()) || 
                          item.descripcion.toLowerCase().includes(searchQuery.toLowerCase());
    
    let matchesCategory = false;
    if (selectedCategory === 'Todos') {
      matchesCategory = true;
    } else if (selectedCategory === 'Series') {
      matchesCategory = item.tipo === 'serie';
    } else {
      matchesCategory = item.categoria === selectedCategory && item.tipo !== 'serie';
    }
    
    return matchesSearch && matchesCategory;
  });

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
          <div className="brand-logo" onClick={() => setActiveItem(null)}>
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
              <div className="series-selector-panel">
                <div className="selector-group">
                  <span className="selector-label">Temporada:</span>
                  <div className="counter-controls">
                    <button 
                      onClick={() => setSeason(prev => Math.max(1, prev - 1))}
                      className="counter-btn"
                    >
                      -
                    </button>
                    <span className="counter-display">{season}</span>
                    <button 
                      onClick={() => setSeason(prev => prev + 1)}
                      className="counter-btn"
                    >
                      +
                    </button>
                  </div>
                </div>

                <div className="selector-group">
                  <span className="selector-label">Episodio:</span>
                  <div className="counter-controls">
                    <button 
                      onClick={() => setEpisode(prev => Math.max(1, prev - 1))}
                      className="counter-btn"
                    >
                      -
                    </button>
                    <span className="counter-display">{episode}</span>
                    <button 
                      onClick={() => setEpisode(prev => prev + 1)}
                      className="counter-btn"
                    >
                      +
                    </button>
                  </div>
                </div>

                <div className="selector-info">
                  Reproduciendo: Temporada {season}, Episodio {episode}
                </div>
              </div>
            )}

            {/* Pestañas de servidores de transmisión */}
            <div className="servers-tab-bar">
              <span className="servers-label">Servidores:</span>
              <div className="servers-list">
                {servers.map((server, idx) => (
                  <button
                    key={idx}
                    onClick={() => setActiveServer(idx)}
                    className={`server-tab-btn ${activeServer === idx ? 'active' : ''}`}
                  >
                    {server.name}
                  </button>
                ))}
              </div>
            </div>

            {/* Grid del Reproductor y el Chat */}
            <div className="theater-grid">
              {/* Contenedor del Iframe */}
              <div className="player-wrapper">
                <div className="iframe-aspect-ratio">
                  <iframe
                    src={servers[activeServer].url(
                      activeItem.tmdbId, 
                      activeItem.imdbId, 
                      activeItem.tipo, 
                      season, 
                      episode
                    )}
                    allowFullScreen
                    allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
                    sandbox="allow-scripts allow-same-origin allow-presentation allow-forms"
                    className="player-iframe"
                  />
                </div>
                <div className="player-ad-blocker-note">
                  El reproductor tiene un filtro de seguridad activo que bloquea redireccionamientos y ventanas emergentes automáticamente para garantizar una experiencia limpia.
                </div>
              </div>

              {/* Contenedor del Chat Watch Party */}
              <div className="chat-wrapper">
                <ChatBox channelId={activeItem.id} channelTitle={activeItem.titulo} />
              </div>
            </div>

            {/* Sinopsis y detalles debajo del reproductor */}
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
        ) : (
          /* ========================================================================= */
          /* VISTA 2: CATÁLOGO PRINCIPAL */
          /* ========================================================================= */
          <div className="catalog-view">
            {/* Barra de Filtros de Categorías */}
            <div className="filters-container">
              {categorias.map((cat, idx) => (
                <button
                  key={idx}
                  onClick={() => setSelectedCategory(cat)}
                  className={`filter-btn ${selectedCategory === cat ? 'active' : ''}`}
                >
                  {cat}
                </button>
              ))}
            </div>

            {/* Grid de Tarjetas de Contenido */}
            <div className="cards-grid">
              {filteredItems.map((item) => (
                <div 
                  key={item.id} 
                  className="movie-card"
                  onClick={() => setActiveItem(item)}
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

              {filteredItems.length === 0 && (
                <div className="no-results">
                  No se encontraron películas o series con los criterios de búsqueda.
                </div>
              )}
            </div>

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
          transform: translateY(-6px);
          border-color: rgba(0, 245, 212, 0.3);
          box-shadow: 0 8px 30px rgba(0, 0, 0, 0.6), 0 0 15px rgba(0, 245, 212, 0.15);
        }

        .poster-container {
          position: relative;
          padding-top: 145%; /* Relación de aspecto del póster */
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

        .player-ad-blocker-note {
          font-size: 11px;
          color: #6b7280;
          line-height: 1.4;
          padding: 2px 4px;
        }

        .chat-wrapper {
          min-height: 480px;
          height: 100%;
          background-color: #0a0b10;
          border: 1px solid rgba(255, 255, 255, 0.04);
          border-radius: 12px;
          overflow: hidden;
          box-shadow: 0 10px 40px rgba(0,0,0,0.5);
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
      `}</style>
    </div>
  );
}

// Componente del Chat en Vivo (Watch Party) vía MQTT
function ChatBox({ channelId, channelTitle }) {
  const [messages, setMessages] = useState([]);
  const [inputText, setInputText] = useState('');
  const [nickname, setNickname] = useState('');
  const [isJoined, setIsJoined] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);

  const clientRef = useRef(null);
  const messagesEndRef = useRef(null);
  const emojiPickerRef = useRef(null);

  // Emojis estáticos ligeros para la Watch Party
  const emojis = ['😀', '😂', '😍', '😮', '😢', '👍', '👎', '🔥', '👏', '🎉', '❤️', '✨', '🎬', '🍿', '😮‍💨', '🙌'];

  useEffect(() => {
    const defaultNick = 'Usuario_' + Math.floor(1000 + Math.random() * 9000);
    setNickname(defaultNick);
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
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
    <div className="chat-container">
      <div className="chat-header">
        <span className="chat-title">Watch Party</span>
        <span className={`status-indicator ${isConnected ? 'online' : 'offline'}`}>
          {isConnected ? 'Activo' : 'Cargando'}
        </span>
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
          <div className="chat-messages-box">
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
                    <span className="message-sender">{msg.sender}</span>
                    <span className="message-time">{msg.timestamp}</span>
                  </div>
                  <div className="message-text">{msg.text}</div>
                </div>
              ))
            )}
            <div ref={messagesEndRef} />
          </div>

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
          background-color: #07080c;
        }

        .chat-header {
          padding: 12px 16px;
          background-color: #0c0d14;
          border-bottom: 1px solid rgba(255, 255, 255, 0.04);
          display: flex;
          justify-content: space-between;
          align-items: center;
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
          color: #6b7280;
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

        .chat-message {
          background-color: rgba(255, 255, 255, 0.02);
          border: 1px solid rgba(255, 255, 255, 0.03);
          padding: 8px 12px;
          border-radius: 8px;
          align-self: flex-start;
          max-width: 90%;
        }

        .chat-message.mine {
          background-color: rgba(0, 245, 212, 0.02);
          border-color: rgba(0, 245, 212, 0.15);
          align-self: flex-end;
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
          color: #60a5fa;
        }

        .chat-message.mine .message-sender {
          color: #00f5d4;
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
          background-color: #0c0d14;
          border-top: 1px solid rgba(255, 255, 255, 0.04);
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
          background-color: #050508;
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
