import './globals.css';

export const metadata = {
  title: 'FilmTV - Películas y Series en Streaming Gratis',
  description: 'Disfruta de tus películas y series favoritas en alta definición, con múltiples servidores de reproducción, sin costo y con chat en vivo integrado.',
};

export const viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export default function RootLayout({ children }) {
  return (
    <html lang="es">
      <body style={{ margin: 0, backgroundColor: '#070707', color: '#ffffff' }}>
        {children}
      </body>
    </html>
  );
}
