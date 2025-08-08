import requests
import os
import json
import logging
import tempfile
import uuid
import subprocess
from urllib.parse import urlparse, parse_qs

# Configurar logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Configuración de la API
RAPIDAPI_KEY = "41d50df29fmsh8a887ef309a4c4fp16c293jsn1ddc0f3e51a4"
RAPIDAPI_HOST = "yt-api.p.rapidapi.com"

def extract_video_id(url):
    """Extrae el ID del video de una URL de YouTube."""
    try:
        parsed_url = urlparse(url)
        if parsed_url.netloc == 'youtu.be':
            return parsed_url.path[1:]
        if parsed_url.netloc in ('www.youtube.com', 'youtube.com'):
            if parsed_url.path == '/watch':
                return parse_qs(parsed_url.query)['v'][0]
            if parsed_url.path.startswith('/embed/'):
                return parsed_url.path.split('/')[2]
            if parsed_url.path.startswith('/v/'):
                return parsed_url.path.split('/')[2]
        # Si llegamos aquí, la URL no es una URL de YouTube válida
        return None
    except Exception as e:
        logger.error(f"Error al extraer ID del video: {str(e)}")
        return None

def get_video_info(video_id):
    """Obtiene información del video usando la API de RapidAPI."""
    logger.info(f"Obteniendo información para el video ID: {video_id}")
    
    url = f"https://yt-api.p.rapidapi.com/dl?id={video_id}"
    
    headers = {
        "X-RapidAPI-Key": RAPIDAPI_KEY,
        "X-RapidAPI-Host": RAPIDAPI_HOST
    }
    
    try:
        response = requests.get(url, headers=headers)
        response.raise_for_status()  # Lanzar excepción si hay error HTTP
        
        data = response.json()
        logger.info(f"Información del video obtenida exitosamente: {data.get('title')}")
        return data
    except requests.exceptions.RequestException as e:
        logger.error(f"Error al obtener información del video: {str(e)}")
        if hasattr(e, 'response') and e.response is not None:
            logger.error(f"Respuesta de error: {e.response.text}")
        raise

def download_video_from_url(video_url, output_path):
    """Descarga un video desde una URL directa."""
    logger.info(f"Descargando video desde URL: {video_url}")
    
    try:
        response = requests.get(video_url, stream=True)
        response.raise_for_status()
        
        # Guardar el archivo
        with open(output_path, 'wb') as f:
            for chunk in response.iter_content(chunk_size=8192):
                f.write(chunk)
        
        # Verificar que el archivo se descargó correctamente
        if os.path.exists(output_path) and os.path.getsize(output_path) > 0:
            logger.info(f"Video descargado exitosamente en: {output_path}")
            return True
        else:
            logger.error(f"El archivo descargado está vacío o no existe: {output_path}")
            return False
    except Exception as e:
        logger.error(f"Error al descargar el video: {str(e)}")
        return False

