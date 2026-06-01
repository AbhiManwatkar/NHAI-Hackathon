import os
import sys
import argparse
import hashlib
import logging
import requests
from tqdm import tqdm
import tensorflow as tf

# Setup logging
LOG_DIR = os.path.join(os.path.dirname(os.path.dirname(__file__)), 'logs')
os.makedirs(LOG_DIR, exist_ok=True)
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s [%(levelname)s] %(message)s',
    handlers=[
        logging.FileHandler(os.path.join(LOG_DIR, 'download_blazeface.log')),
        logging.StreamHandler(sys.stdout)
    ]
)

# Standard MediaPipe short-range face detection model URL and approximate size/hash
BLAZEFACE_URL = "https://github.com/google/mediapipe/raw/master/mediapipe/modules/face_detection/face_detection_short_range.tflite"

def download_model(url, dest_path):
    logging.info(f"Downloading BlazeFace from {url} to {dest_path}")
    response = requests.get(url, stream=True)
    response.raise_for_status()
    total_size = int(response.headers.get('content-length', 0))
    
    with open(dest_path, 'wb') as f, tqdm(
        desc="Downloading BlazeFace",
        total=total_size,
        unit='B',
        unit_scale=True,
        unit_divisor=1024,
    ) as bar:
        for chunk in response.iter_content(chunk_size=8192):
            if chunk:
                f.write(chunk)
                bar.update(len(chunk))

def verify_checksum(file_path, expected_sha256=None):
    sha256 = hashlib.sha256()
    with open(file_path, 'rb') as f:
        while chunk := f.read(8192):
            sha256.update(chunk)
    file_hash = sha256.hexdigest()
    logging.info(f"SHA256 checksum of {file_path}: {file_hash}")
    if expected_sha256 and file_hash != expected_sha256:
        logging.warning(f"SHA-256 does not match! Expected: {expected_sha256}, Got: {file_hash}")
        return False
    return True

def print_tensor_details(model_path):
    interpreter = tf.lite.Interpreter(model_path=model_path)
    interpreter.allocate_tensors()
    
    logging.info("--- Model Tensor Details ---")
    for i, detail in enumerate(interpreter.get_input_details()):
        logging.info(f"Input {i}: Name={detail['name']}, Shape={detail['shape']}, Type={detail['dtype']}")
    for i, detail in enumerate(interpreter.get_output_details()):
        logging.info(f"Output {i}: Name={detail['name']}, Shape={detail['shape']}, Type={detail['dtype']}")

def main():
    parser = argparse.ArgumentParser(description="Download and verify the BlazeFace model for FaceGuard Offline.")
    parser.add_argument('--url', type=str, default=BLAZEFACE_URL, help="URL to download BlazeFace model from.")
    parser.add_argument('--out', type=str, default=None, help="Output file path (default: models/blazeface.tflite)")
    parser.add_argument('--sha256', type=str, default=None, help="Expected SHA256 checksum of the model.")
    args = parser.parse_args()

    # Determine paths relative to this script
    script_dir = os.path.dirname(os.path.abspath(__file__))
    project_root = os.path.dirname(os.path.dirname(script_dir))
    
    out_path = args.out
    if not out_path:
        models_dir = os.path.join(project_root, 'models')
        os.makedirs(models_dir, exist_ok=True)
        out_path = os.path.join(models_dir, 'blazeface.tflite')

    try:
        download_model(args.url, out_path)
        verify_checksum(out_path, args.sha256)
        print_tensor_details(out_path)
        logging.info(f"BlazeFace download & validation complete. Model saved to: {out_path}")
    except Exception as e:
        logging.error(f"Failed to download/validate BlazeFace: {e}", exc_info=True)
        sys.exit(1)

if __name__ == '__main__':
    main()
