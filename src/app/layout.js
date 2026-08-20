import './globals.css';

export const metadata = {
  title: 'FilmTV - TV en Vivo, Películas y Series en Streaming Gratis',
  description: 'Disfruta de televisión en vivo gratis, canales TDT, películas de cartelera y series completas en alta definición con el estilo FAST streaming moderno.',
  keywords: 'streaming, tv en vivo, peliculas gratis, series online, fast tv, pluto style, hls',
  authors: [{ name: 'FilmTV' }],
  themeColor: '#08080a',
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
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&family=Outfit:wght@400;600;700;900&display=swap"
          rel="stylesheet"
        />
      </head>
      <body style={{ margin: 0, backgroundColor: '#08080a', color: '#ffffff' }}>
        {children}
      </body>
    </html>
  );
}
