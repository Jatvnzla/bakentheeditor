import requests
import json

# URL del servidor local
url = "http://127.0.0.1:5000/download_best"

# URL de YouTube para probar
youtube_url = "https://www.youtube.com/watch?v=_oF-XcramiE"  # Reemplaza con una URL válida

# Datos para la solicitud
data = {
    "url": youtube_url,
    "direct_blob": False  # False para recibir JSON en lugar del archivo directamente
}

# Realizar la solicitud
print(f"Enviando solicitud para descargar: {youtube_url}")
response = requests.post(url, json=data)

# Verificar la respuesta
if response.status_code == 200:
    print("Descarga exitosa!")
    print(json.dumps(response.json(), indent=2))
else:
    print(f"Error: {response.status_code}")
    print(response.text)
