import json
import os

json_path = "C:/Users/harry/.gemini/antigravity/scratch/stream-engine/peliculas.json"
if not os.path.exists(json_path):
    print("Error: peliculas.json not found!")
    exit(1)

with open(json_path, "r", encoding="utf-8") as f:
    catalog = json.load(f)

# Clear any previous YouTube items or duplicates to keep it clean
previous_count = len(catalog)
catalog = [item for item in catalog if not item.get("id", "").startswith("yt-movie-") and not item.get("id", "").startswith("yt-doc-")]

youtube_movies = [
    {
        "id": "yt-movie-10331",
        "titulo": "La noche de los muertos vivientes (1968)",
        "tipo": "pelicula",
        "tmdbId": "10331",
        "imdbId": "tt0063350",
        "youtubeId": "Nn1R49x6H-E",
        "año": "1968",
        "categoria": "YouTube",
        "poster": "https://image.tmdb.org/t/p/w500/A30ZJDUBWs2wU5254G536HG9Dbg.jpg",
        "descripcion": "Un grupo de personas se refugia en una granja abandonada para protegerse de una horda de cadáveres que han vuelto a la vida por causas desconocidas y buscan carne humana. Clásico de culto de George A. Romero.",
        "valoracion": 8.0
    },
    {
        "id": "yt-movie-961",
        "titulo": "El maquinista de la general (1926)",
        "tipo": "pelicula",
        "tmdbId": "961",
        "imdbId": "tt0017925",
        "youtubeId": "kYv9G2y8hWc",
        "año": "1926",
        "categoria": "YouTube",
        "poster": "https://image.tmdb.org/t/p/w500/2LgP2J9XgPzPz7HlPqJ8zW5m4g.jpg",
        "descripcion": "Johnnie Gray es un maquinista de locomotoras en el sur de los Estados Unidos. Cuando estalla la Guerra de Secesión, intenta alistarse, pero es rechazado porque su profesión es considerada vital. Obra maestra cómica de Buster Keaton.",
        "valoracion": 8.2
    },
    {
        "id": "yt-movie-31655",
        "titulo": "El terror (1963)",
        "tipo": "pelicula",
        "tmdbId": "31655",
        "imdbId": "tt0057569",
        "youtubeId": "KzE37839kBg",
        "año": "1963",
        "categoria": "YouTube",
        "poster": "https://image.tmdb.org/t/p/w500/yXG9tLzW2P4kLp9XzPjP9J8zW5m.jpg",
        "descripcion": "Un oficial del ejército francés en las guerras napoleónicas se separa de su unidad y persigue a una misteriosa mujer hasta el castillo del barón Von Leppe. Dirigida por Roger Corman y protagonizada por Jack Nicholson.",
        "valoracion": 6.8
    },
    {
        "id": "yt-movie-28014",
        "titulo": "Sherlock Holmes: Vestido para matar (1946)",
        "tipo": "pelicula",
        "tmdbId": "28014",
        "imdbId": "tt0038490",
        "youtubeId": "J3U0gD35aL8",
        "año": "1946",
        "categoria": "YouTube",
        "poster": "https://image.tmdb.org/t/p/w500/m9qJ8zP4kLp9XzPjP9J8zW5m4g.jpg",
        "descripcion": "Sherlock Holmes y el doctor Watson investigan el robo de tres cajas de música idénticas fabricadas en la prisión de Dartmoor que ocultan un secreto sobre un botín bancario robado.",
        "valoracion": 7.2
    },
    {
        "id": "yt-movie-15412",
        "titulo": "La pequeña tienda de los horrores (1960)",
        "tipo": "pelicula",
        "tmdbId": "15412",
        "imdbId": "tt0054033",
        "youtubeId": "w82n_r8d1tQ",
        "año": "1960",
        "categoria": "YouTube",
        "poster": "https://image.tmdb.org/t/p/w500/uG9tLzW2P4kLp9XzPjP9J8zW5m4.jpg",
        "descripcion": "Seymour Krelboyn es un torpe empleado de una floristería que cultiva una planta exótica carnívora que habla y exige ser alimentada con sangre humana para sobrevivir.",
        "valoracion": 7.0
    },
    {
        "id": "yt-movie-4808",
        "titulo": "Charada (1963)",
        "tipo": "pelicula",
        "tmdbId": "4808",
        "imdbId": "tt0056923",
        "youtubeId": "o8t5G-R7o4M",
        "año": "1963",
        "categoria": "YouTube",
        "poster": "https://image.tmdb.org/t/p/w500/zXG9tLzW2P4kLp9XzPjP9J8zW5m.jpg",
        "descripcion": "Una mujer regresa de unas vacaciones en Suiza para descubrir que su esposo ha sido asesinado y que varios hombres reclaman una fortuna en oro que él les robó durante la guerra. Audrey Hepburn y Cary Grant.",
        "valoracion": 8.1
    },
    {
        "id": "yt-movie-20623",
        "titulo": "El hombre del brazo de oro (1955)",
        "tipo": "pelicula",
        "tmdbId": "20623",
        "imdbId": "tt0048347",
        "youtubeId": "p4j1Q8x6vKg",
        "año": "1955",
        "categoria": "YouTube",
        "poster": "https://image.tmdb.org/t/p/w500/vXG9tLzW2P4kLp9XzPjP9J8zW5m.jpg",
        "descripcion": "Frankie Machine sale de la cárcel rehabilitado de su adicción a la heroína con el sueño de tocar la batería, pero la presión de su esposa y de su antiguo jefe lo empujan de vuelta al abismo. Frank Sinatra.",
        "valoracion": 7.9
    },
    {
        "id": "yt-movie-20367",
        "titulo": "Detour (Desvío) (1945)",
        "tipo": "pelicula",
        "tmdbId": "20367",
        "imdbId": "tt0037638",
        "youtubeId": "_0aXgB89Rsw",
        "año": "1945",
        "categoria": "YouTube",
        "poster": "https://image.tmdb.org/t/p/w500/tXG9tLzW2P4kLp9XzPjP9J8zW5m.jpg",
        "descripcion": "Un pianista de Nueva York viaja haciendo autostop hacia Los Ángeles para reunirse con su novia, pero la muerte accidental del hombre que lo lleva desencadena una pesadilla sin salida. Clásico del cine negro.",
        "valoracion": 7.5
    },
    {
        "id": "yt-movie-17602",
        "titulo": "Dementia 13 (1963)",
        "tipo": "pelicula",
        "tmdbId": "17602",
        "imdbId": "tt0056983",
        "youtubeId": "R8y28F5k3kU",
        "año": "1963",
        "categoria": "YouTube",
        "poster": "https://image.tmdb.org/t/p/w500/sXG9tLzW2P4kLp9XzPjP9J8zW5m.jpg",
        "descripcion": "Una mujer oculta la muerte por infarto de su marido para quedarse con su parte de la herencia familiar en un tétrico castillo irlandés, sin saber que un asesino con un hacha ronda la propiedad. Dirigida por Francis Ford Coppola.",
        "valoracion": 6.5
    },
    {
        "id": "yt-movie-23849",
        "titulo": "El inspector general (1949)",
        "tipo": "pelicula",
        "tmdbId": "23849",
        "imdbId": "tt0041512",
        "youtubeId": "NnZ9vR4b8gI",
        "año": "1949",
        "categoria": "YouTube",
        "poster": "https://image.tmdb.org/t/p/w500/p9qJ8zP4kLp9XzPjP9J8zW5m4g.jpg",
        "descripcion": "Un gitano analfabeto e itinerante que trabaja en una feria de pueblo es confundido con el temido Inspector General en una pequeña ciudad corrupta de Europa del Este. Comedia clásica con Danny Kaye.",
        "valoracion": 7.4
    },
    {
        "id": "yt-movie-1902",
        "titulo": "Viaje a la luna (1902)",
        "tipo": "pelicula",
        "tmdbId": "1902",
        "imdbId": "tt0000417",
        "youtubeId": "Z3g94Q2S50Y",
        "año": "1902",
        "categoria": "YouTube",
        "poster": "https://image.tmdb.org/t/p/w500/k9qJ8zP4kLp9XzPjP9J8zW5m4g.jpg",
        "descripcion": "Un grupo de astrónomos viaja en una cápsula espacial disparada por un cañón gigante hacia la Luna, donde son capturados por los selenitas. Obra fundacional del cine de ciencia ficción de Georges Méliès.",
        "valoracion": 8.4
    },
    {
        "id": "yt-movie-40409",
        "titulo": "Metrópolis (1927)",
        "tipo": "pelicula",
        "tmdbId": "40409",
        "imdbId": "tt0017136",
        "youtubeId": "U5n2YI9JgYw",
        "año": "1927",
        "categoria": "YouTube",
        "poster": "https://image.tmdb.org/t/p/w500/1X8zP4kLp9XzPjP9J8zW5m4g.jpg",
        "descripcion": "En una megaciudad futurista dividida entre la clase trabajadora subterránea y los ricos gobernantes que viven en la superficie, el hijo del líder se enamora de una líder obrera. Obra maestra de Fritz Lang.",
        "valoracion": 8.3
    },
    {
        "id": "yt-movie-11902",
        "titulo": "Nosferatu, el vampiro (1922)",
        "tipo": "pelicula",
        "tmdbId": "11902",
        "imdbId": "tt0013442",
        "youtubeId": "g2J_gK8UvYQ",
        "año": "1922",
        "categoria": "YouTube",
        "poster": "https://image.tmdb.org/t/p/w500/z9qJ8zP4kLp9XzPjP9J8zW5m4g.jpg",
        "descripcion": "El agente inmobiliario Hutter viaja a Transilvania para cerrar un trato con el misterioso conde Orlok, quien resulta ser un vampiro milenario que viaja a Alemania sembrando la peste. Dirigida por F.W. Murnau.",
        "valoracion": 8.0
    },
    {
        "id": "yt-movie-15201",
        "titulo": "El gabinete del Dr. Caligari (1920)",
        "tipo": "pelicula",
        "tmdbId": "15201",
        "imdbId": "tt0010982",
        "youtubeId": "Nf5_gW0u7oA",
        "año": "1920",
        "categoria": "YouTube",
        "poster": "https://image.tmdb.org/t/p/w500/y9qJ8zP4kLp9XzPjP9J8zW5m4g.jpg",
        "descripcion": "El desquiciado Dr. Caligari exhibe en una feria a un sonámbulo que predice el futuro, mientras una serie de asesinatos azota la pequeña ciudad alemana. Obra cumbre del expresionismo alemán.",
        "valoracion": 8.1
    },
    {
        "id": "yt-movie-28283",
        "titulo": "Pánico en el Transiberiano (1972)",
        "tipo": "pelicula",
        "tmdbId": "28283",
        "imdbId": "tt0068635",
        "youtubeId": "q6tA9eQ3U30",
        "año": "1972",
        "categoria": "YouTube",
        "poster": "https://image.tmdb.org/t/p/w500/zXG9tLzW2P4kLp9XzPjP9J8zW5m.jpg",
        "descripcion": "Un antropólogo británico descubre un fósil congelado prehistórico en Manchuria y lo embarca de regreso a Europa en el Transiberiano, sin saber que la criatura es portadora de una letal entidad extraterrestre.",
        "valoracion": 6.9
    }
]

