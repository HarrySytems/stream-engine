import fs from 'fs';
import path from 'path';

export default function Home() {
  // Leemos el archivo JSON que tu robot genera
  const filePath = path.join(process.cwd(), 'canales.json');
  const fileData = fs.readFileSync(filePath, 'utf-8');
  const canales = JSON.parse(fileData);

  return (
    <main style={{ padding: '20px', textAlign: 'center', backgroundColor: '#0f0f0f', color: 'white', minHeight: '100vh' }}>
      <h1>Streaming en Vivo</h1>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '15px', marginTop: '20px' }}>
        {canales.map((canal, index) => (
          <a 
            key={index} 
            href={canal.url} 
            target="_blank" 
            style={{ 
              padding: '15px', 
              border: '1px solid #333', 
              borderRadius: '8px', 
              textDecoration: 'none', 
              color: '#00ff41',
              fontWeight: 'bold'
            }}
          >
            {canal.nombre}
          </a>
        ))}
      </div>
    </main>
  );
}
