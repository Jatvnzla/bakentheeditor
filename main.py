from flask import Flask, request, jsonify, send_file, Response
from flask_cors import CORS
import os
import tempfile
import shutil
import uuid
import logging
import json
import subprocess
import re
import time
from pytube import YouTube
from pytube.exceptions import PytubeError
from urllib.parse import urlparse, parse_qs
from rapid_api_handler import download_best_quality, download_specific_quality

app = Flask(__name__)

# Habilitar CORS para todas las rutas
CORS(app)

# Configurar logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Funciones auxiliares para descargar videos
def is_valid_youtube_url(url):
    pattern = r"^(https?://)?((www\.)?youtube\.com/watch\?v=[\w-]+|youtu\.be/[\w-]+)(&\S*)?$"
    return re.match(pattern, url) is not None
def download_video(url, resolution):
    try:
        logger.info(f"Intentando descargar video desde: {url} en resolución {resolution}")
        yt = YouTube(url)
        logger.info(f"Título del video: {yt.title}")
        
        # Listar todas las resoluciones disponibles para referencia
        available_resolutions = [stream.resolution for stream in yt.streams.filter(progressive=True, file_extension='mp4')]
        logger.info(f"Resoluciones disponibles: {available_resolutions}")
        
        stream = yt.streams.filter(progressive=True, file_extension='mp4', resolution=resolution).first()
        if stream:
            output_path = os.getcwd()
            logger.info(f"Descargando a: {output_path}")
            stream.download(output_path=output_path)
            return True, None
        else:
            return False, f"Video con resolución {resolution} no encontrado. Resoluciones disponibles: {available_resolutions}"
    except Exception as e:
        logger.error(f"Error al descargar video: {str(e)}")
        return False, str(e)

def get_video_info(url):
    try:
        logger.info(f"Obteniendo información del video desde: {url}")
        yt = YouTube(url)
        stream = yt.streams.first()
        
        # Listar todas las resoluciones disponibles
        available_resolutions = [stream.resolution for stream in yt.streams.filter(progressive=True, file_extension='mp4')]
        
        video_info = {
            "title": yt.title,
            "author": yt.author,
            "length": yt.length,
            "views": yt.views,
            "description": yt.description,
            "publish_date": str(yt.publish_date),  # Convertir a string para asegurar serialización JSON
            "available_resolutions": available_resolutions
        }
        return video_info, None
    except Exception as e:
        logger.error(f"Error al obtener información del video: {str(e)}")
        return None, str(e)

@app.route('/', methods=['GET'])
def index():
    return jsonify({
        "message": "YouTube Video Downloader API",
        "endpoints": [
            {
                "path": "/video_info",
                "method": "POST",
                "description": "Get information about a YouTube video",
                "body": {"url": "YouTube video URL"}
            },
            {
                "path": "/download/<resolution>",
                "method": "POST",
                "description": "Download a YouTube video in specified resolution",
                "body": {"url": "YouTube video URL"},
                "example_resolutions": ["720p", "480p", "360p"]
            },
            {
                "path": "/download_best",
                "method": "POST",
                "description": "Download a YouTube video in the best available quality",
                "body": {"url": "YouTube video URL", "direct_blob": "Boolean (optional)"}
            }
        ]
    })

