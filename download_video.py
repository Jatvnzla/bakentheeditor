import yt_dlp
import sys
import os
import json
import uuid
import subprocess
from flask import Flask, request, jsonify, send_file
from flask_cors import CORS

app = Flask(__name__)
CORS(app)  # Habilitar CORS para todas las rutas

def get_video_info(url):
    """Obtiene información sobre un video de YouTube"""
    try:
        ydl_opts = {
            'quiet': True,
            'no_warnings': True,
            'skip_download': True,
        }
        
        with yt_dlp.YoutubeDL(ydl_opts) as ydl:
            info = ydl.extract_info(url, download=False)
            
            # Filtrar formatos para obtener solo los de video con audio
            formats = [f for f in info.get('formats', []) 
                      if f.get('vcodec') != 'none' and f.get('acodec') != 'none']
            
            # Organizar formatos por resolución
            available_formats = {}
            for f in formats:
                height = f.get('height')
                if height:
                    resolution = f"{height}p"
                    if resolution not in available_formats:
                        available_formats[resolution] = f['format_id']
            
            video_info = {
                'title': info.get('title'),
                'uploader': info.get('uploader'),
                'duration': info.get('duration'),
                'view_count': info.get('view_count'),
                'description': info.get('description'),
                'upload_date': info.get('upload_date'),
                'available_resolutions': list(available_formats.keys()),
                'thumbnail': info.get('thumbnail')
            }
            
            return video_info, None
    except Exception as e:
        return None, str(e)

def download_video(url, resolution=None, output_dir=None):
    """Descarga un video de YouTube en la resolución especificada"""
    try:
        if output_dir is None:
            output_dir = os.getcwd()
        
        # Primero obtenemos la información para verificar si la resolución está disponible
        video_info, error = get_video_info(url)
        if error:
            return False, error
        
        # Si no se especifica resolución, usamos la mejor disponible
        if resolution is None or resolution not in video_info['available_resolutions']:
            if not video_info['available_resolutions']:
                return False, "No se encontraron resoluciones disponibles"
            resolution = video_info['available_resolutions'][0]
            print(f"Usando resolución: {resolution}")
        
        # Configuración para la descarga
        ydl_opts = {
            'format': f'bestvideo[height<={resolution[:-1]}]+bestaudio/best[height<={resolution[:-1]}]',
            'outtmpl': os.path.join(output_dir, '%(title)s.%(ext)s'),
            'quiet': False,
        }
        
        with yt_dlp.YoutubeDL(ydl_opts) as ydl:
            ydl.download([url])
            
        return True, f"Video descargado exitosamente en resolución {resolution}"
    except Exception as e:
        return False, str(e)

def download_best_quality(url, output_dir=None):
    """Descarga el mejor video y audio por separado y los combina con ffmpeg"""
    try:
        if output_dir is None:
            output_dir = os.getcwd()
        
        # Crear un directorio temporal para los archivos intermedios
        temp_dir = os.path.join(output_dir, f"temp_{uuid.uuid4().hex}")
        os.makedirs(temp_dir, exist_ok=True)
        
        # Obtener información del video
        video_info, error = get_video_info(url)
        if error:
            return False, error, None
        
        video_title = video_info['title']
        safe_title = ''.join(c for c in video_title if c.isalnum() or c in ' ._-').strip()
        
        # Configuración para descargar el mejor video (sin audio)
        video_opts = {
            'format': 'bestvideo',
            'outtmpl': os.path.join(temp_dir, 'video.%(ext)s'),
            'quiet': True,
        }
        
        # Configuración para descargar el mejor audio
        audio_opts = {
            'format': 'bestaudio',
            'outtmpl': os.path.join(temp_dir, 'audio.%(ext)s'),
            'quiet': True,
        }
        
        # Descargar video
        with yt_dlp.YoutubeDL(video_opts) as ydl:
            video_info = ydl.extract_info(url, download=True)
            video_path = ydl.prepare_filename(video_info)
        
        # Descargar audio
        with yt_dlp.YoutubeDL(audio_opts) as ydl:
            audio_info = ydl.extract_info(url, download=True)
            audio_path = ydl.prepare_filename(audio_info)
        
        # Combinar video y audio con ffmpeg
        output_file = os.path.join(output_dir, f"{safe_title}.mp4")
        
        # Comando ffmpeg para combinar
        cmd = [
            'ffmpeg',
            '-i', video_path,
            '-i', audio_path,
            '-c:v', 'copy',
            '-c:a', 'aac',
            '-strict', 'experimental',
            output_file
        ]
        
        # Ejecutar ffmpeg
        subprocess.run(cmd, check=True)
        
        # Eliminar archivos temporales
        os.remove(video_path)
        os.remove(audio_path)
        os.rmdir(temp_dir)
        
        return True, f"Video descargado y combinado exitosamente: {output_file}", output_file
    except subprocess.CalledProcessError as e:
        return False, f"Error al combinar con ffmpeg: {str(e)}", None
    except Exception as e:
        return False, str(e), None

