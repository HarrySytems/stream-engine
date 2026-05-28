import fs from 'fs';
import path from 'path';
import StreamPage from './StreamPage';

export const dynamic = 'force-dynamic'; // Desactivar caché estática para que siempre busque la agenda en vivo

async function getLiveAgenda() {
  try {
    // Obtenemos la agenda real en vivo de Fútbol Libre en tiempo real
    const res = await fetch('https://pltvhd.com/diaries.json', { 
      cache: 'no-store', // No almacenar en caché para tener los partidos reales al segundo
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      }
    });
    if (!res.ok) throw new Error(`HTTP error ${res.status}`);
    const json = await res.json();
    return json.data || [];
  } catch (err) {
    console.error("Error al obtener la agenda de futbol libre:", err);
    return [];
  }
}

export default async function Home() {
  // Leemos los canales 24/7 de canales.json
  const filePath = path.join(process.cwd(), 'canales.json');
  const fileData = fs.readFileSync(filePath, 'utf-8');
  const canales = JSON.parse(fileData);

  // Obtenemos la agenda real en vivo
  const agendaReal = await getLiveAgenda();

  return <StreamPage initialCanales={canales} liveAgenda={agendaReal} />;
}
