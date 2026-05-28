"use client";

import { useState, useEffect, useRef } from 'react';
import Hls from 'hls.js';

export default function StreamPage({ initialCanales }) {
  // Filtrar canales válidos (que comiencen con http o https)
  const [canales, setCanales] = useState(() => {
    return (initialCanales || []).filter(canal => 
      canal.url && (canal.url.startsWith('http://') || canal.url.startsWith('https://'))
    );
  });
  
  const [activeCanal, setActiveCanal] = useState(canales[0] || null);
  const [searchQuery, setSearchQuery] = useState('');
  const videoRef = useRef(null);
  const hlsRef = useRef(null);

  // Filtrar canales según la búsqueda
  const filteredCanales = canales.filter(canal =>
    canal.nombre.toLowerCase().includes(searchQuery.toLowerCase())
  );

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
        video.play().catch(err => console.log("Auto-play blocked or error: ", err));
      });

      hls.on(Hls.Events.ERROR, function (event, data) {
        if (data.fatal) {
          switch (data.type) {
            case Hls.ErrorTypes.NETWORK_ERROR:
              console.log("fatal network error, trying to recover");
              hls.startLoad();
              break;
            case Hls.ErrorTypes.MEDIA_ERROR:
              console.log("fatal media error, trying to recover");
              hls.recoverMediaError();
              break;
            default:
              console.log("unrecoverable error");
              hls.destroy();
              break;
          }
        }
      });
    } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
      video.src = streamUrl;
      video.addEventListener('loadedmetadata', () => {
        video.play().catch(err => console.log("Auto-play blocked or error: ", err));
      });
    }

    return () => {
      if (hlsRef.current) {
        hlsRef.current.destroy();
        hlsRef.current = null;
      }
    };
  }, [activeCanal]);

  if (!activeCanal) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', backgroundColor: '#0a0a0a', color: '#00ff41' }}>
        <h2>No hay canales disponibles en la lista...</h2>
      </div>
    );
  }

  const isActiveUrlHttp = activeCanal.url.startsWith('http://');

  return (
    <div style={{
      minHeight: '100vh',
      backgroundColor: '#0a0a0a',
      color: '#fff',
      fontFamily: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
      display: 'flex',
      flexDirection: 'column'
    }}>
      {/* Navbar Superior */}
      <header style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: '15px 20px',
        borderBottom: '1px solid #1a1a1a',
        backgroundColor: '#0f0f0f',
        position: 'sticky',
        top: 0,
        zIndex: 100
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <span style={{ fontSize: '24px' }}>⚡</span>
          <h1 style={{
            fontSize: '20px',
            fontWeight: 'bold',
            margin: 0,
            background: 'linear-gradient(45deg, #00ff41, #00ffcc)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            letterSpacing: '1px'
          }}>
            STREAM ENGINE
          </h1>
        </div>
        
        {/* Buscador */}
        <input
          type="text"
          placeholder="Buscar canal..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          style={{
            padding: '8px 15px',
            borderRadius: '20px',
            border: '1px solid #333',
            backgroundColor: '#151515',
            color: '#fff',
            outline: 'none',
            fontSize: '14px',
            width: '200px',
            transition: 'border-color 0.2s',
          }}
          onFocus={(e) => e.target.style.borderColor = '#00ff41'}
          onBlur={(e) => e.target.style.borderColor = '#333'}
        />
      </header>

      {/* Grid Principal: Reproductor y Chat */}
      <main style={{
        display: 'grid',
        gridTemplateColumns: '1fr',
        gap: '20px',
        padding: '20px',
        flex: 1,
        maxHeight: 'calc(100vh - 72px)',
        overflowY: 'auto'
      }}>
        {/* Contenedor del video y el chat */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: '1fr',
          gap: '20px',
          '@media (min-width: 1024px)': {
            gridTemplateColumns: '3fr 1.2fr'
          }
        }} className="main-content-split">
          
          {/* Columna Reproductor */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <div style={{
              position: 'relative',
              paddingTop: '56.25%', // Relación de aspecto 16:9
              backgroundColor: '#000',
              borderRadius: '12px',
              overflow: 'hidden',
              border: '1px solid #222',
              boxShadow: '0 4px 20px rgba(0,0,0,0.8)'
            }}>
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
            
            {/* Info del canal actual */}
            <div style={{
              display: 'flex',
              flexDirection: 'column',
              gap: '8px',
              padding: '10px 5px'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <span style={{
                    fontSize: '11px',
                    textTransform: 'uppercase',
                    color: '#888',
                    letterSpacing: '1.5px',
                    fontWeight: 'bold'
                  }}>
                    Reproduciendo Ahora:
                  </span>
                  <h2 style={{ fontSize: '22px', margin: '4px 0 0 0', color: '#00ff41', fontWeight: 'bold' }}>
                    {activeCanal.nombre}
                  </h2>
                </div>
                
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{
                    width: '10px',
                    height: '10px',
                    borderRadius: '50%',
                    backgroundColor: '#ff3b30',
                    display: 'inline-block',
                    animation: 'pulse 1.5s infinite'
                  }} />
                  <span style={{ fontSize: '12px', color: '#888', fontWeight: '500' }}>EN VIVO</span>
                </div>
              </div>

              {/* Advertencia de contenido mixto si el enlace es HTTP inseguro */}
              {isActiveUrlHttp && (
                <div style={{
                  backgroundColor: 'rgba(255, 152, 0, 0.1)',
                  border: '1px solid #ff9800',
                  borderRadius: '6px',
                  padding: '10px 15px',
                  marginTop: '10px',
                  color: '#ffb74d',
                  fontSize: '13px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '10px'
                }}>
                  <span>⚠️</span>
                  <div>
                    <strong>Alerta de Bloqueo:</strong> Este canal usa una dirección insegura (<code>http://</code>). 
                    Como Vercel usa HTTPS seguro, tu navegador bloqueará la transmisión por seguridad (Mixed Content). 
                    Prueba a buscar canales con direcciones seguras (<code>https://</code>) o desactiva temporalmente el bloqueo de contenido no seguro en tu navegador para este sitio.
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Columna Chat (Chatango) */}
          <div style={{
            height: '450px',
            backgroundColor: '#0f0f0f',
            borderRadius: '12px',
            border: '1px solid #222',
            overflow: 'hidden',
            display: 'flex',
            flexDirection: 'column',
            boxShadow: '0 4px 20px rgba(0,0,0,0.8)'
          }} className="chat-container-responsive">
            <div style={{
              padding: '12px 15px',
              borderBottom: '1px solid #222',
              backgroundColor: '#151515',
              display: 'flex',
              alignItems: 'center',
              gap: '8px'
            }}>
              <span style={{ color: '#00ff41' }}>💬</span>
              <span style={{ fontSize: '14px', fontWeight: 'bold', letterSpacing: '0.5px' }}>
                CHAT EN VIVO
              </span>
            </div>
            
            <div style={{ flex: 1, position: 'relative', width: '100%', height: '100%' }}>
              <iframe 
                src="https://play.chatango.com/g/flash?gid=streamengine-global&amp;j=1&amp;k=00ff41&amp;p=2"
                width="100%" 
                height="100%" 
                frameBorder="0" 
                scrolling="no"
                style={{ border: 'none', position: 'absolute', top: 0, left: 0 }}
              />
            </div>
          </div>
        </div>

        {/* Lista de Canales */}
        <div style={{ marginTop: '20px', paddingBottom: '40px' }}>
          <h3 style={{
            fontSize: '18px',
            marginBottom: '15px',
            borderBottom: '1px solid #1a1a1a',
            paddingBottom: '10px',
            color: '#aaa',
            fontWeight: 'bold'
          }}>
            Otros Canales Disponibles ({filteredCanales.length})
          </h3>
          
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))',
            gap: '12px'
          }}>
            {filteredCanales.map((canal, index) => {
              const isActive = canal.url === activeCanal.url;
              const isHttp = canal.url.startsWith('http://');
              return (
                <button
                  key={index}
                  onClick={() => setActiveCanal(canal)}
                  style={{
                    padding: '15px 10px',
                    backgroundColor: isActive ? 'rgba(0, 255, 65, 0.1)' : '#0f0f0f',
                    border: isActive ? '1px solid #00ff41' : '1px solid #222',
                    borderRadius: '8px',
                    color: isActive ? '#00ff41' : '#ccc',
                    fontWeight: 'bold',
                    fontSize: '13px',
                    cursor: 'pointer',
                    transition: 'all 0.2s ease',
                    outline: 'none',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '8px',
                    boxShadow: isActive ? '0 0 10px rgba(0, 255, 65, 0.2)' : 'none',
                    minHeight: '80px',
                    position: 'relative'
                  }}
                  onMouseEnter={(e) => {
                    if (!isActive) {
                      e.currentTarget.style.borderColor = '#00ff41';
                      e.currentTarget.style.color = '#fff';
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (!isActive) {
                      e.currentTarget.style.borderColor = '#222';
                      e.currentTarget.style.color = '#ccc';
                    }
                  }}
                >
                  {/* Pequeño tag indicando si es HTTPS o HTTP */}
                  <span style={{
                    position: 'absolute',
                    top: '5px',
                    right: '5px',
                    fontSize: '9px',
                    padding: '2px 4px',
                    borderRadius: '4px',
                    backgroundColor: isHttp ? '#5c3a21' : '#143621',
                    color: isHttp ? '#ffb74d' : '#81c784'
                  }}>
                    {isHttp ? 'HTTP' : 'HTTPS'}
                  </span>

                  <span style={{ fontSize: '18px', marginTop: '5px' }}>📺</span>
                  <div style={{
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                    width: '100%',
                    color: isActive ? '#00ff41' : '#ccc',
                    display: 'block',
                    textAlign: 'center'
                  }}>
                    {canal.nombre}
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      </main>

      {/* Estilos CSS adaptativos insertados como style tag */}
      <style jsx global>{`
        @keyframes pulse {
          0% { opacity: 0.4; }
          50% { opacity: 1; }
          100% { opacity: 0.4; }
        }
        
        @media (min-width: 1024px) {
          .main-content-split {
            grid-template-columns: 3.2fr 1.2fr !important;
          }
          .chat-container-responsive {
            height: 100% !important;
            min-height: 480px;
          }
        }
      `}</style>
    </div>
  );
}
