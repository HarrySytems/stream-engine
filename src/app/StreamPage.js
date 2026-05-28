"use client";

import { useState, useEffect, useRef } from 'react';
import Hls from 'hls.js';

export default function StreamPage({ initialCanales, liveAgenda }) {
  // Canales 24/7
  const [canales] = useState(() => {
    return (initialCanales || []).filter(canal => 
      canal.url && (canal.url.startsWith('http://') || canal.url.startsWith('https://'))
    );
  });

  // Agenda en vivo real desde Futbol Libre
  const [agenda] = useState(liveAgenda || []);

  // Estados de navegación
  const [activeMatch, setActiveMatch] = useState(null); // Partido seleccionado de la agenda
  const [activeEmbed, setActiveEmbed] = useState(null); // Opción de transmisión seleccionada del partido
  const [activeCanal, setActiveCanal] = useState(null); // Canal 24/7 seleccionado
  
  const [searchQuery, setSearchQuery] = useState('');
  const [currentDateStr, setCurrentDateStr] = useState('');
  const [playerKey, setPlayerKey] = useState(0); // Para forzar la recarga del reproductor

  // Nuevos estados para el reproductor unificado
  const [streamUrl, setStreamUrl] = useState(null);
  const [playerMode, setPlayerMode] = useState(null); // 'video' | 'iframe'
  const [isLoadingStream, setIsLoadingStream] = useState(false);
  
  const videoRef = useRef(null);
  const hlsRef = useRef(null);

  // Generar fecha actual formateada sin emojis
  useEffect(() => {
    const opciones = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
    const hoy = new Date().toLocaleDateString('es-ES', opciones);
    setCurrentDateStr(hoy.charAt(0).toUpperCase() + hoy.slice(1));
  }, []);

  const [selectedCategory, setSelectedCategory] = useState('Deportes');

  // Categorías de canales para el selector (sin emojis y estructurado profesionalmente)
  const categorias = ['Deportes', 'Infantil', 'Cine', 'TDT / General', 'Noticias', 'Música', 'Adultos (18+)', 'Todos'];

  // Filtrar canales 24/7 por búsqueda y categoría
  const filteredCanales = canales.filter(canal => {
    const matchesSearch = canal.nombre.toLowerCase().includes(searchQuery.toLowerCase());
    const canalCat = canal.categoria || 'Deportes';
    const matchesCategory = selectedCategory === 'Todos' || canalCat === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  // Resolutor dinámico de URLs de transmisión (Directo o Iframe de respaldo)
  useEffect(() => {
    if (activeCanal) {
      setStreamUrl(activeCanal.url);
      setPlayerMode('video');
      setIsLoadingStream(false);
    } else if (activeEmbed) {
      const decodedUrl = obtenerUrlIframeDecodificada(activeEmbed.attributes?.embed_iframe);
      if (!decodedUrl) {
        setPlayerMode('iframe');
        setStreamUrl(null);
        setIsLoadingStream(false);
        return;
      }

      setIsLoadingStream(true);
      setStreamUrl(null);
      setPlayerMode(null);

      // Consulta al endpoint API local para extraer el .m3u8 directo
      fetch(`/api/stream-url?url=${encodeURIComponent(decodedUrl)}`)
        .then(res => {
          if (!res.ok) throw new Error('Error al decodificar stream directo');
          return res.json();
        })
        .then(data => {
          if (data.playbackURL) {
            setStreamUrl(data.playbackURL);
            setPlayerMode('video');
          } else {
            throw new Error('No playbackURL in response');
          }
        })
        .catch(err => {
          console.warn("Fallo el stream directo, activando iframe de respaldo:", err);
          setPlayerMode('iframe');
          setStreamUrl(null);
        })
        .finally(() => {
          setIsLoadingStream(false);
        });
    } else {
      setStreamUrl(null);
      setPlayerMode(null);
      setIsLoadingStream(false);
    }
  }, [activeCanal, activeEmbed, playerKey]);

  // Inicialización del reproductor HLS nativo
  useEffect(() => {
    if (playerMode !== 'video' || !streamUrl || !videoRef.current) return;

    if (hlsRef.current) {
      hlsRef.current.destroy();
    }

    const video = videoRef.current;
    const streamUrlToLoad = streamUrl;

    if (Hls.isSupported()) {
      const hls = new Hls({
        maxBufferLength: 25, // Buffer más holgado de 25s para evitar congelamientos
        maxMaxBufferLength: 50,
        enableWorker: true,
        lowLatencyMode: false, // Desactivar latencia ultra baja para dar estabilidad al buffer
        capLevelToPlayerSize: true, // Optimizar descarga al tamaño del reproductor
        liveSyncDurationCount: 3,
        maxBufferSize: 40 * 1024 * 1024 // 40MB para buffering en RAM
      });
      hlsRef.current = hls;
      hls.loadSource(streamUrlToLoad);
      hls.attachMedia(video);
      hls.on(Hls.Events.MANIFEST_PARSED, () => {
        video.play().catch(err => console.log("Auto-play bloqueado por el navegador: ", err));
      });

      let networkRetryCount = 0;
      let mediaRetryCount = 0;

      hls.on(Hls.Events.ERROR, function (event, data) {
        if (data.fatal) {
          switch (data.type) {
            case Hls.ErrorTypes.NETWORK_ERROR:
              if (networkRetryCount < 4) {
                networkRetryCount++;
                console.warn(`Reintentando conexión de red (${networkRetryCount}/4)...`);
                setTimeout(() => hls.startLoad(), 2000);
              } else {
                console.error("Límite de reintentos alcanzado. Reiniciando manifiesto...");
                networkRetryCount = 0;
                setTimeout(() => {
                  hls.loadSource(streamUrlToLoad);
                  hls.startLoad();
                }, 3000);
              }
              break;
            case Hls.ErrorTypes.MEDIA_ERROR:
              if (mediaRetryCount < 4) {
                mediaRetryCount++;
                console.warn(`Recuperando error de medios (${mediaRetryCount}/4)...`);
                hls.recoverMediaError();
              } else {
                console.error("Fallo crítico de medios. Intercambiando códecs de audio...");
                mediaRetryCount = 0;
                hls.swapAudioCodec();
                hls.recoverMediaError();
              }
              break;
            default:
              hls.destroy();
              break;
          }
        }
      });
    } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
      video.src = streamUrlToLoad;
      video.addEventListener('loadedmetadata', () => {
        video.play().catch(err => console.log("Auto-play bloqueado: ", err));
      });
    }

    return () => {
      if (hlsRef.current) {
        hlsRef.current.destroy();
        hlsRef.current = null;
      }
    };
  }, [streamUrl, playerMode, playerKey]);

  // Decodificar el URL del iframe de Fútbol Libre (Base64)
  const obtenerUrlIframeDecodificada = (embedIframe) => {
    if (!embedIframe) return '';
    try {
      const parts = embedIframe.split('?r=');
      if (parts.length > 1) {
        const b64 = parts[1];
        return atob(b64);
      }
      return embedIframe;
    } catch (e) {
      console.error("Error decodificando iframe:", e);
      return '';
    }
  };

  // Cuando se selecciona un partido, cargar por defecto su primera opción de transmisión
  const seleccionarPartido = (partido) => {
    setActiveCanal(null); // Desactivar canal 24/7 si estaba activo
    setActiveMatch(partido);
    
    const embeds = partido.attributes?.embeds?.data || [];
    if (embeds.length > 0) {
      setActiveEmbed(embeds[0]);
    } else {
      setActiveEmbed(null);
    }
  };

  // Cuando se selecciona un canal 24/7
  const seleccionarCanal247 = (canal) => {
    setActiveMatch(null); // Desactivar partido de la agenda
    setActiveEmbed(null);
    setActiveCanal(canal);
  };

  const limpiarSeleccion = () => {
    setActiveMatch(null);
    setActiveEmbed(null);
    setActiveCanal(null);
  };

  return (
    <div style={{
      minHeight: '100vh',
      backgroundColor: '#070707',
      color: '#fff',
      fontFamily: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
      display: 'flex',
      flexDirection: 'column'
    }}>
      {/* HEADER ESTILO FÚTBOL LIBRE (Premium Oscuro con bordes verdes, sin emojis) */}
      <header style={{
        backgroundColor: '#0a0a0a',
        borderBottom: '2px solid #00ff41',
        padding: '10px 20px',
        position: 'sticky',
        top: 0,
        zIndex: 100,
        display: 'flex',
        flexDirection: 'column',
        gap: '10px'
      }}>
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          width: '100%'
        }}>
          {/* Logo */}
          <div 
            onClick={limpiarSeleccion} 
            style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}
          >
            <span style={{
              fontSize: '22px',
              fontWeight: 'bold',
              color: '#00ff41',
              letterSpacing: '1px',
              textTransform: 'uppercase'
            }}>
              TV FREE <span style={{ color: '#fff', fontSize: '14px', fontWeight: 'normal' }}>En Vivo</span>
            </span>
          </div>

          {/* Buscador */}
          <input
            type="text"
            placeholder="Buscar canal..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{
              padding: '8px 15px',
              borderRadius: '6px',
              border: '1px solid #222',
              backgroundColor: '#111',
              color: '#fff',
              outline: 'none',
              fontSize: '13px',
              width: '200px'
            }}
          />
        </div>

        {/* Barra superior de accesos directos a canales principales */}
        <div style={{
          display: 'flex',
          gap: '10px',
          overflowX: 'auto',
          paddingBottom: '5px',
          whiteSpace: 'nowrap'
        }} className="scroll-horizontal">
          {['ESPN', 'Fox Sports', 'DirecTV', 'LaLiga', 'Win Sports', 'Tigo Sports', 'Latina'].map((nombreCanal, idx) => (
            <button
              key={idx}
              onClick={() => {
                const encontrado = canales.find(c => c.nombre.toLowerCase().includes(nombreCanal.toLowerCase()));
                if (encontrado) seleccionarCanal247(encontrado);
              }}
              style={{
                backgroundColor: '#111',
                border: '1px solid #222',
                color: '#fff',
                padding: '6px 12px',
                borderRadius: '4px',
                fontSize: '12px',
                fontWeight: 'bold',
                cursor: 'pointer',
                transition: 'all 0.2s'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.borderColor = '#00ff41';
                e.currentTarget.style.color = '#00ff41';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.borderColor = '#222';
                e.currentTarget.style.color = '#fff';
              }}
            >
              {nombreCanal}
            </button>
          ))}
        </div>
      </header>

      {/* CONTENIDO PRINCIPAL */}
      <main style={{ padding: '20px', flex: 1, maxWidth: '1200px', width: '100%', margin: '0 auto' }}>
        
        {/* VISTA 1: REPRODUCTOR ACTIVO */}
        {(activeMatch || activeCanal) ? (
          <div>
            {/* Botones de acción */}
            <div style={{ 
              display: 'flex', 
              justifyContent: 'space-between', 
              alignItems: 'center', 
              marginBottom: '15px', 
              flexWrap: 'wrap', 
              gap: '10px' 
            }}>
              <button
                onClick={limpiarSeleccion}
                style={{
                  backgroundColor: '#0a0a0a',
                  color: '#00ff41',
                  border: '1px solid #00ff41',
                  padding: '8px 16px',
                  borderRadius: '6px',
                  fontWeight: 'bold',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px'
                }}
              >
                Volver a la agenda
              </button>

              <button
                onClick={() => setPlayerKey(prev => prev + 1)}
                style={{
                  backgroundColor: '#ff3b30',
                  color: '#fff',
                  border: 'none',
                  padding: '8px 16px',
                  borderRadius: '6px',
                  fontWeight: 'bold',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  boxShadow: '0 2px 8px rgba(255, 59, 48, 0.4)',
                  transition: 'opacity 0.2s'
                }}
                onMouseEnter={(e) => e.currentTarget.style.opacity = '0.9'}
                onMouseLeave={(e) => e.currentTarget.style.opacity = '1'}
              >
                Recargar transmisión
              </button>
            </div>

            {/* Selector de opciones de transmisión (sólo para partidos de la agenda) */}
            {activeMatch && (
              <div style={{
                display: 'flex',
                gap: '10px',
                marginBottom: '15px',
                flexWrap: 'wrap',
                backgroundColor: '#0c0c0c',
                padding: '10px 15px',
                borderRadius: '8px',
                border: '1px solid #1a1a1a'
              }}>
                <span style={{ color: '#888', fontSize: '13px', fontWeight: 'bold', alignSelf: 'center', marginRight: '5px' }}>
                  OPCIONES:
                </span>
                {(activeMatch.attributes?.embeds?.data || []).map((embed, idx) => {
                  const isSelected = activeEmbed?.id === embed.id;
                  return (
                    <button
                      key={embed.id}
                      onClick={() => setActiveEmbed(embed)}
                      style={{
                        backgroundColor: isSelected ? '#00ff41' : '#151515',
                        color: isSelected ? '#000' : '#fff',
                        border: 'none',
                        padding: '6px 12px',
                        borderRadius: '4px',
                        fontSize: '12px',
                        fontWeight: 'bold',
                        cursor: 'pointer'
                      }}
                    >
                      Opción {idx + 1}: {embed.attributes?.embed_name || `Señal ${idx + 1}`}
                    </button>
                  );
                })}
                {(activeMatch.attributes?.embeds?.data || []).length === 0 && (
                  <span style={{ color: '#666', fontSize: '13px' }}>No hay señales alternativas disponibles.</span>
                )}
                {(activeMatch.attributes?.embeds?.data || []).length > 1 && (
                  <button
                    onClick={() => {
                      const embeds = activeMatch.attributes?.embeds?.data || [];
                      const currentIndex = embeds.findIndex(e => e.id === activeEmbed?.id);
                      const nextIndex = (currentIndex + 1) % embeds.length;
                      setActiveEmbed(embeds[nextIndex]);
                    }}
                    style={{
                      backgroundColor: '#2196f3',
                      color: '#fff',
                      border: 'none',
                      padding: '6px 12px',
                      borderRadius: '4px',
                      fontSize: '12px',
                      fontWeight: 'bold',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px',
                      marginLeft: 'auto'
                    }}
                  >
                    Siguiente señal
                  </button>
                )}
              </div>
            )}

            {/* Grid del Video y Chat */}
            <div style={{
              display: 'grid',
              gridTemplateColumns: '1fr',
              gap: '20px',
              '@media (min-width: 1024px)': {
                gridTemplateColumns: '3fr 1.2fr'
              }
            }} className="media-grid">
              
              {/* Columna del Reproductor */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <div style={{
                  position: 'relative',
                  paddingTop: '56.25%', // 16:9 Aspect Ratio
                  backgroundColor: '#000',
                  borderRadius: '8px',
                  overflow: 'hidden',
                  border: '1px solid #1c1c1c',
                  boxShadow: '0 4px 20px rgba(0,0,0,0.9)'
                }}>
                  {isLoadingStream ? (
                    <div style={{
                      position: 'absolute',
                      top: 0,
                      left: 0,
                      width: '100%',
                      height: '100%',
                      display: 'flex',
                      flexDirection: 'column',
                      justifyContent: 'center',
                      alignItems: 'center',
                      backgroundColor: '#000',
                      color: '#00ff41',
                      gap: '15px'
                    }}>
                      <div className="stream-loader" style={{
                        border: '4px solid #111',
                        borderTop: '4px solid #00ff41',
                        borderRadius: '50%',
                        width: '40px',
                        height: '40px',
                        animation: 'spin 1s linear infinite'
                      }} />
                      <span style={{ fontSize: '13px', color: '#888' }}>
                        Analizando señal y bloqueando publicidad...
                      </span>
                    </div>
                  ) : playerMode === 'video' ? (
                    // Reproductor HLS propio (reproducción limpia y estable)
                    <video
                      key={playerKey}
                      ref={videoRef}
                      controls
                      playsInline
                      style={{
                        position: 'absolute',
                        top: 0,
                        left: 0,
                        width: '100%',
                        height: '100%',
                        objectFit: 'contain'
                      }}
                    />
                  ) : playerMode === 'iframe' ? (
                    // Iframe original como respaldo automático
                    <iframe
                      key={playerKey}
                      src={obtenerUrlIframeDecodificada(activeEmbed.attributes?.embed_iframe)}
                      allowFullScreen
                      allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
                      sandbox="allow-scripts allow-same-origin allow-presentation allow-forms"
                      style={{
                        position: 'absolute',
                        top: 0,
                        left: 0,
                        width: '100%',
                        height: '100%',
                        border: 'none'
                      }}
                    />
                  ) : (
                    <div style={{
                      position: 'absolute',
                      top: 0,
                      left: 0,
                      width: '100%',
                      height: '100%',
                      display: 'flex',
                      justifyContent: 'center',
                      alignItems: 'center',
                      color: '#444'
                    }}>
                      Cargando señal...
                    </div>
                  )}
                </div>

                {/* Información de lo que se está reproduciendo */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', padding: '5px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <h2 style={{ color: '#00ff41', fontSize: '18px', margin: 0, fontWeight: 'bold' }}>
                      {activeMatch ? activeMatch.attributes?.diary_description.replace('\n', ' ') : activeCanal?.nombre}
                    </h2>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <span style={{
                        width: '8px',
                        height: '8px',
                        borderRadius: '50%',
                        backgroundColor: '#ff3b30',
                        display: 'inline-block',
                        animation: 'pulse 1.5s infinite'
                      }} />
                      <span style={{ fontSize: '11px', color: '#ff3b30', fontWeight: 'bold', letterSpacing: '1px' }}>
                        SEÑAL EN VIVO
                      </span>
                    </div>
                  </div>

                  {/* Advertencia para HTTP en canales 24/7 */}
                  {activeCanal?.url.startsWith('http://') && (
                    <div style={{
                      backgroundColor: 'rgba(255, 152, 0, 0.05)',
                      border: '1px solid #ff9800',
                      borderRadius: '6px',
                      padding: '10px',
                      color: '#ffa726',
                      fontSize: '12px',
                      marginTop: '10px'
                    }}>
                      Aviso: Este canal requiere permitir contenido inseguro en tu navegador para reproducirse (HTTP). Si no inicia, habilita "Contenido no seguro" en la configuración de candado del navegador.
                    </div>
                  )}
                </div>
              </div>

              {/* Columna del Chat */}
              <div style={{
                height: '480px',
                backgroundColor: '#0a0a0a',
                borderRadius: '8px',
                border: '1px solid #1c1c1c',
                display: 'flex',
                flexDirection: 'column',
                overflow: 'hidden',
                boxShadow: '0 4px 20px rgba(0,0,0,0.9)'
              }} className="chat-block">
                <ChatBox channelName={activeMatch ? activeMatch.attributes?.diary_description : activeCanal?.nombre} />
              </div>

            </div>
          </div>
        ) : (
          
          /* VISTA 2: AGENDA EN VIVO DE PARTIDOS REALES (ESTILO FÚTBOL LIBRE, SIN EMOJIS) */
          <div style={{ display: 'flex', flexDirection: 'column', gap: '25px' }}>
            
            {/* Mensaje Informativo */}
            <div style={{
              backgroundColor: '#0a0a0a',
              border: '1px solid #1a1a1a',
              borderRadius: '8px',
              padding: '15px',
              fontSize: '13px',
              lineHeight: '1.6',
              color: '#888',
              textAlign: 'center'
            }}>
              <span style={{ color: '#00ff41', fontWeight: 'bold' }}>TV FREE En Vivo</span> - Agenda de eventos deportivos organizada en tiempo real. Selecciona cualquier partido para reproducir.
            </div>

            {/* Agenda del día */}
            <div style={{
              backgroundColor: '#0a0a0a',
              border: '1px solid #1c1c1c',
              borderRadius: '8px',
              overflow: 'hidden'
            }}>
              {/* Encabezado Verde de la Agenda */}
              <div style={{
                backgroundColor: '#084d1e',
                padding: '12px 15px',
                fontSize: '14px',
                fontWeight: 'bold',
                color: '#fff',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center'
              }}>
                <span>Agenda de Partidos</span>
                <span style={{ fontSize: '12px', opacity: 0.9, fontWeight: 'normal' }}>{currentDateStr}</span>
              </div>

              {/* Lista de partidos en tiempo real */}
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                {agenda.map((partido) => {
                  const horaLimpia = partido.attributes?.diary_hour 
                    ? partido.attributes.diary_hour.substring(0, 5) 
                    : 'En Vivo';
                    
                  const descripcion = partido.attributes?.diary_description
                    ? partido.attributes.diary_description.replace('\n', ' - ')
                    : 'Evento Deportivo';

                  return (
                    <div
                      key={partido.id}
                      onClick={() => seleccionarPartido(partido)}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        padding: '12px 15px',
                        borderBottom: '1px solid #111',
                        cursor: 'pointer',
                        transition: 'background 0.2s',
                        gap: '15px'
                      }}
                      className="agenda-row"
                      onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#111'}
                      onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                    >
                      {/* Hora */}
                      <span style={{
                        fontWeight: 'bold',
                        color: '#00ff41',
                        fontSize: '13px',
                        minWidth: '55px'
                      }}>
                        {horaLimpia}
                      </span>

                      {/* Evento */}
                      <span style={{
                        fontSize: '13px',
                        flex: 1,
                        fontWeight: '500',
                        color: '#ddd'
                      }}>
                        {descripcion}
                      </span>

                      {/* Botón Ver */}
                      <span style={{
                        fontSize: '11px',
                        backgroundColor: 'rgba(0, 255, 65, 0.05)',
                        border: '1px solid #00ff41',
                        color: '#00ff41',
                        padding: '4px 10px',
                        borderRadius: '4px',
                        fontWeight: 'bold'
                      }}>
                        Ver transmisión
                      </span>
                    </div>
                  );
                })}
                
                {agenda.length === 0 && (
                  <div style={{ padding: '30px', textAlign: 'center', color: '#444', fontSize: '13px' }}>
                    No hay partidos programados para hoy en este momento.
                  </div>
                )}
              </div>
            </div>

            {/* Listado de Canales 24/7 */}
            <div>
              <h3 style={{
                fontSize: '16px',
                fontWeight: 'bold',
                marginBottom: '15px',
                borderBottom: '1px solid #1c1c1c',
                paddingBottom: '8px',
                color: '#555'
              }}>
                Canales 24/7 ({filteredCanales.length})
              </h3>

              {/* Categorías de Canales */}
              <div style={{
                display: 'flex',
                gap: '8px',
                overflowX: 'auto',
                paddingBottom: '10px',
                marginBottom: '20px',
                whiteSpace: 'nowrap'
              }} className="scroll-horizontal">
                {categorias.map((cat, idx) => {
                  const isSelected = selectedCategory === cat;
                  return (
                    <button
                      key={idx}
                      onClick={() => setSelectedCategory(cat)}
                      style={{
                        backgroundColor: isSelected ? '#00ff41' : '#0a0a0a',
                        color: isSelected ? '#000' : '#888',
                        border: '1px solid ' + (isSelected ? '#00ff41' : '#1c1c1c'),
                        padding: '6px 14px',
                        borderRadius: '20px',
                        fontSize: '12px',
                        fontWeight: 'bold',
                        cursor: 'pointer',
                        transition: 'all 0.2s'
                      }}
                    >
                      {cat}
                    </button>
                  );
                })}
              </div>
              
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(170px, 1fr))',
                gap: '12px'
              }}>
                {filteredCanales.map((canal, idx) => (
                  <button
                    key={idx}
                    onClick={() => seleccionarCanal247(canal)}
                    style={{
                      padding: '12px 10px',
                      backgroundColor: '#0a0a0a',
                      border: '1px solid #1c1c1c',
                      borderRadius: '6px',
                      color: '#aaa',
                      fontWeight: 'bold',
                      fontSize: '12px',
                      cursor: 'pointer',
                      transition: 'all 0.2s',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '8px',
                      position: 'relative'
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.borderColor = '#00ff41';
                      e.currentTarget.style.color = '#00ff41';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.borderColor = '#1c1c1c';
                      e.currentTarget.style.color = '#aaa';
                    }}
                  >
                    {/* Badge HTTP/HTTPS */}
                    <span style={{
                      position: 'absolute',
                      top: '2px',
                      right: '2px',
                      fontSize: '7px',
                      padding: '1px 3px',
                      borderRadius: '2px',
                      backgroundColor: canal.url.startsWith('https://') ? '#0c2614' : '#332113',
                      color: canal.url.startsWith('https://') ? '#81c784' : '#ffb74d'
                    }}>
                      {canal.url.startsWith('https://') ? 'Seguro' : 'HTTP'}
                    </span>

                    {canal.nombre.replace('(720p)', '').replace('(1080p)', '').replace('(1080i)', '').replace('[Not 24/7]', '').trim()}
                  </button>
                ))}
              </div>
            </div>

          </div>
        )}
      </main>

      {/* ESTILOS CSS GLOBALES */}
      <style jsx global>{`
        .scroll-horizontal::-webkit-scrollbar {
          height: 4px;
        }
        .scroll-horizontal::-webkit-scrollbar-thumb {
          background-color: #222;
          border-radius: 4px;
        }
        
        @keyframes pulse {
          0% { opacity: 0.4; }
          50% { opacity: 1; }
          100% { opacity: 0.4; }
        }

        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }

        @media (min-width: 1024px) {
          .media-grid {
            grid-template-columns: 3.2fr 1.2fr !important;
          }
          .chat-block {
            height: 100% !important;
            min-height: 480px;
          }
        }
      `}</style>
    </div>
  );
}

