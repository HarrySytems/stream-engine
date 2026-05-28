import requests
import json
import os
import glob
from concurrent.futures import ThreadPoolExecutor, as_completed

# Lista de fuentes públicas de IPTV agrupadas por categoría
SOURCES = {
    "Deportes": "https://iptv-org.github.io/iptv/categories/sports.m3u",
    "España": "https://www.tdtchannels.com/lists/tv.m3u8",
    "Argentina": "https://iptv-org.github.io/iptv/countries/ar.m3u",
    "Colombia": "https://iptv-org.github.io/iptv/countries/co.m3u",
    "Chile": "https://iptv-org.github.io/iptv/countries/cl.m3u",
    "México": "https://iptv-org.github.io/iptv/countries/mx.m3u",
    "Bolivia": "https://iptv-org.github.io/iptv/countries/bo.m3u",
    "Latino": "https://iptv-org.github.io/iptv/languages/spa.m3u",
    "Adultos (18+)": "https://iptv-org.github.io/iptv/index.nsfw.m3u"
}

# Límite de canales por categoría para evitar lentitud en la web
MAX_CANALES_POR_CATEGORIA = 60

def is_link_alive(url):
    """Verifica de forma rápida si un enlace de streaming responde correctamente"""
    try:
        headers = {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
        }
        # stream=True descarga solo las cabeceras (headers) para máxima velocidad
        response = requests.get(url, headers=headers, timeout=3, stream=True)
        return response.status_code in [200, 301, 302]
    except Exception:
        return False

def procesar_m3u_text(text, categoria):
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
                channels.append({
                    "nombre": nombre,
                    "url": line,
                    "categoria": categoria
                })
                nombre = None
    return channels

def generar_canales():
    canales_agrupados = {}
    
    # 1. PROCESAR FUENTES ONLINE
    for categoria, url_fuente in SOURCES.items():
        try:
            print(f"Descargando fuente: {categoria} ({url_fuente})")
            response = requests.get(url_fuente, timeout=20)
            if response.status_code != 200:
                print(f"Error {response.status_code} al descargar de {url_fuente}")
                continue
                
            canales_categoria = procesar_m3u_text(response.text, categoria)
            print(f"Encontrados {len(canales_categoria)} canales potenciales en {categoria}")
            
            # Verificar canales en paralelo
            print(f"Verificando enlaces activos para {categoria}...")
            working_channels = []
            
            # Usar ThreadPoolExecutor para verificar enlaces de forma concurrente
            with ThreadPoolExecutor(max_workers=20) as executor:
                # Mapear URLs a futures
                future_to_channel = {
                    executor.submit(is_link_alive, ch["url"]): ch 
                    for ch in canales_categoria[:200]  # Limitar a los primeros 200 para no saturar la verificación
                }
                
                for future in as_completed(future_to_channel):
                    ch = future_to_channel[future]
                    try:
                        alive = future.result()
                        if alive:
                            working_channels.append(ch)
                            if len(working_channels) >= MAX_CANALES_POR_CATEGORIA:
                                break
                    except Exception as e:
                        print(f"Error al verificar {ch['nombre']}: {e}")
            
            canales_agrupados[categoria] = working_channels
            print(f"Completado {categoria}: {len(working_channels)} canales verificados activos.")
            
        except Exception as e:
            print(f"Error procesando fuente {categoria}: {e}")

    # 2. PROCESAR FUENTES LOCALES (Archivos .m3u en carpeta python)
    dir_path = os.path.dirname(os.path.realpath(__file__))
    local_files = glob.glob(os.path.join(dir_path, "*.m3u"))
    
    local_channels = []
    for file_path in local_files:
        try:
            nombre_archivo = os.path.basename(file_path)
            print(f"Procesando archivo local: {nombre_archivo}")
            
            with open(file_path, 'r', encoding='utf-8', errors='ignore') as f:
                content = f.read()
            
            channels = procesar_m3u_text(content, "Deportes")
            local_channels.extend(channels)
        except Exception as e:
            print(f"Error procesando archivo local {file_path}: {e}")
            
    if local_channels:
        print(f"Verificando {len(local_channels)} canales locales...")
        working_locals = []
        with ThreadPoolExecutor(max_workers=20) as executor:
            future_to_local = {executor.submit(is_link_alive, ch["url"]): ch for ch in local_channels[:150]}
            for future in as_completed(future_to_local):
                ch = future_to_local[future]
                if future.result():
                    working_locals.append(ch)
                    if len(working_locals) >= MAX_CANALES_POR_CATEGORIA:
                        break
        
        # Combinar canales locales verificados en la categoría Deportes
        if "Deportes" not in canales_agrupados:
            canales_agrupados["Deportes"] = []
        
        # Evitar duplicados por URL
        urls_existentes = {c["url"] for c in canales_agrupados["Deportes"]}
        for ch in working_locals:
            if ch["url"] not in urls_existentes:
                canales_agrupados["Deportes"].append(ch)
                urls_existentes.add(ch["url"])

    # Aplanar el diccionario de categorías a una lista única para guardar en canales.json
    lista_final = []
    for categoria, canales in canales_agrupados.items():
        lista_final.extend(canales)

    try:
        # Guardar en canales.json en la raíz del proyecto
        with open('canales.json', 'w', encoding='utf-8') as f:
            json.dump(lista_final, f, ensure_ascii=False, indent=4)
        print(f"Éxito total: Se han verificado y guardado {len(lista_final)} canales en canales.json.")
    except Exception as e:
        print(f"Error al escribir canales.json: {e}")

if __name__ == "__main__":
    generar_canales()
