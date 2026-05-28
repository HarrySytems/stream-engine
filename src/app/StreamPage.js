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
  
  const videoRef = useRef(null);
  const hlsRef = useRef(null);

  // Generar fecha actual formateada
  useEffect(() => {
    const opciones = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
    const hoy = new Date().toLocaleDateString('es-ES', opciones);
    setCurrentDateStr(hoy.charAt(0).toUpperCase() + hoy.slice(1));
  }, []);

  // Filtrar canales 24/7
  const filteredCanales = canales.filter(canal =>
    canal.nombre.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Efecto para inicializar el reproductor HLS personalizado (para canales 24/7)
  useEffect(() => {
    if (!activeCanal || activeMatch || !videoRef.current) return;

    if (hlsRef.current) {
      hlsRef.current.destroy();
    }

    const video = videoRef.current;
    const streamUrl = activeCanal.url;

    if (Hls.isSupported()) {
      const hls = new Hls({
        maxBufferLength: 20, // Buffer de 20 segundos
        maxMaxBufferLength: 45, // Buffer máximo de 45 segundos
        enableWorker: true,
        lowLatencyMode: false, // Desactivar modo de baja latencia para permitir mayor almacenamiento en caché
        capLevelToPlayerSize: true, // Auto-escalar calidad según tamaño del reproductor para no sobrecargar
        liveSyncDurationCount: 3, // Sincronización más estable para directos
        maxBufferSize: 30 * 1024 * 1024 // Limitar memoria a 30MB para evitar que se congele el navegador
      });
      hlsRef.current = hls;
      hls.loadSource(streamUrl);
      hls.attachMedia(video);
      hls.on(Hls.Events.MANIFEST_PARSED, () => {
        video.play().catch(err => console.log("Auto-play blocked: ", err));
      });

      let networkRetryCount = 0;
      let mediaRetryCount = 0;

      hls.on(Hls.Events.ERROR, function (event, data) {
        if (data.fatal) {
          switch (data.type) {
            case Hls.ErrorTypes.NETWORK_ERROR:
              if (networkRetryCount < 3) {
                networkRetryCount++;
                console.warn(`Error de red, reintentando (${networkRetryCount}/3)...`);
                setTimeout(() => hls.startLoad(), 2000);
              } else {
                console.error("Máximo de reintentos de red alcanzado. Intentando recargar manifest...");
                networkRetryCount = 0;
                setTimeout(() => {
                  hls.loadSource(streamUrl);
                  hls.startLoad();
                }, 4000);
              }
              break;
            case Hls.ErrorTypes.MEDIA_ERROR:
              if (mediaRetryCount < 3) {
                mediaRetryCount++;
                console.warn(`Error de medios, intentando recuperar (${mediaRetryCount}/3)...`);
                hls.recoverMediaError();
              } else {
                console.error("Fallo al recuperar medios. Intercambiando códec de audio...");
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
      video.src = streamUrl;
      video.addEventListener('loadedmetadata', () => {
        video.play().catch(err => console.log("Auto-play blocked: ", err));
      });
    }

    return () => {
      if (hlsRef.current) {
        hlsRef.current.destroy();
        hlsRef.current = null;
      }
    };
  }, [activeCanal, activeMatch, playerKey]);

  // Decodificar el URL del iframe de Fútbol Libre (Base64)
  const obtenerUrlIframeDecodificada = (embedIframe) => {
    if (!embedIframe) return '';
    try {
      const parts = embedIframe.split('?r=');
      if (parts.length > 1) {
        const b64 = parts[1];
        // Decodificar Base64 en el navegador usando atob
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
      backgroundColor: '#0a0a0a',
      color: '#fff',
      fontFamily: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
      display: 'flex',
      flexDirection: 'column'
    }}>
      {/* HEADER ESTILO FÚTBOL LIBRE (Premium Oscuro con bordes verdes) */}
      <header style={{
        backgroundColor: '#0d0d0d',
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
            <span style={{ fontSize: '24px' }}>⚽</span>
            <span style={{
              fontSize: '22px',
              fontWeight: 'bold',
              color: '#00ff41',
              letterSpacing: '1px',
              textTransform: 'uppercase'
            }}>
              Fútbol Libre <span style={{ color: '#fff', fontSize: '14px' }}>En Vivo</span>
            </span>
          </div>

          {/* Buscador */}
          <input
            type="text"
            placeholder="Buscar canal de TV..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{
              padding: '8px 15px',
              borderRadius: '6px',
              border: '1px solid #333',
              backgroundColor: '#151515',
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
                backgroundColor: '#1b1b1b',
                border: '1px solid #333',
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
                e.currentTarget.style.borderColor = '#333';
                e.currentTarget.style.color = '#fff';
              }}
            >
              📺 {nombreCanal}
            </button>
          ))}
        </div>
      </header>

      {/* CONTENIDO PRINCIPAL */}
      <main style={{ padding: '20px', flex: 1, maxWidth: '1200px', width: '100%', margin: '0 auto' }}>
        
        {/* VISTA 1: REPRODUCTOR ACTIVO (Ya sea Partido de Agenda o Canal 24/7) */}
        {(activeMatch || activeCanal) ? (
          <div>
            {/* Botón para regresar a la agenda y recargar */}
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
                  backgroundColor: '#111',
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
                ⬅ Volver a la Agenda de Partidos
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
                🔄 ¿Se trabó la señal? Recargar Canal
              </button>
            </div>

            {/* Selector de opciones de transmisión (sólo para partidos de la agenda) */}
            {activeMatch && (
              <div style={{
                display: 'flex',
                gap: '10px',
                marginBottom: '15px',
                flexWrap: 'wrap',
                backgroundColor: '#121212',
                padding: '10px 15px',
                borderRadius: '8px',
                border: '1px solid #222'
              }}>
                <span style={{ color: '#aaa', fontSize: '13px', fontWeight: 'bold', alignSelf: 'center', marginRight: '5px' }}>
                  OPCIONES:
                </span>
                {(activeMatch.attributes?.embeds?.data || []).map((embed, idx) => {
                  const isSelected = activeEmbed?.id === embed.id;
                  return (
                    <button
                      key={embed.id}
                      onClick={() => setActiveEmbed(embed)}
                      style={{
                        backgroundColor: isSelected ? '#00ff41' : '#1b1b1b',
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
                  <span style={{ color: '#888', fontSize: '13px' }}>No hay señales alternativas disponibles.</span>
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
                  border: '1px solid #222',
                  boxShadow: '0 4px 20px rgba(0,0,0,0.8)'
                }}>
                  {activeMatch && activeEmbed ? (
                    // Cargar el reproductor real en vivo de Fútbol Libre por iframe
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
                  ) : activeCanal ? (
                    // Reproductor HLS propio (para canales 24/7)
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
                      color: '#888'
                    }}>
                      Cargando señal de video...
                    </div>
                  )}
                </div>

                {/* Información de lo que se está reproduciendo */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', padding: '5px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <h2 style={{ color: '#00ff41', fontSize: '20px', margin: 0, fontWeight: 'bold' }}>
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
                      backgroundColor: 'rgba(255, 152, 0, 0.1)',
                      border: '1px solid #ff9800',
                      borderRadius: '6px',
                      padding: '10px',
                      color: '#ffb74d',
                      fontSize: '12px',
                      marginTop: '10px'
                    }}>
                      ⚠️ <strong>Alerta:</strong> Este canal es inseguro (<code>http</code>). Si no carga, dale clic al icono de escudo/candado al lado de la barra de direcciones de tu navegador y activa "Permitir contenido no seguro" para esta web.
                    </div>
                  )}
                </div>
              </div>

              {/* Columna del Chat (Chatango corregido sin 404) */}
              <div style={{
                height: '480px',
                backgroundColor: '#0c0c0c',
                borderRadius: '8px',
                border: '1px solid #222',
                display: 'flex',
                flexDirection: 'column',
                overflow: 'hidden',
                boxShadow: '0 4px 20px rgba(0,0,0,0.8)'
              }} className="chat-block">
                <div style={{
                  padding: '10px 15px',
                  backgroundColor: '#121212',
                  borderBottom: '1px solid #222',
                  fontSize: '13px',
                  fontWeight: 'bold',
                  color: '#00ff41'
                }}>
                  💬 CHAT EN VIVO
                </div>
                <div style={{ flex: 1, position: 'relative' }}>
                  {/* Se apunta directamente al subdominio del grupo en chatango con ?js para forzar la interfaz HTML5 sin pedir registro obligatorio */}
                  <iframe 
                    src="https://streamengine-global.chatango.com/?js"
                    width="100%" 
                    height="100%" 
                    frameBorder="0" 
                    scrolling="yes"
                    style={{ border: 'none', position: 'absolute', top: 0, left: 0 }}
                  />
                </div>
              </div>

            </div>
          </div>
        ) : (
          
          /* VISTA 2: AGENDA EN VIVO DE PARTIDOS REALES (ESTILO FÚTBOL LIBRE) */
          <div style={{ display: 'flex', flexDirection: 'column', gap: '25px' }}>
            
            {/* Mensaje Informativo */}
            <div style={{
              backgroundColor: '#0f0f0f',
              border: '1px solid #1a1a1a',
              borderRadius: '8px',
              padding: '15px',
              fontSize: '14px',
              lineHeight: '1.6',
              color: '#bbb',
              textAlign: 'center'
            }}>
              <strong style={{ color: '#00ff41' }}>Fútbol Libre En Vivo</strong> organiza la agenda de los partidos de hoy en tiempo real. Selecciona cualquier evento de la lista para cargarlo con sus múltiples opciones de transmisión y chat.
            </div>

            {/* Agenda del día */}
            <div style={{
              backgroundColor: '#0c0c0c',
              border: '1px solid #222',
              borderRadius: '8px',
              overflow: 'hidden'
            }}>
              {/* Encabezado Verde de la Agenda */}
              <div style={{
                backgroundColor: '#006622',
                padding: '12px 15px',
                fontSize: '15px',
                fontWeight: 'bold',
                color: '#fff',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center'
              }}>
                <span>📅 Agenda de Partidos en Tiempo Real</span>
                <span style={{ fontSize: '13px', opacity: 0.9 }}>{currentDateStr}</span>
              </div>

              {/* Lista de partidos en tiempo real */}
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                {agenda.map((partido) => {
                  const horaLimpia = partido.attributes?.diary_hour 
                    ? partido.attributes.diary_hour.substring(0, 5) 
                    : 'En Vivo';
                    
                  // Reemplazar saltos de línea de la descripción
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
                        borderBottom: '1px solid #1a1a1a',
                        cursor: 'pointer',
                        transition: 'background 0.2s',
                        gap: '15px'
                      }}
                      className="agenda-row"
                      onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#151515'}
                      onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                    >
                      {/* Hora */}
                      <span style={{
                        fontWeight: 'bold',
                        color: '#00ff41',
                        fontSize: '14px',
                        minWidth: '55px'
                      }}>
                        {horaLimpia}
                      </span>

                      {/* Icono de deporte según título */}
                      <span style={{ fontSize: '18px' }}>
                        {descripcion.toLowerCase().includes('tenis') || descripcion.toLowerCase().includes('garros') ? '🎾' :
                         descripcion.toLowerCase().includes('nba') || descripcion.toLowerCase().includes('basket') ? '🏀' :
                         descripcion.toLowerCase().includes('combate') || descripcion.toLowerCase().includes('ufc') ? '🥊' : '⚽'}
                      </span>

                      {/* Evento */}
                      <span style={{
                        fontSize: '14px',
                        flex: 1,
                        fontWeight: '500',
                        color: '#eee'
                      }}>
                        {descripcion}
                      </span>

                      {/* Botón Ver */}
                      <span style={{
                        fontSize: '12px',
                        backgroundColor: 'rgba(0, 255, 65, 0.1)',
                        border: '1px solid #00ff41',
                        color: '#00ff41',
                        padding: '4px 10px',
                        borderRadius: '4px',
                        fontWeight: 'bold'
                      }}>
                        VER TRANSMISIÓN
                      </span>
                    </div>
                  );
                })}
                
                {agenda.length === 0 && (
                  <div style={{ padding: '30px', textAlign: 'center', color: '#888' }}>
                    No hay partidos programados en la agenda para hoy en este momento.
                  </div>
                )}
              </div>
            </div>

            {/* Listado de Canales 24/7 Deportivos */}
            <div>
              <h3 style={{
                fontSize: '18px',
                fontWeight: 'bold',
                marginBottom: '15px',
                borderBottom: '1px solid #222',
                paddingBottom: '8px',
                color: '#888'
              }}>
                📺 Señales Deportivas 24/7 ({filteredCanales.length})
              </h3>
              
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(170px, 1fr))',
                gap: '12px'
              }}>
                {filteredCanales.slice(0, 36).map((canal, idx) => (
                  <button
                    key={idx}
                    onClick={() => seleccionarCanal247(canal)}
                    style={{
                      padding: '12px 10px',
                      backgroundColor: '#111',
                      border: '1px solid #222',
                      borderRadius: '6px',
                      color: '#ccc',
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
                      e.currentTarget.style.borderColor = '#222';
                      e.currentTarget.style.color = '#ccc';
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
                      backgroundColor: canal.url.startsWith('https://') ? '#143621' : '#5c3a21',
                      color: canal.url.startsWith('https://') ? '#81c784' : '#ffb74d'
                    }}>
                      {canal.url.startsWith('https://') ? '✓' : '⚠️'}
                    </span>

                    ⚽ {canal.nombre.replace('(720p)', '').replace('(1080p)', '').trim()}
                  </button>
                ))}
              </div>
            </div>

          </div>
        )}
      </main>

      {/* ESTILOS CSS GLOBALES */}
      <style jsx global>{`
        /* Ocultar barra de tiempo del reproductor de video para simular TV EN VIVO */
        .live-video-player video::-webkit-media-controls-timeline,
        .live-video-player video::-webkit-media-controls-time-remaining-display,
        .live-video-player video::-webkit-media-controls-current-time-display {
          display: none !important;
        }

        .scroll-horizontal::-webkit-scrollbar {
          height: 4px;
        }
        .scroll-horizontal::-webkit-scrollbar-thumb {
          background-color: #333;
          border-radius: 4px;
        }
        
        @keyframes pulse {
          0% { opacity: 0.4; }
          50% { opacity: 1; }
          100% { opacity: 0.4; }
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