@app.route('/download_best', methods=['POST', 'OPTIONS'])
def download_best():
    temp_dir = None
    try:
        if request.method == 'OPTIONS':
            return '', 200
        
        data = request.get_json()
        url = data.get('url')
        direct_blob = data.get('direct_blob', False)
        
        if not url:
            return jsonify({"error": "URL no proporcionada"}), 400
        
        logger.info(f"Iniciando descarga para URL: {url}")
        
        # Crear directorio temporal
        temp_dir = tempfile.mkdtemp()
        logger.info(f"Directorio temporal creado: {temp_dir}")
        
        # Intentar primero con la API de RapidAPI
        try:
            logger.info("Usando RapidAPI para descargar el video")
            output_path, title = download_best_quality(url, temp_dir)
            
            if output_path and os.path.exists(output_path) and os.path.getsize(output_path) > 0:
                logger.info(f"Video descargado exitosamente con RapidAPI: {output_path}")
                
                if direct_blob:
                    logger.info("Enviando archivo como blob")
                    return send_file(output_path, mimetype='video/mp4', as_attachment=True, download_name=f"{title}.mp4")
                
                logger.info("Enviando información del video descargado")
                return jsonify({
                    "message": "Video descargado correctamente",
                    "title": title,
                    "path": output_path,
                    "filename": os.path.basename(output_path)
                }), 200
            else:
                logger.warning("Falló la descarga con RapidAPI, intentando con pytube")
        except Exception as e:
            logger.error(f"Error al usar RapidAPI: {str(e)}")
            logger.warning("Intentando con pytube como alternativa")
        
        # Si RapidAPI falla, intentar con pytube como respaldo
        try:
            logger.info("Inicializando objeto YouTube con pytube")
            yt = YouTube(url, use_oauth=False, allow_oauth_cache=False)
        except Exception as e:
            logger.error(f"Error al inicializar YouTube con pytube: {str(e)}")
            return jsonify({"error": f"Error al inicializar YouTube: {str(e)}"}), 500
        
        try:
            logger.info("Obteniendo título del video")
            title = yt.title
            logger.info(f"Título del video: {title}")
        except Exception as e:
            logger.error(f"Error al obtener título: {str(e)}")
            title = f"video_{uuid.uuid4()}"
            logger.info(f"Usando título genérico: {title}")
        
        # Sanitizar el título para usarlo como nombre de archivo
        sanitized_title = "".join([c for c in title if c.isalpha() or c.isdigit() or c==' ']).rstrip()
        output_filename = f"{sanitized_title}.mp4"
        output_path = os.path.join(temp_dir, output_filename)
        
        try:
            logger.info("Buscando streams progresivos")
            stream = yt.streams.filter(progressive=True, file_extension='mp4').order_by('resolution').desc().first()
            logger.info(f"Stream progresivo encontrado: {stream}")
        except Exception as e:
            logger.error(f"Error al obtener streams progresivos: {str(e)}")
            stream = None
        
        if stream:
            try:
                logger.info(f"Descargando stream progresivo a {output_path}")
                stream.download(output_path=temp_dir, filename=output_filename)
                
                # Verificar que el archivo se descargó correctamente
                if not os.path.exists(output_path) or os.path.getsize(output_path) == 0:
                    logger.error(f"El archivo descargado no existe o está vacío: {output_path}")
                    return jsonify({"error": "Error al descargar el video: archivo vacío o inexistente"}), 500
                
                logger.info(f"Archivo descargado correctamente: {output_path}")
            except Exception as e:
                logger.error(f"Error al descargar video: {str(e)}")
                return jsonify({"error": f"Error al descargar video: {str(e)}"}), 500
            
            if direct_blob:
                logger.info("Enviando archivo como blob")
                return send_file(output_path, mimetype='video/mp4', as_attachment=True, download_name=f"{sanitized_title}.mp4")
            
            logger.info("Enviando información del video descargado")
            return jsonify({
                "message": "Video descargado correctamente",
                "title": title,
                "path": output_path,
                "filename": output_filename
            }), 200
        else:
            logger.info("No se encontró stream progresivo, intentando con streams adaptativos")
            try:
                # Intentar con streams adaptativos (video y audio por separado)
                logger.info("Buscando stream de video adaptativo")
                video_stream = yt.streams.filter(adaptive=True, file_extension='mp4', only_video=True).order_by('resolution').desc().first()
                
                if not video_stream:
                    logger.error("No se encontró stream de video adaptativo")
                    return jsonify({"error": "No se encontró stream de video"}), 500
                
                logger.info("Buscando stream de audio adaptativo")
                audio_stream = yt.streams.filter(adaptive=True, only_audio=True).order_by('abr').desc().first()
                
                if not audio_stream:
                    logger.error("No se encontró stream de audio adaptativo")
                    return jsonify({"error": "No se encontró stream de audio"}), 500
                
                # Descargar video y audio por separado
                video_filename = f"video_{uuid.uuid4()}.mp4"
                audio_filename = f"audio_{uuid.uuid4()}.mp4"
                video_path = os.path.join(temp_dir, video_filename)
                audio_path = os.path.join(temp_dir, audio_filename)
                
                logger.info(f"Descargando stream de video a {video_path}")
                video_stream.download(output_path=temp_dir, filename=video_filename)
                
                logger.info(f"Descargando stream de audio a {audio_path}")
                audio_stream.download(output_path=temp_dir, filename=audio_filename)
                
                # Verificar que los archivos se descargaron correctamente
                if not os.path.exists(video_path) or os.path.getsize(video_path) == 0:
                    logger.error(f"El archivo de video no existe o está vacío: {video_path}")
                    return jsonify({"error": "Error al descargar el video: archivo de video vacío o inexistente"}), 500
                
                if not os.path.exists(audio_path) or os.path.getsize(audio_path) == 0:
                    logger.error(f"El archivo de audio no existe o está vacío: {audio_path}")
                    return jsonify({"error": "Error al descargar el video: archivo de audio vacío o inexistente"}), 500
                
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
                
                if process.returncode != 0:
                    logger.error(f"Error al combinar video y audio: {process.stderr}")
                    return jsonify({"error": f"Error al combinar video y audio: {process.stderr}"}), 500
                
                # Verificar que el archivo combinado se creó correctamente
                if not os.path.exists(output_path) or os.path.getsize(output_path) == 0:
                    logger.error(f"El archivo combinado no existe o está vacío: {output_path}")
                    return jsonify({"error": "Error al combinar video y audio: archivo resultante vacío o inexistente"}), 500
                
                # Si todo salió bien, enviar el archivo o la información
                if direct_blob:
                    logger.info("Enviando archivo como blob")
                    return send_file(output_path, mimetype='video/mp4', as_attachment=True, download_name=f"{sanitized_title}.mp4")
                
                logger.info("Enviando información del video descargado")
                return jsonify({
                    "message": "Video descargado correctamente",
                    "title": title,
                    "path": output_path,
                    "filename": output_filename
                }), 200
            except Exception as e:
                logger.error(f"Error al procesar streams adaptativos: {str(e)}")
                return jsonify({"error": f"Error al procesar streams adaptativos: {str(e)}"}), 500
    except Exception as e:
        logger.error(f"Error general en download_best: {str(e)}")
        return jsonify({"error": f"Error general al procesar la solicitud: {str(e)}"}), 500
    finally:
        # Limpiar recursos temporales si existen
        if temp_dir and os.path.exists(temp_dir):
            try:
                logger.info(f"Limpiando directorio temporal: {temp_dir}")
                shutil.rmtree(temp_dir)
            except Exception as e:
                logger.error(f"Error al limpiar directorio temporal: {str(e)}")


