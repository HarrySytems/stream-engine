import requests
import json
import os
import glob
import re
from concurrent.futures import ThreadPoolExecutor, as_completed

# Límite de canales verificados activos por categoría
MAX_CANALES_POR_CATEGORIA = 150

# Listas de fuentes agrupadas
SOURCES = {
    "Deportes": [
        "https://iptv-org.github.io/iptv/categories/sports.m3u"
    ],
    "España": [
        "https://www.tdtchannels.com/lists/tv.m3u8",
        "https://pastebin.com/raw/JLQbVRet",
        "https://pastebin.com/raw/0C5utBqQ",
        "https://dl.dropbox.com/s/65ywdvzey1b2nkb/1.m3u",
        "https://dl.dropbox.com/s/3dxq5j99l4pch7p/2.m3u",
        "https://dl.dropbox.com/s/pt68czo1e9wknye/4.m3u"
    ],
    "Argentina": ["https://iptv-org.github.io/iptv/countries/ar.m3u"],
    "Colombia": ["https://iptv-org.github.io/iptv/countries/co.m3u"],
    "Chile": ["https://iptv-org.github.io/iptv/countries/cl.m3u"],
    "México": ["https://iptv-org.github.io/iptv/countries/mx.m3u"],
    "Bolivia": ["https://iptv-org.github.io/iptv/countries/bo.m3u"],
    "Latino": [
        "https://iptv-org.github.io/iptv/languages/spa.m3u",
        "http://bit.ly/List11A23adFluxs"
    ],
    "Adultos (18+)": ["https://iptv-org.github.io/iptv/index.nsfw.m3u"]
}

def categorizar_canal(nombre, url, fuente_categoria):
    """Clasifica dinámicamente un canal basándose en su nombre y url"""
    nombre_lower = nombre.lower()
    
    if fuente_categoria == "Adultos (18+)" or "nsfw" in url or "xx" in nombre_lower or "adult" in nombre_lower:
        return "Adultos (18+)"
        
    # Deportes
    deportes_kw = [
        "deportes", "sport", "espn", "fox", "dazn", "laliga", "combate", "ufc", "win sports", 
        "tigo sports", "directv sports", "dsports", "bein", "fútbol", "futbol", "golf", 
        "tennis", "tenis", "nba", "f1", "motogp", "racing", "hockey", "billiards", "action sports",
        "xtra", "arena", "stadium", "cctv-5", "cctv5", "liga", "copa", "boxeo", "wwe", "ufc"
    ]
    if any(kw in nombre_lower for kw in deportes_kw):
        return "Deportes"
        
    # Infantil
    infantil_kw = [
        "infantil", "kids", "disney", "cartoon", "nickelodeon", "clan", "peque", "boing", 
        "baby", "discovery kids", "panda", "nick jr", "toongoggles", "discovery family"
    ]
    if any(kw in nombre_lower for kw in infantil_kw):
        return "Infantil"
        
    # Cine y Series
    cine_kw = [
        "cine", "pelicula", "movie", "estrenos", "accion", "comedy", "comedia", "drama", 
        "hbo", "starx", "star channel", "tnt series", "axn", "fox channel", "warner", 
        "universal", "cinema", "amc", "paramount", "series", "cinecanal", "golden", "multiplex",
        "estreno", "syfy", "space", "tcm", "filmin", "studio universal", "a&e"
    ]
    if any(kw in nombre_lower for kw in cine_kw):
        return "Cine"
        
    # Noticias
    noticias_kw = [
        "noticias", "news", "24h", "cnn", "euronews", "dw", "al jazeera", "telesur", 
        "france 24", "cctv", "prensa", "reuters", "bloomberg", "cnbc", "bbc world"
    ]
    if any(kw in nombre_lower for kw in noticias_kw):
        return "Noticias"
        
    # Música
    musica_kw = [
        "musica", "music", "mtv", "vh1", "trace", "farra", "rock", "beats", "pop", 
        "concert", "cantantes", "radio", "urban", "hits"
    ]
    if any(kw in nombre_lower for kw in musica_kw):
        return "Música"
        
    # Por defecto, TDT / General
    return "TDT / General"

def check_stream_url(url):
    """Verifica el enlace de streaming, lo actualiza a HTTPS de ser posible, y descarta HTTP no seguros.
    Retorna (alive, final_url)."""
    headers = {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    }
    
    # Intentar primero forzar HTTPS si es HTTP original
    if url.startswith('http://'):
        https_url = url.replace('http://', 'https://', 1)
        try:
            response = requests.get(https_url, headers=headers, timeout=2.0, stream=True)
            if response.status_code in [200, 301, 302]:
                return True, https_url
        except Exception:
            pass

    # Verificar la URL original
    try:
        response = requests.get(url, headers=headers, timeout=2.0, stream=True)
        if response.status_code in [200, 301, 302]:
            # Solo permitir enlaces HTTPS seguros para evitar bloqueo de contenido mixto en producción
            if url.startswith('https://'):
                return True, url
    except Exception:
        pass
        
    return False, url