def download_best_quality(youtube_url, temp_dir=None):
    """Descarga el video en la mejor calidad disponible."""
    if temp_dir is None:
        temp_dir = tempfile.mkdtemp()
        logger.info(f"Directorio temporal creado: {temp_dir}")
    
    try:
        # Extraer el ID del video
        video_id = extract_video_id(youtube_url)
        if not video_id:
            logger.error(f"No se pudo extraer el ID del video de la URL: {youtube_url}")
            return None, "No se pudo extraer el ID del video"
        
        # Obtener información del video
        video_info = get_video_info(video_id)
        
        # Obtener el título del video
        title = video_info.get('title', f"video_{uuid.uuid4()}")
        sanitized_title = "".join([c for c in title if c.isalpha() or c.isdigit() or c==' ']).rstrip()
        
        # Buscar el formato con la mejor calidad
        formats = video_info.get('formats', [])
        adaptive_formats = video_info.get('adaptiveFormats', [])
        
        # Primero intentar con formatos progresivos (que ya incluyen audio y video)
        if formats:
            # Ordenar por calidad (mayor resolución primero)
            formats_with_resolution = []
            for fmt in formats:
                height = fmt.get('height', 0)
                quality_label = fmt.get('qualityLabel', '')
                if height > 0:
                    formats_with_resolution.append((fmt, height))
                elif quality_label:
                    # Extraer la resolución del qualityLabel (ej: "720p" -> 720)
                    try:
                        res = int(quality_label.replace('p', ''))
                        formats_with_resolution.append((fmt, res))
                    except ValueError:
                        formats_with_resolution.append((fmt, 0))
                else:
                    formats_with_resolution.append((fmt, 0))
            
            # Ordenar por resolución (mayor a menor)
            formats_with_resolution.sort(key=lambda x: x[1], reverse=True)
            
            logger.info(f"Formatos progresivos disponibles: {[(f[1], f[0].get('qualityLabel')) for f in formats_with_resolution]}")
            
            # Tomar el formato con mayor resolución
            best_format = formats_with_resolution[0][0]
            
            # Descargar el video
            output_filename = f"{sanitized_title}_{uuid.uuid4()}.mp4"
            output_path = os.path.join(temp_dir, output_filename)
            
            success = download_video_from_url(best_format.get('url'), output_path)
            if success:
                return output_path, title
        
        # Si no hay formatos progresivos o falló la descarga, intentar con formatos adaptativos
        if adaptive_formats:
            # Buscar el mejor formato de video y audio
            video_formats = [f for f in adaptive_formats if 'video' in f.get('mimeType', '')]
            audio_formats = [f for f in adaptive_formats if 'audio' in f.get('mimeType', '')]
            
            if video_formats and audio_formats:
                # Ordenar por resolución (mayor a menor)
                video_formats.sort(key=lambda x: int(x.get('height', 0)), reverse=True)
                audio_formats.sort(key=lambda x: int(x.get('bitrate', 0)), reverse=True)
                
                # Mostrar información sobre los formatos disponibles
                logger.info(f"Formatos de video adaptativos disponibles: {[(f.get('height'), f.get('qualityLabel')) for f in video_formats[:5]]}")
                logger.info(f"Formatos de audio adaptativos disponibles: {[(f.get('bitrate'), f.get('audioQuality')) for f in audio_formats[:3]]}")
                
                best_video = video_formats[0]
                best_audio = audio_formats[0]
                
                logger.info(f"Seleccionado formato de video: {best_video.get('qualityLabel')} ({best_video.get('height')}p)")
                logger.info(f"Seleccionado formato de audio: {best_audio.get('audioQuality')} (bitrate: {best_audio.get('bitrate')})")

                
                # Descargar video y audio
                video_filename = f"video_{uuid.uuid4()}.mp4"
                audio_filename = f"audio_{uuid.uuid4()}.mp4"
                output_filename = f"{sanitized_title}_{uuid.uuid4()}.mp4"
                
                video_path = os.path.join(temp_dir, video_filename)
                audio_path = os.path.join(temp_dir, audio_filename)
                output_path = os.path.join(temp_dir, output_filename)
                
                video_success = download_video_from_url(best_video.get('url'), video_path)
                audio_success = download_video_from_url(best_audio.get('url'), audio_path)
                
                if video_success and audio_success:
                    # Combinar video y audio con ffmpeg
                    logger.info("Combinando video y audio con ffmpeg")
                    ffmpeg_cmd = [
                        'ffmpeg',
                        '-i', video_path,
                        '-i', audio_path,
                        '-c:v', 'copy',
                        '-c:a', 'aac',
                        output_path
                    ]
                    
                    process = subprocess.run(ffmpeg_cmd, capture_output=True, text=True)
                    
                    if process.returncode == 0 and os.path.exists(output_path) and os.path.getsize(output_path) > 0:
                        logger.info(f"Video y audio combinados exitosamente en: {output_path}")
                        return output_path, title
                    else:
                        logger.error(f"Error al combinar video y audio: {process.stderr}")
        
        logger.error("No se pudo encontrar un formato adecuado para descargar")
        return None, "No se pudo encontrar un formato adecuado para descargar"
    
    except Exception as e:
        logger.error(f"Error al descargar el video: {str(e)}")
        return None, str(e)

