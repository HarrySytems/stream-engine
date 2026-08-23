import requests
import json
import re
import os

M3U_URL = "https://raw.githubusercontent.com/NOVAPSNew/Novaps/main/tv.m3u"

def clean_channel_name(name):
    if not name:
        return ""
    name = re.sub(r'^[*\s\d._-]+', '', name)
    return name.strip()

def detect_category(name, group_title):
    name_upper = name.upper()
    group_upper = group_title.upper() if group_title else ""

    if any(k in name_upper for k in ['CARTOON', 'DISNEY', 'NICK', 'BOOMERANG', 'TOON', 'BABY', 'KIDS', 'JUNIOR']):
        return "Infantiles"
    if any(k in name_upper for k in ['HISTORY', 'DISCOVERY', 'ANIMAL PLANET', 'NAT GEO', 'NATIONAL GEOGRAPHIC', 'INVESTIGATION', 'ID']):
        return "Documentales"
    if any(k in name_upper for k in ['ESPN', 'FOX SPORTS', 'DSPORTS', 'DIRECTV', 'GOL', 'DEPOR', 'TUDN', 'TYC', 'WIN']):
        return "Deportes"
    if any(k in name_upper for k in ['AMC', 'AXN', 'TNT', 'SPACE', 'CINECANAL', 'UNIVERSAL', 'WARNER', 'SONY', 'FX', 'HBO', 'PARAMOUNT', 'CINEMAX', 'STUDIO', 'GOLDEN', 'STAR', 'MULTIPREMIER', 'DE PELICULA']):
        return "Cine y Series"
    if any(k in name_upper for k in ['MTV', 'TELEHIT', 'BANDAMAX', 'RITMOSON', 'VH1', 'MUSIC']):
        return "Música"
    if any(k in name_upper for k in ['NOTICIAS', 'NEWS', 'CNN', 'BBC', 'RT', '24H', 'INFO']):
        return "Noticias"
    
    return "Variedades"

def scrape_tvcable():
    print("Descargando lista M3U de TV Cable...")
    headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
    }
    try:
        res = requests.get(M3U_URL, headers=headers, timeout=20)
        if res.status_code != 200:
            print(f"Error HTTP {res.status_code}")
            return
        content = res.text
    except Exception as e:
        print(f"Error al descargar M3U: {e}")
        return

    lines = content.splitlines()
    channels = []
    seen_urls = set()
    current_meta = {}

    for line in lines:
        line = line.strip()
        if not line:
            continue

        if line.startswith("#EXTINF:"):
            # Extraer tvg-logo
            logo_match = re.search(r'tvg-logo="([^"]+)"', line)
            logo = logo_match.group(1) if logo_match else ""

            # Extraer group-title
            group_match = re.search(r'group-title="([^"]+)"', line)
            group_title = group_match.group(1) if group_match else ""

            # Extraer nombre (después de la última coma)
            comma_idx = line.rfind(',')
            raw_name = line[comma_idx + 1:].strip() if comma_idx != -1 else ""
            clean_name = clean_channel_name(raw_name)

            current_meta = {
                "nombre": clean_name or raw_name or "Canal Cable",
                "logo": logo,
                "group_title": group_title
            }
        elif line.startswith("http://") or line.startswith("https://"):
            url = line
            if url in seen_urls:
                continue
            seen_urls.add(url)

            name = current_meta.get("nombre", "Canal Cable")
            logo = current_meta.get("logo", "")
            group_title = current_meta.get("group_title", "")
            category = detect_category(name, group_title)

            slug_id = re.sub(r'[^\w\s-]', '', name.lower()).strip().replace(' ', '-')

            channel_obj = {
                "id": f"cable-{slug_id}-{len(channels)}",
                "nombre": name,
                "tipo": "canal",
                "url": url,
                "categoria": category,
                "pais": "TV Cable",
                "logo": logo or "https://images.unsplash.com/photo-1522869635100-9f4c5e86aa37?auto=format&fit=crop&w=400&q=80",
                "descripcion": f"Transmisión en vivo de {name} por TV Cable."
            }
            channels.append(channel_obj)
            current_meta = {}

    print(f"Total de canales de cable procesados: {len(channels)}")

    if len(channels) > 0:
        target_path = os.path.join(os.path.dirname(os.path.dirname(__file__)), "tvcable.json")
        with open(target_path, "w", encoding="utf-8") as f:
            json.dump(channels, f, ensure_ascii=False, indent=2)
        print(f"Guardado exitosamente en: {target_path}")

if __name__ == "__main__":
    scrape_tvcable()
