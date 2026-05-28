"use client";

import { useState, useEffect, useRef } from 'react';
import Hls from 'hls.js';

export default function StreamPage({ initialCanales }) {
  // Filtrar canales válidos
  const [canales] = useState(() => {
    return (initialCanales || []).filter(canal => 
      canal.url && (canal.url.startsWith('http://') || canal.url.startsWith('https://'))
    );
  });

  const [activeCanal, setActiveCanal] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [currentDateStr, setCurrentDateStr] = useState('');
  const videoRef = useRef(null);
  const hlsRef = useRef(null);

  // Generar la fecha de hoy formateada en español
  useEffect(() => {
    const opciones = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
    const hoy = new Date().toLocaleDateString('es-ES', opciones);
    setCurrentDateStr(hoy.charAt(0).toUpperCase() + hoy.slice(1));
  }, []);

  // Agenda de partidos/eventos para el día de hoy
  // Asociaremos estos eventos a canales que tienes en tu JSON
  const [agenda] = useState([
    { hora: '12:00', deporte: '⚽', evento: 'Champions League: Real Madrid vs Bayern Múnich', canalBusqueda: 'ESPN' },
    { hora: '13:30', deporte: '🎾', evento: 'Roland Garros: Carlos Alcaraz vs Novak Djokovic', canalBusqueda: 'Golf' }, // usando Golf o similar de respaldo
    { hora: '15:00', deporte: '⚽', evento: 'Premier League: Manchester City vs Arsenal', canalBusqueda: 'Fox Sports 1' },
    { hora: '16:15', deporte: '⚽', evento: 'La Liga: Barcelona vs Atlético de Madrid', canalBusqueda: 'LaLiga' },
    { hora: '18:00', deporte: '⚽', evento: 'Copa Libertadores: River Plate vs Palmeiras', canalBusqueda: 'DirecTV' },
    { hora: '19:30', deporte: '🏀', evento: 'NBA Playoff: Los Angeles Lakers vs Golden State Warriors', canalBusqueda: 'NBA' },
    { hora: '20:00', deporte: '⚽', evento: 'Copa Sudamericana: Boca Juniors vs Independiente del Valle', canalBusqueda: 'Uruguay' },
    { hora: '21:30', deporte: '🥊', evento: 'Combate Estelar: Canelo Álvarez vs Jaime Munguía', canalBusqueda: 'DAZN' }
  ]);

  // Buscar un canal real del JSON basado en la búsqueda del evento de la agenda
  const obtenerCanalParaEvento = (busqueda) => {
    const encontrado = canales.find(c => c.nombre.toLowerCase().includes(busqueda.toLowerCase()));
    return encontrado || canales[0]; // Retorna el primero si no encuentra coincidencia exacta
  };

  // Filtrar la lista de canales para el buscador manual de la barra superior
  const filteredCanales = canales.filter(canal =>
    canal.nombre.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Administrar la reproducción de video
  useEffect(() => {
    if (!activeCanal || !videoRef.current) return;

    if (hlsRef.current) {
      hlsRef.current.destroy();
    }

    const video = videoRef.current;
    const streamUrl = activeCanal.url;

    if (Hls.isSupported()) {
      const hls = new Hls({
        maxMaxBufferLength: 10,
        enableWorker: true,
        lowLatencyMode: true,
      });
      hlsRef.current = hls;
      hls.loadSource(streamUrl);
      hls.attachMedia(video);
      hls.on(Hls.Events.MANIFEST_PARSED, () => {
        video.play().catch(err => console.log("Auto-play blocked: ", err));
      });

      hls.on(Hls.Events.ERROR, function (event, data) {
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
  }, [activeCanal]);

  const isHttp = activeCanal?.url.startsWith('http://');

  return (
    <div style={{
      minHeight: '100vh',
      backgroundColor: '#0a0a0a',
      color: '#fff',
      fontFamily: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
      display: 'flex',
      flexDirection: 'column'
    }}>
      {/* HEADER ESTILO FÚTBOL LIBRE (Premium Oscuro) */}
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
            onClick={() => setActiveCanal(null)} 
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
              Fútbol Libre <span style={{ color: '#fff', fontSize: '14px' }}>Clone</span>
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

        {/* Canales de acceso rápido (Barra superior) */}
        <div style={{
          display: 'flex',
          gap: '10px',
          overflowX: 'auto',
          paddingBottom: '5px',
          whiteSpace: 'nowrap'
        }} className="scroll-horizontal">
          {['ESPN', 'Fox Sports', 'DirecTV', 'LaLiga', 'DAZN', 'Tigo Sports'].map((nombreCanal, idx) => (
            <button
              key={idx}
              onClick={() => {
                const canal = obtenerCanalParaEvento(nombreCanal);
                setActiveCanal(canal);
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
        
        {/* VISTA 1: REPRODUCTOR Y CHAT EN VIVO */}
        {activeCanal ? (
          <div>
            {/* Botón para regresar a la agenda */}
            <button
              onClick={() => setActiveCanal(null)}
              style={{
                backgroundColor: '#111',
                color: '#00ff41',
                border: '1px solid #00ff41',
                padding: '8px 16px',
                borderRadius: '6px',
                fontWeight: 'bold',
                cursor: 'pointer',
                marginBottom: '15px',
                display: 'flex',
                alignItems: 'center',
                gap: '8px'
              }}
            >
              ⬅ Volver a la Agenda de Partidos
            </button>

            {/* Grid del Video y Chat */}
            <div style={{
              display: 'grid',
              gridTemplateColumns: '1fr',
              gap: '20px',
              // En escritorio cambia a dos columnas
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
                  border: '1px solid #222'
                }} className="live-video-player">
                  <video
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
                </div>

                {/* Información del Canal Activo */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginTop: '5px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <h2 style={{ color: '#00ff41', fontSize: '20px', margin: 0, fontWeight: 'bold' }}>
                      {activeCanal.nombre}
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

                  {isHttp && (
                    <div style={{
                      backgroundColor: 'rgba(255, 152, 0, 0.1)',
                      border: '1px solid #ff9800',
                      borderRadius: '6px',
                      padding: '10px',
                      color: '#ffb74d',
                      fontSize: '12px',
                      marginTop: '10px'
                    }}>
                      ⚠️ <strong>Alerta:</strong> Este canal es inseguro (<code>http</code>). Si no carga, dale clic al icono de escudo/candado de tu navegador al lado de la URL y activa "Permitir contenido no seguro" para esta web.
                    </div>
                  )}
                </div>
              </div>

              {/* Columna del Chat de Chatango */}
              <div style={{
                height: '480px',
                backgroundColor: '#0c0c0c',
                borderRadius: '8px',
                border: '1px solid #222',
                display: 'flex',
                flexDirection: 'column',
                overflow: 'hidden'
              }} className="chat-block">
                <div style={{
                  padding: '10px 15px',
                  backgroundColor: '#121212',
                  borderBottom: '1px solid #222',
                  fontSize: '13px',
                  fontWeight: 'bold',
                  color: '#00ff41'
                }}>
                  💬 CHAT DEL PARTIDO
                </div>
                <div style={{ flex: 1, position: 'relative' }}>
                  <iframe 
                    src={`https://play.chatango.com/g/flash?gid=streamengine-global&amp;j=1&amp;k=00ff41&amp;p=2`}
                    width="100%" 
                    height="100%" 
                    frameBorder="0" 
                    scrolling="no"
                    style={{ border: 'none', position: 'absolute', top: 0, left: 0 }}
                  />
                </div>
              </div>

            </div>
          </div>
        ) : (
          
          /* VISTA 2: AGENDA ESTILO FÚTBOL LIBRE */
          <div style={{ display: 'flex', flexDirection: 'column', gap: '25px' }}>
            
            {/* Mensaje de Bienvenida */}
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
              <strong style={{ color: '#00ff41' }}>Fútbol Libre</strong> ofrece transmisiones deportivas en vivo online de distintas ligas de fútbol y disciplinas. Haz clic en cualquiera de los partidos de la agenda para cargarlo en el reproductor interactivo con chat.
            </div>

            {/* Agenda del día */}
            <div style={{
              backgroundColor: '#0c0c0c',
              border: '1px solid #222',
              borderRadius: '8px',
              overflow: 'hidden'
            }}>
              {/* Barra verde de la agenda */}
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
                <span>📅 Agenda de Eventos</span>
                <span style={{ fontSize: '13px', opacity: 0.9 }}>{currentDateStr}</span>
              </div>

              {/* Lista de partidos */}
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                {agenda.map((partido, index) => (
                  <div
                    key={index}
                    onClick={() => {
                      const canal = obtenerCanalParaEvento(partido.canalBusqueda);
                      setActiveCanal(canal);
                    }}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      padding: '12px 15px',
                      borderBottom: index < agenda.length - 1 ? '1px solid #1a1a1a' : 'none',
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
                      minWidth: '50px'
                    }}>
                      {partido.hora}
                    </span>

                    {/* Icono de deporte */}
                    <span style={{ fontSize: '18px' }}>{partido.deporte}</span>

                    {/* Evento */}
                    <span style={{
                      fontSize: '14px',
                      flex: 1,
                      fontWeight: '500',
                      color: '#eee'
                    }}>
                      {partido.evento}
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
                ))}
              </div>
            </div>

            {/* Listado Completo de Canales por si quieren ver la señal fija */}
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
                {filteredCanales.slice(0, 40).map((canal, idx) => (
                  <button
                    key={idx}
                    onClick={() => setActiveCanal(canal)}
                    style={{
                      padding: '12px 10px',
                      backgroundColor: '#111',
                      border: '1px solid #222',
                      borderRadius: '6px',
                      color: '#ccc',
                      fontWeight: 'bold',
                      fontSize: '13px',
                      cursor: 'pointer',
                      transition: 'all 0.2s',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '8px'
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
