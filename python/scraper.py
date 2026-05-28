import requests
import json

# URL oficial de la lista de deportes de iptv-org
SOURCE_URL = "https://iptv-org.github.io/iptv/categories/sports.m3u"

def generar_canales():
    try:
        response = requests.get(SOURCE_URL, timeout=15)
        lines = response.text.splitlines()
        canales = []
        
        # Procesamiento simple y ultra rápido
        for i in range(len(lines)):
            if lines[i].startswith("#EXTINF"):
                nombre = lines[i].split(",")[-1]
                # La URL siempre está en la línea siguiente al #EXTINF
                if i + 1 < len(lines):
                    url = lines[i+1]
                    canales.append({"nombre": nombre, "url": url})
        
        # Guardar el resultado en canales.json
        with open('canales.json', 'w', encoding='utf-8') as f:
            json.dump(canales, f, ensure_ascii=False, indent=4)
            
        print(f"Éxito: {len(canales)} canales procesados.")
    except Exception as e:
        print(f"Error en la ingesta: {e}")

if __name__ == "__main__":
    generar_canales()