// Componente de Chat en Vivo usando Paho MQTT de forma limpia e impersonal (sin emojis)
function ChatBox({ channelName }) {
  const [messages, setMessages] = useState([]);
  const [inputText, setInputText] = useState('');
  const [nickname, setNickname] = useState('');
  const [isJoined, setIsJoined] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const clientRef = useRef(null);
  const messagesEndRef = useRef(null);

  useEffect(() => {
    const defaultNick = 'Usuario_' + Math.floor(1000 + Math.random() * 9000);
    setNickname(defaultNick);
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

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
        const clientId = 'tvfree_client_' + Math.random().toString(16).substring(2, 10);
        const client = new window.Paho.MQTT.Client('broker.hivemq.com', Number(8884), '/mqtt', clientId);
        clientRef.current = client;

        client.onConnectionLost = (responseObject) => {
          setIsConnected(false);
          if (responseObject.errorCode !== 0) {
            console.log("Conexión perdida con el chat: " + responseObject.errorMessage);
          }
        };

        client.onMessageArrived = (message) => {
          try {
            const data = JSON.parse(message.payloadString);
            if (active) {
              setMessages(prev => [...prev, data]);
            }
          } catch (e) {
            console.error("Error procesando mensaje:", e);
          }
        };

        client.connect({
          onSuccess: () => {
            setIsConnected(true);
            const cleanChannel = (channelName || 'general').toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]/g, '_');
            const topic = `tvfree/chat/${cleanChannel}`;
            client.subscribe(topic);
          },
          useSSL: true,
          onFailure: (err) => {
            console.error("Fallo al conectar chat:", err);
          }
        });
      } catch (err) {
        console.error("Error MQTT:", err);
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
  }, [channelName]);

  const handleSendMessage = (e) => {
    e.preventDefault();
    if (!inputText.trim() || !clientRef.current || !isConnected) return;

    const messageData = {
      sender: nickname || 'Usuario',
      text: inputText.trim(),
      timestamp: new Date().toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })
    };

    try {
      const cleanChannel = (channelName || 'general').toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]/g, '_');
      const topic = `tvfree/chat/${cleanChannel}`;
      const message = new window.Paho.MQTT.Message(JSON.stringify(messageData));
      message.destinationName = topic;
      clientRef.current.send(message);
      setInputText('');
    } catch (err) {
      console.error("Error al enviar mensaje:", err);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', backgroundColor: '#070707', color: '#fff' }}>
      <div style={{ padding: '10px 15px', backgroundColor: '#0c0c0c', borderBottom: '1px solid #1c1c1c', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ fontSize: '13px', fontWeight: 'bold', color: '#00ff41' }}>Chat en vivo</span>
        <span style={{ fontSize: '10px', color: isConnected ? '#00ff41' : '#ff3b30' }}>
          {isConnected ? 'Conectado' : 'Desconectado'}
        </span>
      </div>

      {!isJoined ? (
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', padding: '20px', gap: '12px', backgroundColor: '#070707' }}>
          <span style={{ color: '#555', fontSize: '12px', textAlign: 'center', maxWidth: '80%' }}>
            Ingresa tu alias para comenzar a chatear. Los mensajes son temporales.
          </span>
          <input
            type="text"
            placeholder="Nombre de usuario..."
            value={nickname}
            onChange={(e) => setNickname(e.target.value.substring(0, 15))}
            style={{ padding: '8px 12px', borderRadius: '6px', border: '1px solid #1c1c1c', backgroundColor: '#0c0c0c', color: '#fff', outline: 'none', textAlign: 'center', width: '80%', fontSize: '13px' }}
          />
          <button
            onClick={() => nickname.trim() && setIsJoined(true)}
            style={{ backgroundColor: '#00ff41', color: '#000', border: 'none', padding: '8px 16px', borderRadius: '6px', fontWeight: 'bold', cursor: 'pointer', width: '80%', fontSize: '13px' }}
          >
            Entrar al chat
          </button>
        </div>
      ) : (
        <>
          <div style={{ flex: 1, overflowY: 'auto', padding: '12px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {messages.length === 0 ? (
              <div style={{ color: '#333', textAlign: 'center', marginTop: '20px', fontSize: '12px' }}>
                No hay comentarios en este canal.
              </div>
            ) : (
              messages.map((msg, index) => (
                <div key={index} style={{ backgroundColor: msg.sender === nickname ? 'rgba(0,255,65,0.03)' : '#0c0c0c', padding: '6px 10px', borderRadius: '6px', border: '1px solid ' + (msg.sender === nickname ? '#0f3b18' : '#141414') }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', marginBottom: '2px' }}>
                    <span style={{ fontWeight: 'bold', color: msg.sender === nickname ? '#00ff41' : '#2196f3' }}>{msg.sender}</span>
                    <span style={{ color: '#444' }}>{msg.timestamp}</span>
                  </div>
                  <div style={{ color: '#ccc', fontSize: '12px', wordBreak: 'break-all' }}>{msg.text}</div>
                </div>
              ))
            )}
            <div ref={messagesEndRef} />
          </div>

          <form onSubmit={handleSendMessage} style={{ padding: '8px', borderTop: '1px solid #1c1c1c', display: 'flex', gap: '6px', backgroundColor: '#0a0a0a' }}>
            <input
              type="text"
              placeholder="Escribe un mensaje..."
              value={inputText}
              onChange={(e) => setInputText(e.target.value.substring(0, 100))}
              style={{ flex: 1, padding: '6px 10px', borderRadius: '6px', border: '1px solid #1c1c1c', backgroundColor: '#070707', color: '#fff', outline: 'none', fontSize: '13px' }}
            />
            <button
              type="submit"
              disabled={!isConnected}
              style={{ backgroundColor: isConnected ? '#00ff41' : '#222', color: '#000', border: 'none', padding: '6px 12px', borderRadius: '6px', fontWeight: 'bold', cursor: isConnected ? 'pointer' : 'default', fontSize: '13px' }}
            >
              Enviar
            </button>
          </form>
        </>
      )}
    </div>
  );
}
