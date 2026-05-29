import fs from 'fs';
import path from 'path';
import StreamPage from './StreamPage';

export const dynamic = 'force-dynamic';

export default async function Home() {
  const filePath = path.join(process.cwd(), 'peliculas.json');
  const fileData = fs.readFileSync(filePath, 'utf-8');
  const peliculas = JSON.parse(fileData);

  return <StreamPage initialPeliculas={peliculas} />;
}
