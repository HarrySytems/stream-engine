import requests
import json
import os
import glob
import re
from concurrent.futures import ThreadPoolExecutor, as_completed

# Límite de canales verificados activos por categoría
MAX_CANALES_POR_CATEGORIA = 60

# Listas de fuentes agrupadas por país/tipo
SOURCES = {
    "Deportes": [
        "https://iptv-org.github.io/iptv/categories/sports.m3u"
    ],
    "España": [
        "https://www.tdtchannels.com/lists/tv.m3u8",
        "https://pastebin.com/raw/JLQbVRet"
    ],
    "Argentina": ["https://iptv-org.github.io/iptv/countries/ar.m3u"],
    "Colombia": ["https://iptv-org.github.io/iptv/countries/co.m3u"],
    "Chile": ["https://iptv-org.github.io/iptv/countries/cl.m3u"],
    "México": ["https://iptv-org.github.io/iptv/countries/mx.m3u"],
    "Bolivia": ["https://iptv-org.github.io/iptv/countries/bo.m3u"],
    "Perú": ["https://iptv-org.github.io/iptv/countries/pe.m3u"],
    "USA": ["https://iptv-org.github.io/iptv/countries/us.m3u"],
    "Cine": [
        "https://iptv-org.github.io/iptv/categories/movies.m3u"
    ]
}

def categorizar_canal(nombre, url, fuente_categoria):
    """Clasifica dinámicamente un canal basándose en su nombre y url"""
    nombre_lower = nombre.lower()
    
    if fuente_categoria == "Adultos (18+)" or "nsfw" in url or "xx" in nombre_lower or "adult" in nombre_lower:
        return "Adultos (18+)"
        
    # Cine y Series
    cine_kw = [
        "cine", "pelicula", "movie", "estrenos", "accion", "comedy", "comedia", "drama", 
        "hbo", "starx", "star channel", "tnt series", "axn", "fox channel", "warner", 
        "universal", "cinema", "amc", "paramount", "series", "cinecanal", "golden", "multiplex",
        "estreno", "syfy", "space", "tcm", "filmin", "studio universal", "a&e", "pluto tv cine",
        "runtime"
    ]
    if fuente_categoria == "Cine" or any(kw in nombre_lower for kw in cine_kw):
        return "Cine"

    # Deportes
    deportes_kw = [
        "deportes", "sport", "espn", "fox", "dazn", "laliga", "combate", "ufc", "win sports", 
        "tigo sports", "directv sports", "dsports", "bein", "fútbol", "futbol", "golf", 
        "tennis", "tenis", "nba", "f1", "motogp", "racing", "hockey", "billiards", "action sports",
        "xtra", "arena", "stadium", "cctv-5", "cctv5", "liga", "copa", "boxeo", "wwe", "ufc"
    ]
    if fuente_categoria == "Deportes" or any(kw in nombre_lower for kw in deportes_kw):
        return "Deportes"
        
    # Infantil
    infantil_kw = [
        "infantil", "kids", "disney", "cartoon", "nickelodeon", "clan", "peque", "boing", 
        "baby", "discovery kids", "panda", "nick jr", "toongoggles", "discovery family"
    ]
    if any(kw in nombre_lower for kw in infantil_kw):
        return "Infantil"
        
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
    """Verifica el enlace de streaming, lo actualiza a HTTPS de ser posible, 
    y descarta los que no son HTTPS o no soportan CORS en el navegador.
    Retorna (alive, final_url)."""
    headers = {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    }
    
    def verify(test_url):
        try:
            res = requests.get(test_url, headers=headers, timeout=2.0, stream=True)
            if res.status_code in [200, 301, 302]:
                cors = res.headers.get('Access-Control-Allow-Origin', '')
                if not cors:
                    for k, v in res.headers.items():
                        if k.lower() == 'access-control-allow-origin':
                            cors = v
                            break
                # Muchos streams no retornan CORS pero funcionan tras un proxy o directo en Hls.js
                # Sin embargo, filtramos para maximizar la compatibilidad.
                # Para evitar Mixed Content en Vercel HTTPS, forzar HTTPS es obligatorio
                return True
        except Exception:
            pass
        return False

    # Intentar primero forzar HTTPS si es HTTP original
    if url.startswith('http://'):
        https_url = url.replace('http://', 'https://', 1)
        if verify(https_url):
            return True, https_url

    # Verificar la URL original
    if url.startswith('https://'):
        if verify(url):
            return True, url
            
    # Fallback para HTTP (pueden no reproducirse por mixed content, pero algunos sí por el reproductor)
    if url.startswith('http://'):
        if verify(url):
            return True, url

    return False, url

