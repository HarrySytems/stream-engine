import fs from 'fs';
import path from 'path';
import StreamPage from './StreamPage';

export const dynamic = 'force-dynamic';

export default async function Home() {
  const filePeliculasPath = path.join(process.cwd(), 'peliculas.json');
  const filePeliculasData = fs.readFileSync(filePeliculasPath, 'utf-8');
  const peliculas = JSON.parse(filePeliculasData);

  let canales = [];
  try {
    const fileCanalesPath = path.join(process.cwd(), 'canales.json');
    const fileCanalesData = fs.readFileSync(fileCanalesPath, 'utf-8');
    canales = JSON.parse(fileCanalesData);
  } catch (error) {
    console.error("Error reading canales.json:", error);
  }

  return <StreamPage initialPeliculas={peliculas} initialCanales={canales} />;
}
