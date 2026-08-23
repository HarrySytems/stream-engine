'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';

export default function AdminDashboard() {
  const [pin, setPin] = useState('');
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [authError, setAuthError] = useState('');
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(false);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [lastUpdated, setLastUpdated] = useState('');

  // Comprobar si ya estaba autenticado en la sesión
  useEffect(() => {
    const savedPin = sessionStorage.getItem('filmtv_admin_pin');
    if (savedPin) {
      setPin(savedPin);
      fetchStats(savedPin);
    }
  }, []);

  const fetchStats = async (authPin) => {
    const targetPin = authPin || pin;
    if (!targetPin) return;

    try {
      setLoading(true);
      const res = await fetch(`/api/analytics/stats?pin=${encodeURIComponent(targetPin)}`);
      if (res.status === 401) {
        setAuthError('PIN incorrecto. Intenta nuevamente.');
        setIsAuthenticated(false);
        sessionStorage.removeItem('filmtv_admin_pin');
        return;
      }
      if (!res.ok) throw new Error('Error al cargar datos');

      const data = await res.json();
      setStats(data);
      setIsAuthenticated(true);
      setAuthError('');
      sessionStorage.setItem('filmtv_admin_pin', targetPin);
      setLastUpdated(new Date().toLocaleTimeString('es-PE'));
    } catch (err) {
      console.error(err);
      setAuthError('Error al conectar con el servidor.');
    } finally {
      setLoading(false);
    }
  };

  // Auto-refresco cada 10 segundos si está activo
  useEffect(() => {
    if (!isAuthenticated || !autoRefresh) return;
    const interval = setInterval(() => {
      fetchStats(pin);
    }, 10000);
    return () => clearInterval(interval);
  }, [isAuthenticated, autoRefresh, pin]);

  const handleLogin = (e) => {
    e.preventDefault();
    fetchStats(pin);
  };

  const handleLogout = () => {
    setIsAuthenticated(false);
    setPin('');
    sessionStorage.removeItem('filmtv_admin_pin');
  };

  // -------------------------------------------------------------
  // VISTA 1: PANTALLA DE ACCESO CON PIN
  // -------------------------------------------------------------
  if (!isAuthenticated) {
    return (
      <div style={{
        minHeight: '100vh',
        backgroundColor: '#0a0a0c',
        color: '#ffffff',
        fontFamily: "'Inter', sans-serif",
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '20px'
      }}>
        <div style={{
          width: '100%',
          maxWidth: '380px',
          background: 'rgba(255, 255, 255, 0.03)',
          border: '1px solid rgba(255, 230, 0, 0.2)',
          borderRadius: '16px',
          padding: '36px 28px',
          boxShadow: '0 20px 50px rgba(0,0,0,0.8)',
          backdropFilter: 'blur(20px)',
          textAlign: 'center'
        }}>
          <div style={{ marginBottom: '20px' }}>
            <span style={{ fontSize: '42px' }}>🔒</span>
            <h1 style={{
              margin: '12px 0 6px 0',
              fontSize: '22px',
              fontWeight: '800',
              background: 'linear-gradient(90deg, #ffe600, #ffd000)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent'
            }}>
              Panel de Control
            </h1>
            <p style={{ margin: 0, color: '#888', fontSize: '13px' }}>
              Ingresa tu PIN de administrador
            </p>
          </div>

          <form onSubmit={handleLogin}>
            <input
              type="password"
              maxLength="8"
              value={pin}
              onChange={(e) => setPin(e.target.value)}
              placeholder="••••"
              autoFocus
              style={{
                width: '100%',
                backgroundColor: 'rgba(255, 255, 255, 0.05)',
                border: '1px solid rgba(255, 255, 255, 0.15)',
                borderRadius: '10px',
                padding: '14px',
                color: '#ffffff',
                fontSize: '24px',
                textAlign: 'center',
                letterSpacing: '8px',
                marginBottom: '16px',
                outline: 'none',
                transition: 'border-color 0.2s'
              }}
              onFocus={(e) => e.target.style.borderColor = '#ffe600'}
              onBlur={(e) => e.target.style.borderColor = 'rgba(255, 255, 255, 0.15)'}
            />

            {authError && (
              <div style={{ color: '#ff4d4f', fontSize: '13px', marginBottom: '16px', fontWeight: '500' }}>
                {authError}
              </div>
            )}

            <button
              type="submit"
              disabled={loading || !pin}
              style={{
                width: '100%',
                backgroundColor: '#ffe600',
                color: '#000000',
                border: 'none',
                borderRadius: '10px',
                padding: '14px',
                fontSize: '15px',
                fontWeight: '800',
                cursor: 'pointer',
                transition: 'transform 0.2s, background 0.2s',
                opacity: (!pin || loading) ? 0.6 : 1
              }}
              onMouseEnter={(e) => e.target.style.backgroundColor = '#ffd000'}
              onMouseLeave={(e) => e.target.style.backgroundColor = '#ffe600'}
            >
              {loading ? 'Verificando...' : 'Desbloquear Panel'}
            </button>
          </form>

          <div style={{ marginTop: '24px' }}>
            <Link href="/" style={{ color: 'rgba(255, 255, 255, 0.4)', fontSize: '13px', textDecoration: 'none' }}>
              ← Volver a FilmTV
            </Link>
          </div>
        </div>
      </div>
    );
  }

  // -------------------------------------------------------------
  // VISTA 2: DASHBOARD EN TIEMPO REAL
  // -------------------------------------------------------------
  return (
    <div style={{
      minHeight: '100vh',
      backgroundColor: '#0a0a0c',
      color: '#ffffff',
      fontFamily: "'Inter', sans-serif",
      padding: '24px 20px 60px 20px'
    }}>
      <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
        
        {/* TOP BAR */}
        <header style={{
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '16px',
          paddingBottom: '20px',
          borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
          marginBottom: '28px'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
            <Link href="/" style={{ textDecoration: 'none' }}>
              <div style={{
                background: '#ffe600',
                color: '#000',
                fontWeight: '900',
                fontSize: '14px',
                padding: '6px 12px',
                borderRadius: '6px',
                display: 'inline-block'
              }}>
                FILM TV
              </div>
            </Link>
            <div>
              <h1 style={{ margin: 0, fontSize: '20px', fontWeight: '800' }}>Panel de Estadísticas</h1>
              <span style={{ fontSize: '12px', color: '#888' }}>
                Actualizado a las {lastUpdated || 'ahora'}
              </span>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <button
              onClick={() => fetchStats(pin)}
              style={{
                background: 'rgba(255, 255, 255, 0.06)',
                border: '1px solid rgba(255, 255, 255, 0.1)',
                color: '#fff',
                padding: '8px 16px',
                borderRadius: '8px',
                fontSize: '13px',
                fontWeight: '600',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '6px'
              }}
            >
              🔄 Refrescar
            </button>

            <button
              onClick={() => setAutoRefresh(!autoRefresh)}
              style={{
                background: autoRefresh ? 'rgba(34, 197, 94, 0.15)' : 'rgba(255, 255, 255, 0.06)',
                border: `1px solid ${autoRefresh ? 'rgba(34, 197, 94, 0.4)' : 'rgba(255, 255, 255, 0.1)'}`,
                color: autoRefresh ? '#4ade80' : '#888',
                padding: '8px 14px',
                borderRadius: '8px',
                fontSize: '13px',
                fontWeight: '600',
                cursor: 'pointer'
              }}
            >
              {autoRefresh ? '● En Vivo (10s)' : '○ Pausado'}
            </button>

            <button
              onClick={handleLogout}
              style={{
                background: 'rgba(239, 68, 68, 0.1)',
                border: '1px solid rgba(239, 68, 68, 0.3)',
                color: '#ef4444',
                padding: '8px 14px',
                borderRadius: '8px',
                fontSize: '13px',
                fontWeight: '600',
                cursor: 'pointer'
              }}
            >
              Salir
            </button>
          </div>
        </header>

        {/* 1. TARJETAS PRINCIPALES (KPIs) */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
          gap: '16px',
          marginBottom: '32px'
        }}>
          
          {/* TARJETA 1: EN VIVO */}
          <div style={{
            background: 'linear-gradient(135deg, rgba(34, 197, 94, 0.1) 0%, rgba(20, 20, 25, 0.8) 100%)',
            border: '1px solid rgba(34, 197, 94, 0.3)',
            borderRadius: '14px',
            padding: '20px',
            position: 'relative',
            overflow: 'hidden'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
              <span style={{ fontSize: '13px', color: '#4ade80', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                En Vivo Ahora
              </span>
              <span style={{
                display: 'inline-block',
                width: '10px',
                height: '10px',
                backgroundColor: '#22c55e',
                borderRadius: '50%',
                boxShadow: '0 0 12px #22c55e',
                animation: 'pulse 1.5s infinite'
              }}></span>
            </div>
            <div style={{ fontSize: '38px', fontWeight: '900', color: '#ffffff' }}>
              {stats?.onlineNow || 0}
            </div>
            <div style={{ fontSize: '12px', color: '#888', marginTop: '4px' }}>
              usuarios activos en tu web
            </div>
          </div>

          {/* TARJETA 2: VISITAS HOY */}
          <div style={{
            background: 'rgba(255, 255, 255, 0.03)',
            border: '1px solid rgba(255, 255, 255, 0.08)',
            borderRadius: '14px',
            padding: '20px'
          }}>
            <div style={{ fontSize: '13px', color: '#ffe600', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '8px' }}>
              Visitas Hoy
            </div>
            <div style={{ fontSize: '38px', fontWeight: '900', color: '#ffffff' }}>
              {stats?.todayVisits || 0}
            </div>
            <div style={{ fontSize: '12px', color: '#888', marginTop: '4px' }}>
              Ayer: <strong style={{ color: '#bbb' }}>{stats?.yesterdayVisits || 0}</strong> visitas
            </div>
          </div>

          {/* TARJETA 3: ESTA SEMANA */}
          <div style={{
            background: 'rgba(255, 255, 255, 0.03)',
            border: '1px solid rgba(255, 255, 255, 0.08)',
            borderRadius: '14px',
            padding: '20px'
          }}>
            <div style={{ fontSize: '13px', color: '#38bdf8', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '8px' }}>
              Últimos 7 Días
            </div>
            <div style={{ fontSize: '38px', fontWeight: '900', color: '#ffffff' }}>
              {stats?.weekVisits || 0}
            </div>
            <div style={{ fontSize: '12px', color: '#888', marginTop: '4px' }}>
              Reproducciones hoy: <strong style={{ color: '#bbb' }}>{stats?.todayPlays || 0}</strong>
            </div>
          </div>

          {/* TARJETA 4: TOTAL HISTÓRICO */}
          <div style={{
            background: 'rgba(255, 255, 255, 0.03)',
            border: '1px solid rgba(255, 255, 255, 0.08)',
            borderRadius: '14px',
            padding: '20px'
          }}>
            <div style={{ fontSize: '13px', color: '#c084fc', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '8px' }}>
              Total Histórico
            </div>
            <div style={{ fontSize: '38px', fontWeight: '900', color: '#ffffff' }}>
              {stats?.totalVisits || 0}
            </div>
            <div style={{ fontSize: '12px', color: '#888', marginTop: '4px' }}>
              Páginas visualizadas acumuladas
            </div>
          </div>
        </div>

        {/* 2. GRÁFICA SEMANAL + DISPOSITIVOS */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
          gap: '20px',
          marginBottom: '32px'
        }}>
          
          {/* GRÁFICA SEMANAL */}
          <div style={{
            background: 'rgba(255, 255, 255, 0.02)',
            border: '1px solid rgba(255, 255, 255, 0.06)',
            borderRadius: '14px',
            padding: '22px'
          }}>
            <h3 style={{ margin: '0 0 18px 0', fontSize: '16px', fontWeight: '700', color: '#ffe600' }}>
              📊 Visitas de los Últimos 7 Días
            </h3>

            <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', height: '140px', paddingTop: '20px', gap: '8px' }}>
              {(stats?.last7Days || []).map((day, idx) => {
                const max = Math.max(...(stats?.last7Days.map(d => d.views) || [1]), 1);
                const heightPercent = Math.max((day.views / max) * 100, 10);
                const isToday = idx === stats.last7Days.length - 1;

                return (
                  <div key={day.date} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
                    <span style={{ fontSize: '11px', color: '#888', fontWeight: '600' }}>{day.views}</span>
                    <div style={{
                      width: '100%',
                      maxWidth: '36px',
                      height: `${heightPercent}%`,
                      background: isToday ? 'linear-gradient(180deg, #ffe600, #ffd000)' : 'rgba(255, 255, 255, 0.12)',
                      borderRadius: '4px 4px 0 0',
                      transition: 'height 0.5s ease'
                    }}></div>
                    <span style={{ fontSize: '11px', color: isToday ? '#ffe600' : '#666', fontWeight: isToday ? '700' : '500' }}>
                      {day.label}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* DISPOSITIVOS */}
          <div style={{
            background: 'rgba(255, 255, 255, 0.02)',
            border: '1px solid rgba(255, 255, 255, 0.06)',
            borderRadius: '14px',
            padding: '22px'
          }}>
            <h3 style={{ margin: '0 0 18px 0', fontSize: '16px', fontWeight: '700', color: '#ffe600' }}>
              📱 Dispositivos de tus Usuarios
            </h3>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              {(stats?.devices || []).map((dev) => {
                const icon = dev.name === 'Móvil' ? '📱' : (dev.name === 'Smart TV' ? '📺' : (dev.name === 'Tablet' ? '📟' : '💻'));
                return (
                  <div key={dev.name}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', marginBottom: '6px' }}>
                      <span>{icon} {dev.name}</span>
                      <span style={{ fontWeight: '700', color: '#ffe600' }}>{dev.percentage}% ({dev.count})</span>
                    </div>
                    <div style={{ width: '100%', height: '6px', background: 'rgba(255, 255, 255, 0.08)', borderRadius: '3px', overflow: 'hidden' }}>
                      <div style={{ width: `${dev.percentage}%`, height: '100%', background: '#ffe600', borderRadius: '3px' }}></div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* 3. TOP CONTENIDO + PAÍSES */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
          gap: '20px',
          marginBottom: '32px'
        }}>
          
          {/* TOP CONTENIDO */}
          <div style={{
            background: 'rgba(255, 255, 255, 0.02)',
            border: '1px solid rgba(255, 255, 255, 0.06)',
            borderRadius: '14px',
            padding: '22px'
          }}>
            <h3 style={{ margin: '0 0 16px 0', fontSize: '16px', fontWeight: '700', color: '#ffe600' }}>
              🎬 Top 10 Contenido Más Visto
            </h3>

            {(!stats?.topContent || stats.topContent.length === 0) ? (
              <p style={{ color: '#666', fontSize: '13px' }}>Aún no hay reproducciones registradas hoy.</p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {stats.topContent.map((item, idx) => (
                  <div key={item.title} style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '10px 12px',
                    background: 'rgba(255, 255, 255, 0.02)',
                    border: '1px solid rgba(255, 255, 255, 0.04)',
                    borderRadius: '8px',
                    fontSize: '13px'
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', overflow: 'hidden' }}>
                      <span style={{
                        fontWeight: '800',
                        color: idx === 0 ? '#ffd700' : (idx === 1 ? '#c0c0c0' : (idx === 2 ? '#cd7f32' : '#666')),
                        minWidth: '18px'
                      }}>
                        #{idx + 1}
                      </span>
                      <span style={{ fontWeight: '600', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {item.title}
                      </span>
                    </div>
                    <span style={{
                      background: 'rgba(255, 230, 0, 0.1)',
                      color: '#ffe600',
                      padding: '3px 8px',
                      borderRadius: '4px',
                      fontWeight: '700',
                      fontSize: '12px'
                    }}>
                      {item.count} views
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* PAÍSES */}
          <div style={{
            background: 'rgba(255, 255, 255, 0.02)',
            border: '1px solid rgba(255, 255, 255, 0.06)',
            borderRadius: '14px',
            padding: '22px'
          }}>
            <h3 style={{ margin: '0 0 16px 0', fontSize: '16px', fontWeight: '700', color: '#ffe600' }}>
              🌍 Países de tus Visitantes
            </h3>

            {(!stats?.countries || stats.countries.length === 0) ? (
              <p style={{ color: '#666', fontSize: '13px' }}>Aún no hay datos de países registrados.</p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {stats.countries.map((c) => (
                  <div key={c.code}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', marginBottom: '5px' }}>
                      <span>{c.flag} {c.name}</span>
                      <span style={{ fontWeight: '700', color: '#38bdf8' }}>{c.percentage}% ({c.count})</span>
                    </div>
                    <div style={{ width: '100%', height: '5px', background: 'rgba(255, 255, 255, 0.08)', borderRadius: '3px', overflow: 'hidden' }}>
                      <div style={{ width: `${c.percentage}%`, height: '100%', background: '#38bdf8', borderRadius: '3px' }}></div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* 4. FEED DE ACTIVIDAD EN TIEMPO REAL */}
        <div style={{
          background: 'rgba(255, 255, 255, 0.02)',
          border: '1px solid rgba(255, 255, 255, 0.06)',
          borderRadius: '14px',
          padding: '22px'
        }}>
          <h3 style={{ margin: '0 0 16px 0', fontSize: '16px', fontWeight: '700', color: '#ffe600' }}>
            ⚡ Actividad en Tiempo Real
          </h3>

          {(!stats?.recentActivity || stats.recentActivity.length === 0) ? (
            <p style={{ color: '#666', fontSize: '13px' }}>Esperando las primeras interacciones...</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {stats.recentActivity.map((act) => (
                <div key={act.id} style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '8px 12px',
                  background: 'rgba(255, 255, 255, 0.015)',
                  borderRadius: '6px',
                  fontSize: '12px'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{
                      display: 'inline-block',
                      padding: '2px 6px',
                      borderRadius: '4px',
                      fontSize: '10px',
                      fontWeight: '800',
                      background: act.action === 'Reproducción' ? 'rgba(34, 197, 94, 0.2)' : 'rgba(56, 189, 248, 0.2)',
                      color: act.action === 'Reproducción' ? '#4ade80' : '#38bdf8'
                    }}>
                      {act.action.toUpperCase()}
                    </span>
                    <span style={{ color: '#eee', fontWeight: '500' }}>{act.title}</span>
                  </div>
                  <div style={{ color: '#777', fontSize: '11px', display: 'flex', gap: '8px' }}>
                    <span>{act.device}</span>
                    <span>•</span>
                    <span>{act.time}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

      </div>
    </div>
  );
}