def download_selected_quality(url, resolution, output_dir=None):
    """Descarga video en la calidad seleccionada y el mejor audio, y los combina con ffmpeg"""
    try:
        if output_dir is None:
            output_dir = os.getcwd()
        
        # Crear un directorio temporal para los archivos intermedios
        temp_dir = os.path.join(output_dir, f"temp_{uuid.uuid4().hex}")
        os.makedirs(temp_dir, exist_ok=True)
        
        # Obtener información del video
        video_info, error = get_video_info(url)
        if error:
            return False, error, None
        
        video_title = video_info['title']
        safe_title = ''.join(c for c in video_title if c.isalnum() or c in ' ._-').strip()
        
        # Verificar si la resolución está disponible
        if resolution not in video_info['available_resolutions']:
            return False, f"Resolución {resolution} no disponible para este video", None
        
        # Extraer el valor numérico de la resolución (por ejemplo, '720p' -> '720')
        resolution_value = resolution[:-1] if resolution.endswith('p') else resolution
        
        # Configuración para descargar el video en la calidad seleccionada (sin audio)
        video_opts = {
            'format': f'bestvideo[height<={resolution_value}]',
            'outtmpl': os.path.join(temp_dir, 'video.%(ext)s'),
            'quiet': True,
        }
        
        # Configuración para descargar el mejor audio
        audio_opts = {
            'format': 'bestaudio',
            'outtmpl': os.path.join(temp_dir, 'audio.%(ext)s'),
            'quiet': True,
        }
        
        # Descargar video
        with yt_dlp.YoutubeDL(video_opts) as ydl:
            video_info = ydl.extract_info(url, download=True)
            video_path = ydl.prepare_filename(video_info)
        
        # Descargar audio
        with yt_dlp.YoutubeDL(audio_opts) as ydl:
            audio_info = ydl.extract_info(url, download=True)
            audio_path = ydl.prepare_filename(audio_info)
        
        # Combinar video y audio con ffmpeg
        output_file = os.path.join(output_dir, f"{safe_title}_{resolution}.mp4")
        
        # Comando ffmpeg para combinar
        cmd = [
            'ffmpeg',
            '-i', video_path,
            '-i', audio_path,
            '-c:v', 'copy',
            '-c:a', 'aac',
            '-strict', 'experimental',
            output_file
        ]
        
        # Ejecutar ffmpeg
        subprocess.run(cmd, check=True)
        
        # Eliminar archivos temporales
        os.remove(video_path)
        os.remove(audio_path)
        os.rmdir(temp_dir)
        
        return True, f"Video descargado en {resolution} y combinado con el mejor audio exitosamente: {output_file}", output_file
    except subprocess.CalledProcessError as e:
        return False, f"Error al combinar con ffmpeg: {str(e)}", None
    except Exception as e:
        return False, str(e), None

@app.route('/')
def index():
    return jsonify({
        "message": "YouTube Video Downloader API (yt-dlp version)",
        "endpoints": [
            {
                "path": "/video_info",
                "method": "POST",
                "description": "Obtener información sobre un video de YouTube",
                "body": {"url": "URL del video de YouTube"}
            },
            {
                "path": "/download/<resolution>",
                "method": "POST",
                "description": "Descargar un video de YouTube en la resolución especificada",
                "body": {"url": "URL del video de YouTube"},
                "example_resolutions": ["720p", "480p", "360p"]
            },
            {
                "path": "/download_best",
                "method": "POST",
                "description": "Descargar el mejor video y audio por separado y combinarlos con ffmpeg",
                "body": {"url": "URL del video de YouTube"}
            },
            {
                "path": "/download_selected/<resolution>",
                "method": "POST",
                "description": "Descargar video en la calidad seleccionada y el mejor audio, y combinarlos con ffmpeg",
                "body": {"url": "URL del video de YouTube"},
                "example_resolutions": ["720p", "480p", "360p"]
            },
            {
                "path": "/download_file/<filename>",
                "method": "GET",
                "description": "Descargar un archivo previamente procesado"
            }
        ]
    })