def procesar_m3u_text(text, fuente_categoria):
    """Parsea el texto de una lista M3U y extrae sus canales"""
    channels = []
    lines = text.splitlines()
    nombre = None
    
    for line in lines:
        line = line.strip()
        if not line:
            continue
        if line.startswith("#EXTINF"):
            parts = line.split(",")
            if parts:
                nombre = parts[-1].strip()
        elif not line.startswith("#"):
            if nombre and (line.startswith("http://") or line.startswith("https://")):
                cat = categorizar_canal(nombre, line, fuente_categoria)
                channels.append({
                    "nombre": nombre,
                    "url": line,
                    "categoria": cat
                })
                nombre = None
    return channels

def generar_canales():
    todos_los_canales = []
    
    # 1. PROCESAR FUENTES ONLINE
    for fuente_categoria, urls in SOURCES.items():
        for url_fuente in urls:
            try:
                print(f"Descargando fuente: {fuente_categoria} ({url_fuente})")
                headers = {'User-Agent': 'Mozilla/5.0'}
                response = requests.get(url_fuente, headers=headers, timeout=25)
                if response.status_code != 200:
                    print(f"Error {response.status_code} al descargar de {url_fuente}")
                    continue
                    
                canales_extraidos = procesar_m3u_text(response.text, fuente_categoria)
                print(f"Encontrados {len(canales_extraidos)} canales en esta fuente.")
                todos_los_canales.extend(canales_extraidos)
            except Exception as e:
                print(f"Error procesando fuente {url_fuente}: {e}")

    # 2. PROCESAR FUENTES LOCALES (Archivos .m3u en carpeta python)
    dir_path = os.path.dirname(os.path.realpath(__file__))
    local_files = glob.glob(os.path.join(dir_path, "*.m3u"))
    
    for file_path in local_files:
        try:
            nombre_archivo = os.path.basename(file_path)
            print(f"Procesando archivo local: {nombre_archivo}")
            
            with open(file_path, 'r', encoding='utf-8', errors='ignore') as f:
                content = f.read()
            
            canales_locales = procesar_m3u_text(content, "Deportes")
            print(f"Encontrados {len(canales_locales)} canales locales.")
            todos_los_canales.extend(canales_locales)
        except Exception as e:
            print(f"Error procesando archivo local {file_path}: {e}")

    # Evitar duplicados por URL de streaming
    canales_unicos = []
    urls_vistas = set()
    for ch in todos_los_canales:
        url = ch["url"]
        # Filtrar descargas directas de archivos no de streaming
        if url.endswith(".png") or url.endswith(".jpg") or "wiseplay" in url:
            continue
        if url not in urls_vistas:
            canales_unicos.append(ch)
            urls_vistas.add(url)
            
    print(f"Total canales únicos extraídos: {len(canales_unicos)}")
    
    # Agrupar por categoría final
    canales_por_categoria = {}
    for ch in canales_unicos:
        cat = ch["categoria"]
        if cat not in canales_por_categoria:
            canales_por_categoria[cat] = []
        canales_por_categoria[cat].append(ch)
        
    # Verificar y filtrar canales en paralelo por categoría
    canales_verificados_finales = []
    
    for cat, lista in canales_por_categoria.items():
        print(f"\nVerificando enlaces activos para la categoría: {cat} (Total candidatos: {len(lista)})")
        working_channels = []
        
        # Limitar candidatos a verificar para acelerar el proceso
        candidatos = lista[:300]
        
        with ThreadPoolExecutor(max_workers=30) as executor:
            future_to_channel = {
                executor.submit(check_stream_url, ch["url"]): ch 
                for ch in candidatos
            }
            
            for future in as_completed(future_to_channel):
                ch = future_to_channel[future]
                try:
                    alive, final_url = future.result()
                    if alive:
                        ch["url"] = final_url # Actualizar a la versión HTTPS si fue actualizada
                        working_channels.append(ch)
                        # Mostrar progreso en consola
                        if len(working_channels) % 10 == 0:
                            print(f"  {len(working_channels)} canales activos verificados en {cat}...")
                        if len(working_channels) >= MAX_CANALES_POR_CATEGORIA:
                            break
                except Exception as e:
                    pass
                    
        print(f"Finalizado {cat}: {len(working_channels)} canales verificados y activos de {len(candidatos)} probados.")
        canales_verificados_finales.extend(working_channels)

    try:
        # Guardar en canales.json en la raíz del proyecto
        root_path = os.path.dirname(dir_path)
        dest_file = os.path.join(root_path, 'canales.json')
        with open(dest_file, 'w', encoding='utf-8') as f:
            json.dump(canales_verificados_finales, f, ensure_ascii=False, indent=4)
        print(f"\nÉxito total: Se han guardado {len(canales_verificados_finales)} canales verificados activos en {dest_file}.")
    except Exception as e:
        print(f"Error al escribir canales.json: {e}")

if __name__ == "__main__":
    generar_canales()
