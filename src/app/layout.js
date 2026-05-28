export const metadata = {
  title: 'TV FREE - Televisión en Vivo Gratis',
  description: 'Ver televisión en vivo gratis, canales de deportes y TDT de España y Latinoamérica sin anuncios invasivos.',
};

export default function RootLayout({ children }) {
  return (
    <html lang="es">
      <body style={{ margin: 0, backgroundColor: '#0f0f0f' }}>
        {children}
      </body>
    </html>
  );
}
