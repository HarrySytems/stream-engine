export default function RootLayout({ children }) {
  return (
    <html lang="es">
      <body style={{ margin: 0, backgroundColor: '#0f0f0f' }}>
        {children}
      </body>
    </html>
  );
}
