import fs from 'fs';
import path from 'path';
import StreamPage from './StreamPage';

export default function Home() {
  // Leemos el archivo JSON que tu robot genera
  const filePath = path.join(process.cwd(), 'canales.json');
  const fileData = fs.readFileSync(filePath, 'utf-8');
  const canales = JSON.parse(fileData);

  return <StreamPage initialCanales={canales} />;
}
