import requests
import json
import os
import glob
import re
from concurrent.futures import ThreadPoolExecutor, as_completed

# Límite de canales verificados activos por categoría para otros países
MAX_CANALES_POR_CATEGORIA = 150

# Listas de fuentes agrupadas por país/tipo
SOURCES = {
    "Deportes": [
        "https://iptv-org.github.io/iptv/categories/sports.m3u"
    ],
    "España": [
        "https://iptv-org.github.io/iptv/countries/es.m3u",
        "https://www.tdtchannels.com/lists/tv.m3u8"
    ],
    "Argentina": ["https://iptv-org.github.io/iptv/countries/ar.m3u"],
    "Colombia": ["https://iptv-org.github.io/iptv/countries/co.m3u"],
    "Chile": ["https://iptv-org.github.io/iptv/countries/cl.m3u"],
    "México": ["https://iptv-org.github.io/iptv/countries/mx.m3u"],
    "Bolivia": ["https://iptv-org.github.io/iptv/countries/bo.m3u"],
    "Perú": ["https://iptv-org.github.io/iptv/countries/pe.m3u"],
    "Uruguay": ["https://iptv-org.github.io/iptv/countries/uy.m3u"],
    "USA": ["https://iptv-org.github.io/iptv/countries/us.m3u"],
    "Cine": [
        "https://iptv-org.github.io/iptv/categories/movies.m3u"
    ],
    "Latino": [
        "https://iptv-org.github.io/iptv/languages/spa.m3u"
    ]
}

COUNTRY_MAP = {
    "pe": "Perú",
    "mx": "México",
    "cl": "Chile",
    "co": "Colombia",
    "es": "España",
    "ar": "Argentina",
    "uy": "Uruguay",
    "bo": "Bolivia",
    "us": "EE.UU."
}

# CDNs conocidos de streaming que soportan CORS por defecto en el navegador
CORS_SUPPORTING_CDNS = [
    '.cloudfront.net', '.rudo.video', '.rtve.es', '.iblups.com', '.smartbit.co', 
    '.mediaserver.digital', '.vtrplay.com', '.logicahost.com', '.opencaster.com', 
    '.streamlock.net', '.cdnz.cl', '.akamai', '.fastly', '.cloudflare', '.google', 
    '.cdn77.org', '.servers10.com', '.bozztv.com', '.lhdserver.es', '.egostreaming.pe', 
    '.innovatestream.pe', '.ondadigital.pe', '.obslivestream.com', '.panel.host-live.com', 
    '.tvdatta.com', '.chasquirouter.com', '.cef-technology.com', '.ecuamedia.net', 
    '.makrodigital.com', '.dps.live', '.streambrothers.com', 'airspace-cdn', 'qaotic.net',
    'cooks.fyi'
]

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
        "runtime", "blockbuster"
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
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Origin': 'https://stream-engine-alpha.vercel.app'
    }
    
    def verify(test_url):
        # Vercel es estrictamente HTTPS. Bloquear Mixed Content HTTP
        if not test_url.startswith('https://'):
            return False
            
        has_cdn_support = any(cdn in test_url.lower() for cdn in CORS_SUPPORTING_CDNS)
            
        try:
            res = requests.get(test_url, headers=headers, timeout=2.0, stream=True)
            if res.status_code in [200, 301, 302]:
                cors = res.headers.get('Access-Control-Allow-Origin', '')
                if not cors:
                    for k, v in res.headers.items():
                        if k.lower() == 'access-control-allow-origin':
                            cors = v
                            break
                            
                if cors == '*' or cors or has_cdn_support:
                    return True
        except Exception:
            pass
        return False

    # Intentar primero HTTPS si es HTTP original
    if url.startswith('http://'):
        https_url = url.replace('http://', 'https://', 1)
        if verify(https_url):
            return True, https_url
        return False, url

    if url.startswith('https://'):
        if verify(url):
            return True, url

    return False, url

def check_stream_url_lenient(url):
    """Verifica de forma laxa si el enlace responde (acepta HTTP o HTTPS). Retorna (alive, final_url)."""
    headers = {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    }
    
    # Intentar verificar el URL tal cual (HTTP o HTTPS)
    try:
        res = requests.get(url, headers=headers, timeout=2.0, stream=True)
        if res.status_code in [200, 301, 302, 403]:
            return True, url
    except Exception:
        try:
            res = requests.head(url, headers=headers, timeout=2.0)
            if res.status_code in [200, 301, 302, 403]:
                return True, url
        except Exception:
            pass
            
    # Si es HTTP y falló, intentar con HTTPS por si acaso
    if url.startswith('http://'):
        https_url = url.replace('http://', 'https://', 1)
        try:
            res = requests.get(https_url, headers=headers, timeout=2.0, stream=True)
            if res.status_code in [200, 301, 302, 403]:
                return True, https_url
        except Exception:
            pass
            
    return False, url

