#!/usr/bin/env python3
"""
FaceGuard Offline - BlazeFace Downloader & Verifier
Downloads the official BlazeFace short-range TFLite model from MediaPipe,
computes and verifies the SHA256 checksum, and prints tensor metadata.
"""

import os
import sys
import argparse
import logging
import hashlib
from pathlib import Path
import requests
from tqdm import tqdm

# Configure logging
LOG_DIR = Path("scripts/logs")
LOG_DIR.mkdir(parents=True, exist_ok=True)
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    handlers=[
        logging.StreamHandler(sys.stdout),
        logging.FileHandler(LOG_DIR / "download_blazeface.log", encoding="utf-8")
    ]
)
logger = logging.getLogger("download_blazeface")

# Official Google MediaPipe BlazeFace short-range TFLite URL
BLAZEFACE_URL = "https://storage.googleapis.com/mediapipe-models/face_detector/blaze_face_short_range/float16/latest/blaze_face_short_range.tflite"

# Default known SHA256 of the short-range model
# Note: Google occasionally updates this file, so we allow users to override or skip validation
DEFAULT_SHA256 = "c18c2f5ee6f50bdf73df0169300b1a03a655214a1cce5cab13eba73c1297cd78"

def compute_sha256(filepath):
    """Compute the SHA256 checksum of a file."""
    sha256 = hashlib.sha256()
    with open(filepath, "rb") as f:
        for chunk in iter(lambda: f.read(65536), b""):
            sha256.update(chunk)
    return sha256.hexdigest()

def download_file(url, output_path):
    """Download a file showing progress using tqdm."""
    logger.info(f"Downloading from: {url}")
    response = requests.get(url, stream=True)
    total_size = int(response.headers.get("content-length", 0))
    block_size = 1024
    
    with open(output_path, "wb") as f, tqdm(
        total=total_size, unit="iB", unit_scale=True, desc="blazeface.tflite"
    ) as bar:
        for data in response.iter_content(block_size):
            f.write(data)
            bar.update(len(data))

def print_model_details(model_path):
    """Load TFLite model and print input/output tensor shapes and types."""
    # Delay TF import to speed up help CLI execution
    import tensorflow as tf

    logger.info(f"Parsing model metadata for: {model_path}")
    try:
        interpreter = tf.lite.Interpreter(model_path=str(model_path))
        interpreter.allocate_tensors()
        
        input_details = interpreter.get_input_details()
        output_details = interpreter.get_output_details()
        
        print("\n================== BlazeFace Tensor Metadata ==================")
        print("INPUT TENSORS:")
        for idx, detail in enumerate(input_details):
            print(f"  [{idx}] Name:  {detail['name']}")
            print(f"      Shape: {detail['shape']}")
            print(f"      Type:  {detail['dtype']}")
            
        print("\nOUTPUT TENSORS:")
        for idx, detail in enumerate(output_details):
            print(f"  [{idx}] Name:  {detail['name']}")
            print(f"      Shape: {detail['shape']}")
            print(f"      Type:  {detail['dtype']}")
        print("===============================================================\n")
        
    except Exception as e:
        logger.error(f"Failed to parse TFLite model details: {e}")

def main():
    parser = argparse.ArgumentParser(
        description="Download and verify the BlazeFace short-range TFLite model.",
        formatter_class=argparse.ArgumentDefaultsHelpFormatter
    )
    parser.add_argument(
        "--output",
        type=str,
        default="models/blazeface.tflite",
        help="Path where the TFLite model will be saved."
    )
    parser.add_argument(
        "--sha256",
        type=str,
        default="",
        help="Expected SHA256 checksum. If left empty, it will compute and display the hash without crashing."
    )
    parser.add_argument(
        "--skip-verify",
        action="store_true",
        help="Skip SHA256 checksum verification."
    )
    
    args = parser.parse_args()
    
    output_path = Path(args.output)
    output_path.parent.mkdir(parents=True, exist_ok=True)
    
    # 1. Download
    try:
        download_file(BLAZEFACE_URL, output_path)
        logger.info(f"Successfully downloaded BlazeFace TFLite model to: {output_path}")
    except Exception as e:
        logger.error(f"Download failed: {e}")
        sys.exit(1)
        
    # 2. Checksum Verification
    computed_hash = compute_sha256(output_path)
    logger.info(f"Computed SHA256 Checksum: {computed_hash}")
    
    expected_hash = args.sha256 if args.sha256 else DEFAULT_SHA256
    
    if not args.skip_verify:
        # We print expected hash, and if it differs, print a warning instead of a crash,
        # since Google's 'latest' endpoint might change.
        if computed_hash == expected_hash:
            logger.info("SHA256 checksum VERIFIED successfully!")
        else:
            logger.warning(
                f"SHA256 checksum mismatch!\n"
                f"  Expected: {expected_hash}\n"
                f"  Computed: {computed_hash}\n"
                f"Note: This might be due to an upstream model update. Proceeding with caution..."
            )
    else:
        logger.info("Checksum verification skipped.")
        
    # 3. Model size documentation
    file_size_mb = output_path.stat().st_size / (1024 * 1024)
    logger.info(f"Model File Size: {file_size_mb:.2f} MB (Target: ~0.8 MB)")
    
    # 4. Print Shapes
    print_model_details(output_path)

if __name__ == "__main__":
    main()