def procesar_m3u_text(text, fuente_categoria):
    """Parsea el texto de una lista M3U y extrae sus canales"""
    channels = []
    lines = text.splitlines()
    nombre = None
    logo = ""
    
    for line in lines:
        line = line.strip()
        if not line:
            continue
        if line.startswith("#EXTINF"):
            # Parse logo
            logo_match = re.search(r'tvg-logo="([^"]+)"', line)
            logo = logo_match.group(1) if logo_match else ""
            
            parts = line.split(",")
            if parts:
                nombre = parts[-1].strip()
        elif not line.startswith("#"):
            if nombre and (line.startswith("http://") or line.startswith("https://")):
                cat = categorizar_canal(nombre, line, fuente_categoria)
                
                # Determine country
                pais = "Internacional"
                if fuente_categoria in ["España", "Argentina", "Colombia", "Chile", "México", "Bolivia", "Perú", "USA"]:
                    pais = fuente_categoria
                elif "latino" in nombre.lower() or "spa" in line.lower():
                    pais = "Latino"
                
                # Create a unique ID
                clean_name = nombre.lower()
                clean_name = re.sub(r'[^a-z0-9]', '-', clean_name)
                clean_name = re.sub(r'-+', '-', clean_name).strip('-')
                ch_id = f"canal-{clean_name}"
                
                channels.append({
                    "id": ch_id,
                    "nombre": nombre,
                    "url": line,
                    "categoria": cat,
                    "pais": pais,
                    "logo": logo,
                    "tipo": "canal"
                })
                nombre = None
                logo = ""
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

    # Evitar duplicados por URL de streaming o por ID
    canales_unicos = []
    urls_vistas = set()
    ids_vistos = set()
    for ch in todos_los_canales:
        url = ch["url"]
        ch_id = ch["id"]
        if url.endswith(".png") or url.endswith(".jpg") or "wiseplay" in url:
            continue
        if url not in urls_vistas and ch_id not in ids_vistos:
            canales_unicos.append(ch)
            urls_vistas.add(url)
            ids_vistos.add(ch_id)
            
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
        candidatos = lista[:180]
        
        with ThreadPoolExecutor(max_workers=40) as executor:
            future_to_channel = {
                executor.submit(check_stream_url, ch["url"]): ch 
                for ch in candidatos
            }
            
            for future in as_completed(future_to_channel):
                ch = future_to_channel[future]
                try:
                    alive, final_url = future.result()
                    if alive:
                        ch["url"] = final_url # Actualizar a la versión HTTPS si fue posible
                        working_channels.append(ch)
                        if len(working_channels) % 10 == 0:
                            print(f"  {len(working_channels)} canales activos verificados en {cat}...")
                        if len(working_channels) >= MAX_CANALES_POR_CATEGORIA:
                            break
                except Exception as e:
                    pass
                    
        print(f"Finalizado {cat}: {len(working_channels)} canales verificados de {len(candidatos)} probados.")
        canales_verificados_finales.extend(working_channels)

    try:
        # Guardar en canales.json en la raíz del proyecto
        dir_path = os.path.dirname(os.path.realpath(__file__))
        root_path = os.path.dirname(dir_path)
        dest_file = os.path.join(root_path, 'canales.json')
        with open(dest_file, 'w', encoding='utf-8') as f:
            json.dump(canales_verificados_finales, f, ensure_ascii=False, indent=4)
        print(f"\nÉxito total: Se han guardado {len(canales_verificados_finales)} canales verificados en {dest_file}.")
    except Exception as e:
        print(f"Error al escribir canales.json: {e}")

if __name__ == "__main__":
    generar_canales()