@app.route('/video_info', methods=['POST'])
def video_info_endpoint():
    try:
        data = request.get_json()
        if data is None:
            return jsonify({"error": "JSON inválido en el cuerpo de la solicitud"}), 400
            
        url = data.get('url')
        if not url:
            return jsonify({"error": "Falta el parámetro 'url' en el cuerpo de la solicitud"}), 400
        
        print(f"Obteniendo información del video: {url}")
        video_info, error = get_video_info(url)
        
        if video_info:
            return jsonify(video_info), 200
        else:
            return jsonify({"error": error}), 500
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route('/download/<resolution>', methods=['POST'])
def download_endpoint(resolution):
    try:
        data = request.get_json()
        if data is None:
            return jsonify({"error": "JSON inválido en el cuerpo de la solicitud"}), 400
            
        url = data.get('url')
        if not url:
            return jsonify({"error": "Falta el parámetro 'url' en el cuerpo de la solicitud"}), 400
        
        print(f"Descargando video: {url} en resolución {resolution}")
        success, message = download_video(url, resolution)
        
        if success:
            return jsonify({"message": message}), 200
        else:
            return jsonify({"error": message}), 500
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route('/download_best', methods=['POST'])
def download_best_endpoint():
    try:
        data = request.get_json()
        if data is None:
            return jsonify({"error": "JSON inválido en el cuerpo de la solicitud"}), 400
            
        url = data.get('url')
        direct_blob = data.get('direct_blob', False)  # Nuevo parámetro para solicitar blob directo
        if not url:
            return jsonify({"error": "Falta el parámetro 'url' en el cuerpo de la solicitud"}), 400
        
        print(f"Descargando mejor calidad para: {url}")
        success, message, output_file = download_best_quality(url)
        
        if success:
            # Extraer solo el nombre del archivo del path completo
            filename = os.path.basename(output_file)
            
            # Si se solicita blob directo, devolver el archivo como respuesta
            if direct_blob:
                return send_file(output_file, as_attachment=True, download_name=filename, mimetype='video/mp4')
            else:
                # Comportamiento original: devolver URL para descarga
                return jsonify({
                    "message": message,
                    "filename": filename,
                    "download_url": f"/download_file/{filename}"
                }), 200
        else:
            return jsonify({"error": message}), 500
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route('/download_selected/<resolution>', methods=['POST'])
def download_selected_endpoint(resolution):
    try:
        data = request.get_json()
        if data is None:
            return jsonify({"error": "JSON inválido en el cuerpo de la solicitud"}), 400
            
        url = data.get('url')
        direct_blob = data.get('direct_blob', False)  # Nuevo parámetro para solicitar blob directo
        if not url:
            return jsonify({"error": "Falta el parámetro 'url' en el cuerpo de la solicitud"}), 400
        
        print(f"Descargando video en {resolution} con mejor audio para: {url}")
        success, message, output_file = download_selected_quality(url, resolution)
        
        if success:
            # Extraer solo el nombre del archivo del path completo
            filename = os.path.basename(output_file)
            
            # Si se solicita blob directo, devolver el archivo como respuesta
            if direct_blob:
                return send_file(output_file, as_attachment=True, download_name=filename, mimetype='video/mp4')
            else:
                # Comportamiento original: devolver URL para descarga
                return jsonify({
                    "message": message,
                    "filename": filename,
                    "download_url": f"/download_file/{filename}"
                }), 200
        else:
            return jsonify({"error": message}), 500
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route('/download_file/<filename>', methods=['GET'])
def download_file_endpoint(filename):
    try:
        # Por seguridad, asegurarse de que el archivo solicitado está en el directorio actual
        file_path = os.path.join(os.getcwd(), filename)
        
        if not os.path.exists(file_path):
            return jsonify({"error": "Archivo no encontrado"}), 404
            
        return send_file(file_path, as_attachment=True)
    except Exception as e:
        return jsonify({"error": str(e)}), 500

# Si se ejecuta directamente, iniciar el servidor Flask
if __name__ == '__main__':
    # Si se pasan argumentos, ejecutar como script de línea de comandos
    if len(sys.argv) > 1:
        if sys.argv[1] == 'info':
            if len(sys.argv) < 3:
                print("Uso: python download_video.py info <URL>")
                sys.exit(1)
            
            url = sys.argv[2]
            info, error = get_video_info(url)
            if info:
                print(json.dumps(info, indent=2))
            else:
                print(f"Error: {error}")
        
        elif sys.argv[1] == 'download':
            if len(sys.argv) < 3:
                print("Uso: python download_video.py download <URL> [resolución]")
                sys.exit(1)
            
            url = sys.argv[2]
            resolution = sys.argv[3] if len(sys.argv) > 3 else None
            success, message = download_video(url, resolution)
            print(message)
    else:
        # Iniciar servidor Flask
        print("Iniciando servidor Flask en http://127.0.0.1:5000")
        app.run(debug=True)
