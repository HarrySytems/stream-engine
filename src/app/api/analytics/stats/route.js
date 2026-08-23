import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

export const dynamic = 'force-dynamic';

const ADMIN_PIN = "2026";

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

function getTodayKey() {
  const now = new Date();
  return now.toISOString().split('T')[0];
}

function getYesterdayKey() {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return d.toISOString().split('T')[0];
}

const COUNTRY_NAMES = {
  PE: { name: 'Perú', flag: '🇵🇪' },
  MX: { name: 'México', flag: '🇲🇽' },
  AR: { name: 'Argentina', flag: '🇦🇷' },
  CO: { name: 'Colombia', flag: '🇨🇴' },
  CL: { name: 'Chile', flag: '🇨🇱' },
  ES: { name: 'España', flag: '🇪🇸' },
  US: { name: 'Estados Unidos', flag: '🇺🇸' },
  EC: { name: 'Ecuador', flag: '🇪🇨' },
  BO: { name: 'Bolivia', flag: '🇧🇴' },
  VE: { name: 'Venezuela', flag: '🇻🇪' },
  GT: { name: 'Guatemala', flag: '🇬🇹' },
  CR: { name: 'Costa Rica', flag: '🇨🇷' },
  DO: { name: 'Rep. Dominicana', flag: '🇩🇴' },
  BR: { name: 'Brasil', flag: '🇧🇷' },
  UY: { name: 'Uruguay', flag: '🇺🇾' },
  PY: { name: 'Paraguay', flag: '🇵🇾' },
  HN: { name: 'Honduras', flag: '🇭🇳' },
  SV: { name: 'El Salvador', flag: '🇸🇻' },
  NI: { name: 'Nicaragua', flag: '🇳🇮' },
  PA: { name: 'Panamá', flag: '🇵🇦' }
};

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const pin = searchParams.get('pin') || request.headers.get('x-admin-pin');

  if (pin !== ADMIN_PIN) {
    return NextResponse.json({ error: 'PIN de acceso incorrecto' }, { status: 401 });
  }

  const db = loadAnalytics();
  const now = Date.now();

  // 1. Usuarios activos en vivo (últimos 2 minutos)
  global._activeSessions = global._activeSessions || new Map();
  const activeList = [];
  for (const [key, session] of global._activeSessions.entries()) {
    if (now - session.lastSeen <= 120000) {
      activeList.push(session);
    } else {
      global._activeSessions.delete(key);
    }
  }

  const onlineNow = activeList.length;

  // 2. Visitas hoy y ayer
  const todayKey = getTodayKey();
  const yesterdayKey = getYesterdayKey();

  const todayData = db.daily[todayKey] || { views: 0, plays: 0, devices: {}, countries: {} };
  const yesterdayData = db.daily[yesterdayKey] || { views: 0, plays: 0, devices: {}, countries: {} };

  // 3. Visitas últimos 7 días
  let weekVisits = 0;
  const last7Days = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const k = d.toISOString().split('T')[0];
    const dayViews = (db.daily[k] && db.daily[k].views) || 0;
    weekVisits += dayViews;
    last7Days.push({
      date: k,
      label: d.toLocaleDateString('es-PE', { weekday: 'short', day: 'numeric' }),
      views: dayViews
    });
  }

  // 4. Top Contenido más reproducido
  const topContent = Object.entries(db.plays || {})
    .map(([title, item]) => ({
      title,
      count: item.count || 0,
      type: item.type || 'pelicula'
    }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 10);

  // 5. Distribución de Dispositivos (Acumulado)
  const deviceTotals = { 'Móvil': 0, 'Computadora': 0, 'Smart TV': 0, 'Tablet': 0 };
  Object.values(db.daily || {}).forEach(day => {
    if (day.devices) {
      Object.entries(day.devices).forEach(([dev, count]) => {
        if (deviceTotals[dev] !== undefined) {
          deviceTotals[dev] += count;
        } else {
          deviceTotals[dev] = count;
        }
      });
    }
  });

  const totalDev = Object.values(deviceTotals).reduce((a, b) => a + b, 0) || 1;
  const devices = Object.entries(deviceTotals).map(([name, count]) => ({
    name,
    count,
    percentage: Math.round((count / totalDev) * 100)
  }));

  // 6. Ranking de Países
  const countryTotals = {};
  Object.values(db.daily || {}).forEach(day => {
    if (day.countries) {
      Object.entries(day.countries).forEach(([code, count]) => {
        countryTotals[code] = (countryTotals[code] || 0) + count;
      });
    }
  });

  const totalCountriesCount = Object.values(countryTotals).reduce((a, b) => a + b, 0) || 1;
  const countries = Object.entries(countryTotals)
    .map(([code, count]) => {
      const info = COUNTRY_NAMES[code] || { name: code, flag: '🌐' };
      return {
        code,
        name: info.name,
        flag: info.flag,
        count,
        percentage: Math.round((count / totalCountriesCount) * 100)
      };
    })
    .sort((a, b) => b.count - a.count)
    .slice(0, 10);

  // 7. Eventos recientes
  const recentActivity = (global._recentEvents || []).slice(0, 20);

  return NextResponse.json({
    onlineNow,
    todayVisits: todayData.views,
    todayPlays: todayData.plays || 0,
    yesterdayVisits: yesterdayData.views,
    weekVisits,
    totalVisits: Math.max(db.totalVisits || 0, todayData.views),
    last7Days,
    topContent,
    devices,
    countries,
    recentActivity,
    serverTime: new Date().toLocaleTimeString('es-PE')
  });
}
