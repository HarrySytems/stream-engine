import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

export const dynamic = 'force-dynamic';

// Memoria volátil para usuarios activos en tiempo real (últimos 2 minutos)
// Clave: sessionId, Valor: { timestamp, country, device, currentAction, title }
global._activeSessions = global._activeSessions || new Map();
global._recentEvents = global._recentEvents || [];

function getAnalyticsPath() {
  return path.join(process.cwd(), 'analytics.json');
}

function loadAnalytics() {
  try {
    const p = getAnalyticsPath();
    if (fs.existsSync(p)) {
      return JSON.parse(fs.readFileSync(p, 'utf-8'));
    }
  } catch (err) {
    console.error("Error reading analytics.json:", err);
  }
  return {
    totalVisits: 0,
    daily: {},
    plays: {}
  };
}

function saveAnalytics(data) {
  try {
    const p = getAnalyticsPath();
    fs.writeFileSync(p, JSON.stringify(data, null, 2), 'utf-8');
  } catch (err) {
    console.error("Error writing analytics.json:", err);
  }
}

function detectDevice(userAgent = '') {
  const ua = userAgent.toLowerCase();
  if (ua.includes('smart-tv') || ua.includes('tizen') || ua.includes('webos') || ua.includes('roku') || ua.includes('appletv') || ua.includes('googletv') || ua.includes('crkey')) {
    return 'Smart TV';
  }
  if (ua.includes('mobile') || ua.includes('android') || ua.includes('iphone') || ua.includes('ipod')) {
    return 'Móvil';
  }
  if (ua.includes('tablet') || ua.includes('ipad')) {
    return 'Tablet';
  }
  return 'Computadora';
}

function getTodayKey() {
  const now = new Date();
  return now.toISOString().split('T')[0];
}

export async function POST(request) {
  try {
    const body = await request.json().catch(() => ({}));
    const { action = 'pageview', title = '', type = '', sessionId = '', path = '/' } = body;

    const userAgent = request.headers.get('user-agent') || '';
    const device = detectDevice(userAgent);
    const country = request.headers.get('cf-ipcountry') || 
                    request.headers.get('x-vercel-ip-country') || 
                    body.country || 
                    'PE';

    const now = Date.now();
    const sId = sessionId || `${request.headers.get('x-forwarded-for') || 'guest'}-${userAgent.slice(0, 20)}`;

    // 1. Actualizar memoria de usuarios activos en vivo
    global._activeSessions.set(sId, {
      lastSeen: now,
      country: country.toUpperCase(),
      device,
      action,
      title: title || (path === '/' ? 'Página Principal' : path),
      type
    });

    // Limpiar sesiones inactivas (más de 2 minutos sin ping)
    for (const [key, session] of global._activeSessions.entries()) {
      if (now - session.lastSeen > 120000) {
        global._activeSessions.delete(key);
      }
    }

    // 2. Registrar evento reciente en cola
    if (action === 'play' || action === 'pageview') {
      global._recentEvents.unshift({
        id: `${now}-${Math.random()}`,
        time: new Date().toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
        action: action === 'play' ? 'Reproducción' : 'Visita',
        title: title || path,
        type: type || 'web',
        device,
        country: country.toUpperCase()
      });

      if (global._recentEvents.length > 30) {
        global._recentEvents.pop();
      }
    }

    // 3. Si es una nueva visita o reproducción, actualizar archivo acumulativo
    if (action === 'pageview' || action === 'play') {
      const db = loadAnalytics();
      const today = getTodayKey();

      if (!db.daily[today]) {
        db.daily[today] = {
          views: 0,
          plays: 0,
          devices: { 'Móvil': 0, 'Computadora': 0, 'Smart TV': 0, 'Tablet': 0 },
          countries: {}
        };
      }

      if (action === 'pageview') {
        db.totalVisits = (db.totalVisits || 0) + 1;
        db.daily[today].views = (db.daily[today].views || 0) + 1;
      }

      if (action === 'play' && title) {
        db.daily[today].plays = (db.daily[today].plays || 0) + 1;
        db.plays[title] = {
          count: ((db.plays[title] && db.plays[title].count) || 0) + 1,
          type: type || 'pelicula',
          lastPlayed: today
        };
      }

      // Contador de dispositivo
      db.daily[today].devices[device] = (db.daily[today].devices[device] || 0) + 1;

      // Contador de país
      const cUpper = country.toUpperCase();
      db.daily[today].countries[cUpper] = (db.daily[today].countries[cUpper] || 0) + 1;

      saveAnalytics(db);
    }

    return NextResponse.json({ ok: true, onlineCount: global._activeSessions.size });
  } catch (error) {
    console.error("Error in analytics track:", error);
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
