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
    37: "Western"
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
    print("Iniciando búsqueda de estrenos en TMDB (2025 - 2026)...")
    raw_movies = []
    seen_ids = set()

    endpoints = [
        # 1. En Cartelera (Now Playing)
        (f"{BASE_URL}/movie/now_playing", {"page": 1, "language": "es-MX", "api_key": TMDB_API_KEY}),
        (f"{BASE_URL}/movie/now_playing", {"page": 2, "language": "es-MX", "api_key": TMDB_API_KEY}),
        # 2. Tendencias de la Semana (Trending)
        (f"{BASE_URL}/trending/movie/week", {"language": "es-MX", "api_key": TMDB_API_KEY}),
        # 3. Estrenos 2026 por Popularidad
        (f"{BASE_URL}/discover/movie", {
            "api_key": TMDB_API_KEY,
            "language": "es-MX",
            "sort_by": "popularity.desc",
            "primary_release_year": 2026,
            "page": 1
        }),
        # 4. Estrenos 2025 por Popularidad
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

    for url, params in endpoints:
        data = fetch_json(url, params)
        if data and "results" in data:
            for item in data["results"]:
                tmdb_id = item.get("id")
                if not tmdb_id or tmdb_id in seen_ids:
                    continue

                poster_path = item.get("poster_path")
                title = item.get("title") or item.get("original_title")
                overview = item.get("overview", "")
                release_date = item.get("release_date", "")
                year = release_date.split("-")[0] if release_date else "2025"

                # Filtrar items sin póster o muy antiguos
                if not poster_path or not title:
                    continue
                if year not in ["2025", "2026"]:
                    continue

                seen_ids.add(tmdb_id)
                rating = round(item.get("vote_average", 0), 1)

                movie_obj = {
                    "id": f"movie-{tmdb_id}",
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
                raw_movies.append(movie_obj)
        time.sleep(0.3)

    print(f"Total de estrenos recolectados: {len(raw_movies)}")

    if len(raw_movies) > 0:
        # Guardar en estrenos.json en la raíz
        target_path = os.path.join(os.path.dirname(os.path.dirname(__file__)), "estrenos.json")
        with open(target_path, "w", encoding="utf-8") as f:
            json.dump(raw_movies, f, ensure_ascii=False, indent=2)
        print(f"Guardado exitosamente en: {target_path}")
    else:
        print("No se encontraron nuevos estrenos para guardar.")

if __name__ == "__main__":
    scrape_estrenos()
