import requests
import json

# Lista de fuentes públicas de iptv-org
# 1. spa.m3u: Canales de todo el mundo transmitidos en idioma español
# 2. sports.m3u: Canales de deportes globales (muchos transmiten fútbol)
SOURCES = [
    "https://iptv-org.github.io/iptv/languages/spa.m3u",
    "https://iptv-org.github.io/iptv/categories/sports.m3u"
]

def generar_canales():
    canales_unicos = {}
    
    for url_fuente in SOURCES:
        try:
            print(f"Descargando fuente: {url_fuente}")
            response = requests.get(url_fuente, timeout=20)
            if response.status_code != 200:
                print(f"Error {response.status_code} al descargar de {url_fuente}")
                continue
                
            lines = response.text.splitlines()
            nombre = None
            
            # Procesador robusto de listas M3U
            for line in lines:
                line = line.strip()
                if not line:
                    continue
                if line.startswith("#EXTINF"):
                    # Extraer el nombre (lo que va después de la última coma)
                    parts = line.split(",")
                    if parts:
                        nombre = parts[-1].strip()
                elif not line.startswith("#"):
                    # Es la URL del canal
                    if nombre and (line.startswith("http://") or line.startswith("https://")):
                        # Guardar usando el nombre como clave para evitar duplicados entre listas
                        canales_unicos[nombre] = line
                        nombre = None
            
        except Exception as e:
            print(f"Error procesando {url_fuente}: {e}")

    # Convertir el diccionario a la estructura JSON final
    lista_canales = [{"nombre": nombre, "url": url} for nombre, url in canales_unicos.items()]
    
    try:
        # Guardar en canales.json en la raíz del proyecto
        with open('canales.json', 'w', encoding='utf-8') as f:
            json.dump(lista_canales, f, ensure_ascii=False, indent=4)
        print(f"Éxito: Se han procesado y guardado {len(lista_canales)} canales en español y deportes.")
    except Exception as e:
        print(f"Error al escribir canales.json: {e}")

if __name__ == "__main__":
    generar_canales()