def download_specific_quality(youtube_url, quality, temp_dir=None):
    """Descarga el video en una calidad específica."""
    if temp_dir is None:
        temp_dir = tempfile.mkdtemp()
        logger.info(f"Directorio temporal creado: {temp_dir}")
    
    try:
        # Extraer el ID del video
        video_id = extract_video_id(youtube_url)
        if not video_id:
            logger.error(f"No se pudo extraer el ID del video de la URL: {youtube_url}")
            return None, "No se pudo extraer el ID del video"
        
        # Obtener información del video
        video_info = get_video_info(video_id)
        
        # Obtener el título del video
        title = video_info.get('title', f"video_{uuid.uuid4()}")
        sanitized_title = "".join([c for c in title if c.isalpha() or c.isdigit() or c==' ']).rstrip()
        
        # Mapear la calidad solicitada a resolución
        quality_map = {
            '144p': 144,
            '240p': 240,
            '360p': 360,
            '480p': 480,
            '720p': 720,
            '1080p': 1080,
            '1440p': 1440,
            '2160p': 2160
        }
        
        target_height = quality_map.get(quality, 360)  # Por defecto 360p si no se reconoce la calidad
        
        # Buscar formatos
        formats = video_info.get('formats', [])
        adaptive_formats = video_info.get('adaptiveFormats', [])
        
        # Primero intentar con formatos progresivos que coincidan con la calidad
        matching_formats = [f for f in formats if f.get('qualityLabel', '') == quality]
        logger.info(f"Formatos progresivos que coinciden con {quality}: {len(matching_formats)}")
        
        if matching_formats:
            best_format = matching_formats[0]
            logger.info(f"Usando formato progresivo: {best_format.get('qualityLabel')} ({best_format.get('height')}p)")

            
            # Descargar el video
            output_filename = f"{sanitized_title}_{quality}_{uuid.uuid4()}.mp4"
            output_path = os.path.join(temp_dir, output_filename)
            
            success = download_video_from_url(best_format.get('url'), output_path)
            if success:
                return output_path, title
        
        # Si no hay formatos progresivos que coincidan, intentar con adaptativos
        if adaptive_formats:
            # Buscar el formato de video más cercano a la calidad solicitada
            video_formats = [f for f in adaptive_formats if 'video' in f.get('mimeType', '')]
            audio_formats = [f for f in adaptive_formats if 'audio' in f.get('mimeType', '')]
            
            # Filtrar por altura cercana a la solicitada
            matching_video_formats = [f for f in video_formats if f.get('height', 0) == target_height]
            if not matching_video_formats and video_formats:
                # Si no hay coincidencia exacta, ordenar por altura y tomar el más cercano
                video_formats.sort(key=lambda x: abs(int(x.get('height', 0)) - target_height))
                matching_video_formats = [video_formats[0]]
            
            if matching_video_formats and audio_formats:
                best_video = matching_video_formats[0]
                # Ordenar audio por bitrate (mayor a menor)
                audio_formats.sort(key=lambda x: int(x.get('bitrate', 0)), reverse=True)
                best_audio = audio_formats[0]
                
                # Descargar video y audio
                video_filename = f"video_{quality}_{uuid.uuid4()}.mp4"
                audio_filename = f"audio_{uuid.uuid4()}.mp4"
                output_filename = f"{sanitized_title}_{quality}_{uuid.uuid4()}.mp4"
                
                video_path = os.path.join(temp_dir, video_filename)
                audio_path = os.path.join(temp_dir, audio_filename)
                output_path = os.path.join(temp_dir, output_filename)
                
                video_success = download_video_from_url(best_video.get('url'), video_path)
                audio_success = download_video_from_url(best_audio.get('url'), audio_path)
                
                if video_success and audio_success:
                    # Combinar video y audio con ffmpeg
                    logger.info("Combinando video y audio con ffmpeg")
                    ffmpeg_cmd = [
                        'ffmpeg',
                        '-i', video_path,
                        '-i', audio_path,
                        '-c:v', 'copy',
                        '-c:a', 'aac',
                        output_path
                    ]
                    
                    process = subprocess.run(ffmpeg_cmd, capture_output=True, text=True)
                    
                    if process.returncode == 0 and os.path.exists(output_path) and os.path.getsize(output_path) > 0:
                        logger.info(f"Video y audio combinados exitosamente en: {output_path}")
                        return output_path, title
                    else:
                        logger.error(f"Error al combinar video y audio: {process.stderr}")
        
        logger.error(f"No se pudo encontrar un formato adecuado para la calidad: {quality}")
        return None, f"No se pudo encontrar un formato adecuado para la calidad: {quality}"
    
    except Exception as e:
        logger.error(f"Error al descargar el video: {str(e)}")
        return None, str(e)