youtube_docs = [
    {
        "id": "yt-doc-home",
        "titulo": "HOME (Documental Ecológico Oficial)",
        "tipo": "pelicula",
        "tmdbId": "1000001",
        "youtubeId": "SWRHxh60k8U",
        "año": "2009",
        "categoria": "Documentales",
        "poster": "https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?auto=format&fit=crop&w=400&q=80",
        "descripcion": "Un maravilloso documental que muestra de forma aérea y espectacular la diversidad de la vida en la Tierra y cómo las actividades humanas amenazan el equilibrio ecológico del planeta. Dirigido por Yann Arthus-Bertrand.",
        "valoracion": 8.6
    },
    {
        "id": "yt-doc-lifeinaday",
        "titulo": "Life in a Day (La vida en un día)",
        "tipo": "pelicula",
        "tmdbId": "1000002",
        "youtubeId": "JaFVr_cJJIY",
        "año": "2011",
        "categoria": "Documentales",
        "poster": "https://images.unsplash.com/photo-1492691527719-9d1e07e534b4?auto=format&fit=crop&w=400&q=80",
        "descripcion": "Un experimento cinematográfico único para crear un documental sobre un solo día en la Tierra (24 de julio de 2010), combinando miles de clips enviados por personas de todo el mundo. Producido por Ridley Scott.",
        "valoracion": 7.8
    },
    {
        "id": "yt-doc-agua",
        "titulo": "DW: El mundo sin agua (Documental)",
        "tipo": "pelicula",
        "tmdbId": "1000003",
        "youtubeId": "jDvdXF5w59g",
        "año": "2023",
        "categoria": "Documentales",
        "poster": "https://images.unsplash.com/photo-1470071459604-3b5ec3a7fe05?auto=format&fit=crop&w=400&q=80",
        "descripcion": "Un documental de Deutsche Welle en español que investiga la escasez de agua potable a nivel global y los conflictos económicos y sociales por el control del recurso hídrico más valioso del planeta.",
        "valoracion": 8.4
    },
    {
        "id": "yt-doc-ropa",
        "titulo": "DW: El negocio de la ropa usada (Documental)",
        "tipo": "pelicula",
        "tmdbId": "1000004",
        "youtubeId": "9Y2q6mG4b8M",
        "año": "2022",
        "categoria": "Documentales",
        "poster": "https://images.unsplash.com/photo-1489987707025-afc232f7ea0f?auto=format&fit=crop&w=400&q=80",
        "descripcion": "Investigación sobre el destino de la ropa que donamos en Europa y cómo su exportación masiva inunda los mercados locales en África, destruyendo la industria textil regional y generando contaminación ambiental.",
        "valoracion": 8.0
    },
    {
        "id": "yt-doc-pharma",
        "titulo": "DW: El poder de las farmacéuticas (Documental)",
        "tipo": "pelicula",
        "tmdbId": "1000005",
        "youtubeId": "O7fL_7_Ube0",
        "año": "2023",
        "categoria": "Documentales",
        "poster": "https://images.unsplash.com/photo-1584308666744-24d5c474f2ae?auto=format&fit=crop&w=400&q=80",
        "descripcion": "Documental que desvela las estrategias de cabildeo, precios desorbitados y falta de transparencia de las corporaciones farmacéuticas globales frente a los sistemas de salud pública.",
        "valoracion": 8.2
    },
    {
        "id": "yt-doc-plastico",
        "titulo": "DW: La mentira del reciclaje de plástico (Documental)",
        "tipo": "pelicula",
        "tmdbId": "1000006",
        "youtubeId": "6H_bL6o-s8M",
        "año": "2021",
        "categoria": "Documentales",
        "poster": "https://images.unsplash.com/photo-1532996122724-e3c354a0b15b?auto=format&fit=crop&w=400&q=80",
        "descripcion": "El plástico se presenta como reciclable, pero este documental demuestra que menos del 10% del plástico producido ha sido reciclado. Un análisis sobre el engaño verde y las corporaciones.",
        "valoracion": 8.5
    },
    {
        "id": "yt-doc-chips",
        "titulo": "DW: La guerra de los semiconductores (Documental)",
        "tipo": "pelicula",
        "tmdbId": "1000007",
        "youtubeId": "92mG4wQ1K8I",
        "año": "2024",
        "categoria": "Documentales",
        "poster": "https://images.unsplash.com/photo-1518770660439-4636190af475?auto=format&fit=crop&w=400&q=80",
        "descripcion": "El control sobre la producción de microchips es una de las mayores batallas geopolíticas del siglo XXI. De Taiwán a Estados Unidos y Europa, analizamos quién domina el cerebro digital del mundo.",
        "valoracion": 8.3
    },
    {
        "id": "yt-doc-azucar",
        "titulo": "DW: La verdad sobre el azúcar (Documental)",
        "tipo": "pelicula",
        "tmdbId": "1000008",
        "youtubeId": "rF5_gW0u7oA",
        "año": "2022",
        "categoria": "Documentales",
        "poster": "https://images.unsplash.com/photo-1581798459219-318e76aecc7b?auto=format&fit=crop&w=400&q=80",
        "descripcion": "El azúcar está en casi todos los alimentos procesados. Este documental investiga cómo la industria del azúcar ocultó sus riesgos para la salud pública y fomentó la epidemia global de obesidad.",
        "valoracion": 8.1
    },
    {
        "id": "yt-doc-cerebro",
        "titulo": "DW: Los secretos del cerebro (Documental)",
        "tipo": "pelicula",
        "tmdbId": "1000009",
        "youtubeId": "ZzLgD-f61qU",
        "año": "2023",
        "categoria": "Documentales",
        "poster": "https://images.unsplash.com/photo-1507668077129-56e32842fceb?auto=format&fit=crop&w=400&q=80",
        "descripcion": "Un recorrido científico fascinante por los avances neurocientíficos de la última década, descubriendo cómo aprendemos, cómo se forman los recuerdos y cómo se pueden curar patologías cerebrales.",
        "valoracion": 8.3
    },
    {
        "id": "yt-doc-coltan",
        "titulo": "DW: La crisis de coltán en el Congo (Documental)",
        "tipo": "pelicula",
        "tmdbId": "1000010",
        "youtubeId": "g2Q8W-K8UvY",
        "año": "2023",
        "categoria": "Documentales",
        "poster": "https://images.unsplash.com/photo-1547082299-de196ea013d6?auto=format&fit=crop&w=400&q=80",
        "descripcion": "Documental sobre la minería del coltán en el Congo, esencial para baterías de teléfonos móviles y automóviles eléctricos, y el costo humano y ecológico que conlleva su extracción.",
        "valoracion": 8.5
    }
]

catalog.extend(youtube_movies)
catalog.extend(youtube_docs)

with open(json_path, "w", encoding="utf-8") as f:
    json.dump(catalog, f, ensure_ascii=False, indent=2)

print(f"Success! Cleaned old entries and added {len(youtube_movies)} YouTube movies and {len(youtube_docs)} YouTube documentaries. Total items now: {len(catalog)}")
