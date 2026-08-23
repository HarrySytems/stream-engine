import requests
import json
import os
import time

TMDB_API_KEY = "04c35731a5ee918f014970082a0088b1"
BASE_URL = "https://api.themoviedb.org/3"

GENRE_MAP = {
    28: "Acción",
    12: "Aventura",
    16: "Infantil",
    35: "Comedia",
    80: "Crimen",
    99: "Documentales",
    18: "Drama",
    10751: "Infantil",
    14: "Fantasía",
    36: "Historia",
    27: "Terror",
    10402: "Música",
    9648: "Misterio",
    10749: "Romance",
    878: "Ciencia Ficción",
    10770: "Película de TV",
    53: "Suspense",
    10752: "Bélica",
    37: "Western",
    10759: "Acción",
    10762: "Infantil",
    10765: "Ciencia Ficción",
    10768: "Bélica"
}

def get_genre_name(genre_ids):
    if not genre_ids:
        return "Acción"
    for gid in genre_ids:
        if gid in GENRE_MAP:
            return GENRE_MAP[gid]
    return "Acción"

def fetch_json(url, params):
    headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
    }
    try:
        res = requests.get(url, params=params, headers=headers, timeout=15)
        if res.status_code == 200:
            return res.json()
    except Exception as e:
        print(f"Error fetching {url}: {e}")
    return None

def scrape_estrenos():
    print("Iniciando búsqueda de estrenos de películas y series en TMDB (2025 - 2026)...")
    raw_items = []
    seen_ids = set()

    movie_endpoints = [
        (f"{BASE_URL}/movie/now_playing", {"page": 1, "language": "es-MX", "api_key": TMDB_API_KEY}),
        (f"{BASE_URL}/movie/now_playing", {"page": 2, "language": "es-MX", "api_key": TMDB_API_KEY}),
        (f"{BASE_URL}/trending/movie/week", {"language": "es-MX", "api_key": TMDB_API_KEY}),
        (f"{BASE_URL}/discover/movie", {
            "api_key": TMDB_API_KEY,
            "language": "es-MX",
            "sort_by": "popularity.desc",
            "primary_release_year": 2026,
            "page": 1
        }),
        (f"{BASE_URL}/discover/movie", {
            "api_key": TMDB_API_KEY,
            "language": "es-MX",
            "sort_by": "popularity.desc",
            "primary_release_year": 2025,
            "page": 1
        }),
        (f"{BASE_URL}/discover/movie", {
            "api_key": TMDB_API_KEY,
            "language": "es-MX",
            "sort_by": "popularity.desc",
            "primary_release_year": 2025,
            "page": 2
        })
    ]

    tv_endpoints = [
        (f"{BASE_URL}/tv/on_the_air", {"page": 1, "language": "es-MX", "api_key": TMDB_API_KEY}),
        (f"{BASE_URL}/tv/on_the_air", {"page": 2, "language": "es-MX", "api_key": TMDB_API_KEY}),
        (f"{BASE_URL}/trending/tv/week", {"language": "es-MX", "api_key": TMDB_API_KEY}),
        (f"{BASE_URL}/discover/tv", {
            "api_key": TMDB_API_KEY,
            "language": "es-MX",
            "sort_by": "popularity.desc",
            "first_air_date_year": 2026,
            "page": 1
        }),
        (f"{BASE_URL}/discover/tv", {
            "api_key": TMDB_API_KEY,
            "language": "es-MX",
            "sort_by": "popularity.desc",
            "first_air_date_year": 2025,
            "page": 1
        }),
        (f"{BASE_URL}/discover/tv", {
            "api_key": TMDB_API_KEY,
            "language": "es-MX",
            "sort_by": "popularity.desc",
            "first_air_date_year": 2025,
            "page": 2
        })
    ]

    # 1. Películas de estreno
    for url, params in movie_endpoints:
        data = fetch_json(url, params)
        if data and "results" in data:
            for item in data["results"]:
                tmdb_id = item.get("id")
                dedup_key = f"movie-{tmdb_id}"
                if not tmdb_id or dedup_key in seen_ids:
                    continue

                poster_path = item.get("poster_path")
                title = item.get("title") or item.get("original_title")
                overview = item.get("overview", "")
                release_date = item.get("release_date", "")
                year = release_date.split("-")[0] if release_date else "2025"

                if not poster_path or not title:
                    continue
                if year not in ["2025", "2026"]:
                    continue

                seen_ids.add(dedup_key)
                rating = round(item.get("vote_average", 0), 1)

                movie_obj = {
                    "id": dedup_key,
                    "titulo": title.strip(),
                    "tipo": "pelicula",
                    "tmdbId": tmdb_id,
                    "imdbId": "",
                    "descripcion": overview.strip() if overview else f"Ver {title} online en streaming gratis en FilmTV.",
                    "categoria": get_genre_name(item.get("genre_ids")),
                    "poster": f"https://image.tmdb.org/t/p/w500{poster_path}",
                    "año": year,
                    "valoracion": rating if rating > 0 else 7.0,
                    "idioma": "Latino / Sub",
                    "duracion": "N/A"
                }
                raw_items.append(movie_obj)
        time.sleep(0.2)

    # 2. Series de estreno
    for url, params in tv_endpoints:
        data = fetch_json(url, params)
        if data and "results" in data:
            for item in data["results"]:
                tmdb_id = item.get("id")
                dedup_key = f"serie-{tmdb_id}"
                if not tmdb_id or dedup_key in seen_ids:
                    continue

                poster_path = item.get("poster_path")
                title = item.get("name") or item.get("original_name")
                overview = item.get("overview", "")
                first_air_date = item.get("first_air_date", "")
                year = first_air_date.split("-")[0] if first_air_date else "2025"

                if not poster_path or not title:
                    continue
                if year not in ["2025", "2026"]:
                    continue

                seen_ids.add(dedup_key)
                rating = round(item.get("vote_average", 0), 1)

                tv_obj = {
                    "id": dedup_key,
                    "titulo": title.strip(),
                    "tipo": "serie",
                    "tmdbId": tmdb_id,
                    "imdbId": "",
                    "descripcion": overview.strip() if overview else f"Ver serie {title} online en streaming gratis en FilmTV.",
                    "categoria": get_genre_name(item.get("genre_ids")),
                    "poster": f"https://image.tmdb.org/t/p/w500{poster_path}",
                    "año": year,
                    "valoracion": rating if rating > 0 else 7.0,
                    "idioma": "Latino / Sub",
                    "duracion": "N/A"
                }
                raw_items.append(tv_obj)
        time.sleep(0.2)

    print(f"Total de estrenos recolectados (películas y series): {len(raw_items)}")

    if len(raw_items) > 0:
        target_path = os.path.join(os.path.dirname(os.path.dirname(__file__)), "estrenos.json")
        with open(target_path, "w", encoding="utf-8") as f:
            json.dump(raw_items, f, ensure_ascii=False, indent=2)
        print(f"Guardado exitosamente en: {target_path}")
    else:
        print("No se encontraron nuevos estrenos para guardar.")

if __name__ == "__main__":
    scrape_estrenos()