def procesar_m3u_text(text, fuente_categoria):
    """Parsea el texto de una lista M3U y extrae sus canales"""
    channels = []
    lines = text.splitlines()
    nombre = None
    logo = ""
    country_code = ""
    group_title = ""
    
    for line in lines:
        line = line.strip()
        if not line:
            continue
        if line.startswith("#EXTINF"):
            # Parse logo
            logo_match = re.search(r'tvg-logo="([^"]+)"', line)
            logo = logo_match.group(1) if logo_match else ""
            
            # Parse group-title
            group_match = re.search(r'group-title="([^"]+)"', line)
            group_title = group_match.group(1).lower() if group_match else ""
            
            # Parse country code
            country_code = ""
            country_match = re.search(r'tvg-country="([^"]+)"', line)
            if country_match:
                country_code = country_match.group(1).lower()
            else:
                # Fallback to tvg-id suffix
                id_match = re.search(r'tvg-id="([^"]+)"', line)
                if id_match:
                    tvg_id = id_match.group(1)
                    suffix_match = re.search(r'\.([a-zA-Z]{2})@', tvg_id)
                    if suffix_match:
                        country_code = suffix_match.group(1).lower()
            
            parts = line.split(",")
            if parts:
                nombre = parts[-1].strip()
        elif not line.startswith("#"):
            if nombre and (line.startswith("http://") or line.startswith("https://")):
                cat = categorizar_canal(nombre, line, fuente_categoria)
                
                # Determine country
                pais = "Internacional"
                if fuente_categoria in COUNTRY_MAP.values():
                    pais = fuente_categoria
                elif country_code in COUNTRY_MAP:
                    pais = COUNTRY_MAP[country_code]
                
                # Check group-title
                if pais == "Internacional" and group_title:
                    for p_clave in ["perú", "colombia", "españa", "argentina", "chile", "méxico", "uruguay", "bolivia", "ee.uu."]:
                        if p_clave in group_title:
                            if p_clave == "perú": pais = "Perú"
                            elif p_clave == "colombia": pais = "Colombia"
                            elif p_clave == "españa": pais = "España"
                            elif p_clave == "argentina": pais = "Argentina"
                            elif p_clave == "chile": pais = "Chile"
                            elif p_clave == "méxico": pais = "México"
                            elif p_clave == "uruguay": pais = "Uruguay"
                            elif p_clave == "bolivia": pais = "Bolivia"
                            elif p_clave == "ee.uu.": pais = "EE.UU."
                            break
                            
                # Fallback based on name or URL keywords
                if pais == "Internacional":
                    name_lower = nombre.lower()
                    url_lower = line.lower()
                    
                    if "peru" in name_lower or "perú" in name_lower or "willax" in name_lower or "latina" in name_lower or "panamericana" in name_lower or "atv" in name_lower or "america tv" in name_lower or "américa tv" in name_lower:
                        if not any(other in name_lower for other in ["argentina", "andorra", "spain", "españa", "chile", "ecuador", "colombia", "mexico", "méxico"]):
                            pais = "Perú"
                    elif "argentina" in name_lower or "telefe" in name_lower or "eltrece" in name_lower:
                        if not any(other in name_lower for other in ["peru", "perú", "chile", "colombia", "mexico", "méxico"]):
                            pais = "Argentina"
                    elif "colombia" in name_lower or "caracol" in name_lower or "rcn" in name_lower:
                        if not any(other in name_lower for other in ["peru", "perú", "chile", "argentina", "mexico", "méxico"]):
                            pais = "Colombia"
                    elif "chile" in name_lower or "chilevision" in name_lower or "mega hd" in name_lower or "mega tv" in name_lower:
                        if not any(other in name_lower for other in ["peru", "perú", "colombia", "argentina", "mexico", "méxico"]):
                            pais = "Chile"
                    elif "mexico" in name_lower or "méxico" in name_lower or "tv azteca" in name_lower or "las estrellas" in name_lower or "canal 5" in name_lower or "amx noticias" in name_lower:
                        if not any(other in name_lower for other in ["peru", "perú", "chile", "colombia", "argentina"]):
                            pais = "México"
                    elif "uruguay" in name_lower:
                        pais = "Uruguay"
                    elif "españa" in name_lower or "spain" in name_lower or "rtve" in name_lower or "telecinco" in name_lower or "antena 3" in name_lower or "cuatro" in name_lower or "lasexta" in name_lower:
                        if not any(other in name_lower for other in ["peru", "perú", "chile", "colombia", "argentina", "mexico", "méxico"]):
                            pais = "España"
                    elif "bolivia" in name_lower:
                        pais = "Bolivia"
                
                # Fallback to Latino/spa keywords
                if pais == "Internacional" and ("latino" in nombre.lower() or "spa" in line.lower() or "/spa/" in line.lower()):
                    pais = "Latino"
                
                # Clean up name (avoid weird characters in printing)
                nombre_clean = nombre.replace("?", "").replace("", "")
                
                # Create a unique ID
                clean_name = nombre_clean.lower()
                clean_name = re.sub(r'[^a-z0-9]', '-', clean_name)
                clean_name = re.sub(r'-+', '-', clean_name).strip('-')
                ch_id = f"canal-{clean_name}"
                
                channels.append({
                    "id": ch_id,
                    "nombre": nombre_clean,
                    "url": line,
                    "categoria": cat,
                    "pais": pais,
                    "logo": logo,
                    "tipo": "canal"
                })
                nombre = None
                logo = ""
                country_code = ""
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

    # 2. PROCESAR FUENTES LOCALES (M3U locales en la carpeta python)
    dir_path = os.path.dirname(os.path.realpath(__file__))
    local_files = glob.glob(os.path.join(dir_path, "*.m3u"))
    for file_path in local_files:
        try:
            nombre_archivo = os.path.basename(file_path)
            print(f"Procesando archivo local: {nombre_archivo}")
            with open(file_path, 'r', encoding='utf-8', errors='ignore') as f:
                content = f.read()
            canales_locales = procesar_m3u_text(content, "Latino")
            print(f"Encontrados {len(canales_locales)} canales locales.")
            todos_los_canales.extend(canales_locales)
        except Exception as e:
            print(f"Error procesando archivo local {file_path}: {e}")

    # Evitar duplicados por URL de streaming o por ID
    canales_unicos = []
    urls_vistas = set()
    ids_vistos = set()
    for ch in todos_los_canales:
        url = ch["url"]
        ch_id = ch["id"]
        if url.endswith(".png") or url.endswith(".jpg") or "wiseplay" in url or "jmp2.uk" in url or "pluto.tv" in url:
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
    paises_clave = ["Perú", "México", "Chile", "Colombia", "España", "Argentina", "Uruguay", "Bolivia"]
    
    for cat, lista in canales_por_categoria.items():
        print(f"\nVerificando enlaces activos para la categoría: {cat} (Total candidatos: {len(lista)})")
        working_channels = []
        
        # Priorizar canales de países clave colocándolos al principio
        lista_ordenada = sorted(
            lista,
            key=lambda ch: ch.get("pais") in paises_clave,
            reverse=True
        )
        
        # Separar canales clave y no clave para procesar
        canales_clave = [c for c in lista_ordenada if c.get("pais") in paises_clave]
        canales_no_clave = [c for c in lista_ordenada if c.get("pais") not in paises_clave]
        
        # 1. Procesar todos los canales clave verificándolos concurrentemente de forma laxa
        print(f"  Verificando {len(canales_clave)} canales de países clave...")
        with ThreadPoolExecutor(max_workers=35) as executor:
            future_to_channel = {
                executor.submit(check_stream_url_lenient, ch["url"]): ch 
                for ch in canales_clave
            }
            for future in as_completed(future_to_channel):
                ch = future_to_channel[future]
                try:
                    alive, final_url = future.result()
                    if alive:
                        ch["url"] = final_url
                        working_channels.append(ch)
                except Exception:
                    pass
            
        # 2. Procesar los canales no clave con verificación concurrente amplia
        print(f"  Verificando candidatos no clave...")
        candidatos_no_clave = canales_no_clave[:400]
        
        with ThreadPoolExecutor(max_workers=50) as executor:
            future_to_channel = {
                executor.submit(check_stream_url, ch["url"]): ch 
                for ch in candidatos_no_clave
            }
            
            for future in as_completed(future_to_channel):
                ch = future_to_channel[future]
                try:
                    alive, final_url = future.result()
                    if alive:
                        ch["url"] = final_url
                        non_clave_count = sum(1 for w in working_channels if w.get("pais") not in paises_clave)
                        if non_clave_count < MAX_CANALES_POR_CATEGORIA:
                            working_channels.append(ch)
                except Exception as e:
                    pass
                    
        print(f"Finalizado {cat}: {len(working_channels)} canales guardados.")
        canales_verificados_finales.extend(working_channels)

    try:
        # Guardar en canales.json en la raíz del proyecto
        root_path = os.path.dirname(dir_path)
        dest_file = os.path.join(root_path, 'canales.json')
        with open(dest_file, 'w', encoding='utf-8') as f:
            json.dump(canales_verificados_finales, f, ensure_ascii=False, indent=4)
        print(f"\nÉxito total: Se han guardado {len(canales_verificados_finales)} canales verificados en {dest_file}.")
    except Exception as e:
        print(f"Error al escribir canales.json: {e}")

if __name__ == "__main__":
    generar_canales()