# Endpoint para subir archivos a MinIO
@app.route('/upload_to_minio', methods=['POST', 'OPTIONS'])
def upload_to_minio():
    try:
        # Si es una solicitud OPTIONS (preflight), responder adecuadamente
        if request.method == 'OPTIONS':
            return '', 200
        # Verificar si hay un archivo en la solicitud
        if 'file' not in request.files:
            return jsonify({"error": "No se encontró ningún archivo en la solicitud"}), 400
        
        file = request.files['file']
        if file.filename == '':
            return jsonify({"error": "No se seleccionó ningún archivo"}), 400
        
        # Obtener parámetros de configuración de MinIO
        bucket = request.form.get('bucket', 'ciberfobia')
        path = request.form.get('path', 'videosYotube')
        
        # Generar un nombre único para el archivo
        filename = f"{path}/{int(time.time())}_{file.filename}"
        
        # Guardar el archivo temporalmente
        temp_path = os.path.join(tempfile.gettempdir(), file.filename)
        file.save(temp_path)
        
        # Importar boto3 para interactuar con MinIO/S3
        import boto3
        from botocore.client import Config
        
        # Configurar cliente S3
        s3_client = boto3.client(
            's3',
            endpoint_url='https://prueba-minio.1xrk3z.easypanel.host',
            aws_access_key_id='l2jatniel',
            aws_secret_access_key='04142312256',
            config=Config(signature_version='s3v4'),
            region_name='us-east-1'
        )
        
        # Subir archivo a MinIO
        s3_client.upload_file(
            temp_path,
            bucket,
            filename
        )
        
        # Eliminar archivo temporal
        os.remove(temp_path)
        
        # Generar URL del archivo
        file_url = f"https://prueba-minio.1xrk3z.easypanel.host/{bucket}/{filename}"
        
        return jsonify({
            "message": "Archivo subido correctamente",
            "url": file_url,
            "filename": filename
        }), 200
        
    except Exception as e:
        logger.error(f"Error al subir archivo a MinIO: {str(e)}")
        return jsonify({"error": f"Error al subir archivo: {str(e)}"}), 500

# Endpoint para descargar video en calidad específica
@app.route('/download_selected/<quality>', methods=['POST', 'OPTIONS'])
def download_selected_quality(quality):
    try:
        # Si es una solicitud OPTIONS (preflight), responder adecuadamente
        if request.method == 'OPTIONS':
            return '', 200
            
        data = request.get_json()
        if data is None:
            logger.error("No se pudo parsear el JSON del cuerpo de la solicitud")
            return jsonify({"error": "Invalid JSON in request body."}), 400
            
        url = data.get('url')
        direct_blob = data.get('direct_blob', False)
        logger.info(f"Solicitud de descarga en calidad {quality} recibida para URL: {url}")
        
        if not url:
            return jsonify({"error": "Missing 'url' parameter in the request body."}), 400

        if not is_valid_youtube_url(url):
            return jsonify({"error": "Invalid YouTube URL."}), 400
        
        # Descargar el video en la calidad especificada
        try:
            yt = YouTube(url)
            logger.info(f"Título del video: {yt.title}")
            
            # Verificar si quality es un itag (número) o una resolución (como '720p')
            is_itag = quality.isdigit()
            
            # Variable para rastrear si el formato es adaptativo (solo video sin audio)
            is_adaptive_format = False
            
            if is_itag:
                # Buscar el stream por itag
                logger.info(f"Buscando stream con itag: {quality}")
                video_stream = yt.streams.get_by_itag(int(quality))
                
                if not video_stream:
                    return jsonify({"error": f"No se encontró ningún stream con itag {quality}"}), 404
                
                # Verificar si el stream es adaptativo (solo video sin audio)
                is_adaptive_format = video_stream.is_adaptive
                
                # Registrar información detallada sobre el stream
                logger.info(f"Stream encontrado con itag {quality}:")
                logger.info(f"  - Tipo: {'Adaptativo (solo video)' if is_adaptive_format else 'Progresivo (video+audio)'}")
                logger.info(f"  - Resolución: {video_stream.resolution}")
                logger.info(f"  - Codec: {video_stream.video_codec}")
                logger.info(f"  - FPS: {video_stream.fps}")
                logger.info(f"  - Tipo MIME: {video_stream.mime_type}")
                
                if is_adaptive_format:
                    logger.info(f"El stream con itag {quality} es adaptativo y requiere combinar con audio")
                else:
                    logger.info(f"El stream con itag {quality} es progresivo (incluye audio)")
                    
                # Si el formato es adaptativo, verificar que ffmpeg esté disponible antes de continuar
                if is_adaptive_format:
                    ffmpeg_path = 'C:\\ProgramData\\chocolatey\\bin\\ffmpeg.exe'
                    if not os.path.exists(ffmpeg_path):
                        logger.error(f"ffmpeg no encontrado en {ffmpeg_path} y es necesario para formatos adaptativos")
                        return jsonify({
                            "error": f"El formato seleccionado (itag {quality}) es adaptativo (solo video) " +
                                     f"y requiere ffmpeg para combinar con audio, pero ffmpeg no fue encontrado " +
                                     f"en la ruta: {ffmpeg_path}"
                        }), 500
            else:
                # Buscar el stream de video en la calidad solicitada por resolución
                logger.info(f"Buscando stream con resolución: {quality}")
                video_stream = yt.streams.filter(adaptive=True, file_extension='mp4', only_video=True, resolution=quality).first()
                
                # Si no se encuentra, intentar con un stream progresivo (que incluye audio)
                if not video_stream:
                    video_stream = yt.streams.filter(progressive=True, file_extension='mp4', resolution=quality).first()
                
                # Si encontramos un stream progresivo, no necesitamos audio por separado
                if video_stream:
                    # Crear directorio temporal para los archivos
                    temp_dir = tempfile.mkdtemp()
                    output_filename = f"{yt.title.replace(' ', '_')}_{quality}_{uuid.uuid4()}.mp4"
                    output_path = os.path.join(temp_dir, output_filename)
                    
                    # Descargar video (ya incluye audio)
                    logger.info(f"Descargando video progresivo: {video_stream.resolution}")
                    video_stream.download(output_path=temp_dir, filename=output_filename)
                    
                    # Si se solicita el blob directamente
                    if direct_blob:
                        response = send_file(
                            output_path,
                            mimetype='video/mp4',
                            as_attachment=True,
                            download_name=f"{yt.title}_{quality}.mp4"
                        )
                        
                        # Limpiar archivos después de enviar la respuesta
                        @response.call_on_close
                        def cleanup():
                            try:
                                os.remove(output_path)
                                os.rmdir(temp_dir)
                            except Exception as e:
                                logger.error(f"Error al limpiar archivos temporales: {str(e)}")
                        
                        return response
                    
                    # Si no se solicita el blob, devolver información sobre el archivo
                    return jsonify({
                        "message": "Video descargado exitosamente",
                        "filename": output_filename,
                        "download_url": f"/download/{output_filename}"
                    }), 200
            
            # Si no encontramos un stream progresivo, necesitamos combinar video y audio
            if not video_stream:
                return jsonify({"error": f"No se encontró video en calidad {quality}"}), 404
                
            # Obtener la mejor calidad de audio
            audio_stream = yt.streams.filter(adaptive=True, only_audio=True).order_by('abr').desc().first()
            
            if not audio_stream:
                return jsonify({"error": "No se pudo encontrar stream de audio adecuado"}), 500
            
            # Crear directorio temporal para los archivos
            temp_dir = tempfile.mkdtemp()
            video_filename = f"video_{uuid.uuid4()}.mp4"
            audio_filename = f"audio_{uuid.uuid4()}.mp4"
            output_filename = f"{yt.title.replace(' ', '_')}_{quality}_{uuid.uuid4()}.mp4"
            
            # Rutas completas
            video_path = os.path.join(temp_dir, video_filename)
            audio_path = os.path.join(temp_dir, audio_filename)
            output_path = os.path.join(temp_dir, output_filename)
            
            # Descargar video y audio
            logger.info(f"Descargando video: {video_stream.resolution}")
            video_stream.download(output_path=temp_dir, filename=video_filename)
            
            logger.info(f"Descargando audio: {audio_stream.abr}")
            audio_stream.download(output_path=temp_dir, filename=audio_filename)
            
            # Verificar que ffmpeg esté disponible
            ffmpeg_path = 'C:\\ProgramData\\chocolatey\\bin\\ffmpeg.exe'
            if not os.path.exists(ffmpeg_path):
                logger.error(f"ffmpeg no encontrado en la ruta: {ffmpeg_path}")
                return jsonify({
                    "error": f"ffmpeg no encontrado en la ruta: {ffmpeg_path}. " +
                             f"Por favor, asegúrate de que ffmpeg esté instalado correctamente."
                }), 500
                
            # Combinar video y audio con ffmpeg
            logger.info("Combinando video y audio con ffmpeg")
            
            # Verificar que los archivos existen antes de combinarlos
            if not os.path.exists(video_path):
                logger.error(f"El archivo de video no existe: {video_path}")
                return jsonify({"error": "El archivo de video no se descargó correctamente"}), 500
                
            if not os.path.exists(audio_path):
                logger.error(f"El archivo de audio no existe: {audio_path}")
                return jsonify({"error": "El archivo de audio no se descargó correctamente"}), 500
            
            # Registrar tamaños de archivos para depuración
            video_size = os.path.getsize(video_path)
            audio_size = os.path.getsize(audio_path)
            logger.info(f"Tamaño del archivo de video: {video_size} bytes")
            logger.info(f"Tamaño del archivo de audio: {audio_size} bytes")
            
            # Comando ffmpeg con opciones más robustas
            ffmpeg_cmd = [
                ffmpeg_path,  # Ruta completa a ffmpeg
                '-i', video_path,
                '-i', audio_path,
                '-c:v', 'copy',      # Copiar stream de video sin recodificar
                '-c:a', 'aac',       # Usar codec AAC para audio
                '-strict', 'experimental',  # Permitir codecs experimentales
                '-shortest',         # Terminar cuando el stream más corto acabe
                '-y',               # Sobrescribir archivo de salida si existe
                output_path
            ]
            
            logger.info(f"Ejecutando comando ffmpeg: {' '.join(ffmpeg_cmd)}")
            
            try:
                # Ejecutar ffmpeg con un timeout de 120 segundos (más tiempo para archivos grandes)
                process = subprocess.run(ffmpeg_cmd, capture_output=True, text=True, timeout=120)
                
                # Registrar salida de ffmpeg para depuración
                logger.info(f"Salida de ffmpeg: {process.stdout}")
                
                if process.returncode != 0:
                    logger.error(f"Error al combinar video y audio: {process.stderr}")
                    return jsonify({
                        "error": f"Error al combinar video y audio con ffmpeg. " +
                                 f"Detalles: {process.stderr}"
                    }), 500
                    
                # Verificar que el archivo combinado existe y tiene un tamaño razonable
                if not os.path.exists(output_path) or os.path.getsize(output_path) < 1024:
                    logger.error(f"El archivo combinado no se creó correctamente o está vacío")
                    return jsonify({"error": "El archivo combinado no se creó correctamente"}), 500
                    
                logger.info(f"Archivo combinado creado exitosamente: {output_path} ({os.path.getsize(output_path)} bytes)")
                
            except subprocess.TimeoutExpired:
                logger.error("Timeout al ejecutar ffmpeg")
                return jsonify({
                    "error": "El proceso de combinación de video y audio tomó demasiado tiempo y se canceló."
                }), 500
            except Exception as e:
                logger.error(f"Error al ejecutar ffmpeg: {str(e)}")
                return jsonify({"error": f"Error al ejecutar ffmpeg: {str(e)}"}), 500
            
            # Si se solicita el blob directamente
            if direct_blob:
                response = send_file(
                    output_path,
                    mimetype='video/mp4',
                    as_attachment=True,
                    download_name=f"{yt.title}_{quality}.mp4"
                )
                
                # Limpiar archivos después de enviar la respuesta
                @response.call_on_close
                def cleanup():
                    try:
                        os.remove(video_path)
                        os.remove(audio_path)
                        os.remove(output_path)
                        os.rmdir(temp_dir)
                    except Exception as e:
                        logger.error(f"Error al limpiar archivos temporales: {str(e)}")
                
                return response
            
            # Si no se solicita el blob, devolver información sobre el archivo
            return jsonify({
                "message": "Video descargado y combinado exitosamente",
                "filename": output_filename,
                "download_url": f"/download/{output_filename}"
            }), 200
            
        except Exception as e:
            logger.error(f"Error al procesar el video: {str(e)}")
            return jsonify({"error": f"Error al procesar el video: {str(e)}"}), 500
            
    except Exception as e:
        logger.error(f"Error inesperado en download_selected_quality: {str(e)}")
        return jsonify({"error": f"Unexpected error: {str(e)}"}), 500

# Endpoint para servir archivos descargados
@app.route('/download/<filename>', methods=['GET'])
def serve_file(filename):
    try:
        # Buscar el archivo en el directorio temporal
        for root, dirs, files in os.walk(tempfile.gettempdir()):
            if filename in files:
                file_path = os.path.join(root, filename)
                return send_file(
                    file_path,
                    mimetype='video/mp4',
                    as_attachment=True,
                    download_name=filename
                )
        
        # Si no se encuentra el archivo
        return jsonify({"error": "Archivo no encontrado"}), 404
    except Exception as e:
        logger.error(f"Error al servir el archivo: {str(e)}")
        return jsonify({"error": f"Error al servir el archivo: {str(e)}"}), 500

if __name__ == '__main__':
    logger.info("Iniciando servidor Flask en http://0.0.0.0:5000")
    app.run(host='0.0.0.0', port=5000, debug=False)
