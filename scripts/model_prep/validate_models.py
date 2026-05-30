#!/usr/bin/env python3
"""
FaceGuard Offline - E2E Model Validation
Loads the 3 generated TFLite models, measures model size,
runs latency benchmarking on 5 face images with dynamic shape/type adaptation,
prints a summary table, and asserts the total size (<20MB) and latency (<900ms) constraints.
"""

import os
import sys
import argparse
import logging
import time
from pathlib import Path
import numpy as np

# Configure logging
LOG_DIR = Path("scripts/logs")
LOG_DIR.mkdir(parents=True, exist_ok=True)
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    handlers=[
        logging.StreamHandler(sys.stdout),
        logging.FileHandler(LOG_DIR / "validate_models.log", encoding="utf-8")
    ]
)
logger = logging.getLogger("validate_models")

# Try to import cv2 and tensorflow
try:
    import cv2
except ImportError:
    logger.error("OpenCV is required. Please install 'opencv-python-headless'.")
    sys.exit(1)

try:
    import tensorflow as tf
except ImportError:
    logger.error("TensorFlow is required. Please install 'tensorflow>=2.13.0'.")
    sys.exit(1)

# Suppress warnings
os.environ['TF_CPP_MIN_LOG_LEVEL'] = '3'
tf.get_logger().setLevel('ERROR')

def run_latency_test(model_path, test_images):
    """Loads a TFLite model, runs inference on the test images, and returns file size and median latency."""
    file_size_mb = Path(model_path).stat().st_size / (1024 * 1024)
    
    interpreter = tf.lite.Interpreter(model_path=str(model_path))
    interpreter.allocate_tensors()
    
    input_details = interpreter.get_input_details()
    output_details = interpreter.get_output_details()
    
    input_shape = input_details[0]['shape']
    input_dtype = input_details[0]['dtype']
    
    latencies = []
    
    for img in test_images:
        # 1. Adapt to input shape [batch, channels, h, w] or [batch, h, w, channels]
        if len(input_shape) == 4:
            if input_shape[1] == 3:  # NCHW format (Channel First)
                _, c, h, w = input_shape
                resized = cv2.resize(img, (w, h))
                processed = resized.transpose(2, 0, 1) # HWC -> CHW
            else:  # NHWC format (Channel Last)
                _, h, w, c = input_shape
                processed = cv2.resize(img, (w, h))
        else:
            # Default fallback resizing
            processed = cv2.resize(img, (112, 112))
            
        # 2. Adapt to input data type (INT8 vs Float32)
        if input_dtype == np.int8:
            # Map to [-1.0, 1.0] float range
            normalized = (processed.astype(np.float32) - 127.5) / 128.0
            
            # Apply quantization parameters to convert to INT8
            scale, zero_point = input_details[0]['quantization']
            if scale == 0.0:
                scale = 1.0
            quantized = np.round(normalized / scale + zero_point)
            input_tensor = np.clip(quantized, -128, 127).astype(np.int8)
        else:
            # Default normalized Float32 input
            input_tensor = (processed.astype(np.float32) - 127.5) / 128.0
            
        # 3. Add batch dimension
        input_batch = np.expand_dims(input_tensor, axis=0)
        
        # 4. Measure inference
        start_time = time.perf_counter()
        interpreter.set_tensor(input_details[0]['index'], input_batch)
        interpreter.invoke()
        _ = interpreter.get_tensor(output_details[0]['index'])
        end_time = time.perf_counter()
        
        latencies.append((end_time - start_time) * 1000.0)
        
    # Return file size in MB and median latency of inferences in ms
    return file_size_mb, np.median(latencies)

def main():
    parser = argparse.ArgumentParser(
        description="E2E Model preparation validation: Verify TFLite sizes, run latency benchmarks, and assert constraints.",
        formatter_class=argparse.ArgumentDefaultsHelpFormatter
    )
    parser.add_argument(
        "--models-dir",
        type=str,
        default="models",
        help="Directory where the 3 .tflite files are saved."
    )
    parser.add_argument(
        "--calibration-dir",
        type=str,
        default="scripts/calibration_faces",
        help="Directory to pull test images from."
    )
    
    args = parser.parse_args()
    
    models_dir = Path(args.models_dir)
    calibration_dir = Path(args.calibration_dir)
    
    # Target files
    blazeface_path = models_dir / "blazeface.tflite"
    mobilefacenet_path = models_dir / "mobilefacenet_int8.tflite"
    minifasnet_path = models_dir / "minifasnet.tflite"
    
    # Check if models exist
    missing_models = []
    for model_path in [blazeface_path, mobilefacenet_path, minifasnet_path]:
        if not model_path.exists():
            missing_models.append(model_path.name)
            
    if missing_models:
        logger.error(f"Missing model files: {', '.join(missing_models)}")
        logger.error("Please run the download/quantization scripts first!")
        sys.exit(1)
        
    # Load 5 test face images from calibration folder, or use random arrays if not present
    test_images = []
    if calibration_dir.exists():
        calib_files = list(calibration_dir.glob("*.jpg")) + list(calibration_dir.glob("*.png"))
        for f in calib_files[:5]:
            img = cv2.imread(str(f))
            if img is not None:
                # Convert BGR to RGB
                test_images.append(cv2.cvtColor(img, cv2.COLOR_BGR2RGB))
                
    if len(test_images) < 5:
        logger.warning("Could not load 5 calibration images. Using high-entropy synthetic face patterns...")
        for i in range(5):
            # Create a 224x224 RGB image with random noise and a central circle (synthetic face structure)
            dummy = np.random.randint(50, 200, (224, 224, 3), dtype=np.uint8)
            cv2.circle(dummy, (112, 112), 70, (210, 180, 140), -1) # skin colored circle
            test_images.append(dummy)

    logger.info("Running end-to-end performance and latency verification...")
    
    # Latency benchmarking
    logger.info("Benchmarking BlazeFace...")
    bf_size, bf_latency = run_latency_test(blazeface_path, test_images)
    
    logger.info("Benchmarking MobileFaceNet INT8...")
    mfn_size, mfn_latency = run_latency_test(mobilefacenet_path, test_images)
    
    logger.info("Benchmarking MiniFASNet...")
    mf_size, mf_latency = run_latency_test(minifasnet_path, test_images)
    
    total_size = bf_size + mfn_size + mf_size
    total_latency = bf_latency + mfn_latency + mf_latency
    
    # Print results summary table
    print("\n" + "=" * 65)
    print("                 NHAI FACEGUARD OFFLINE MODEL REPORT")
    print("=" * 65)
    print(f"  Model File           | Size (MB)       | Latency (ms)")
    print("  " + "-" * 21 + "+" + "-" * 17 + "+" + "-" * 22)
    print(f"  BlazeFace            | {bf_size:10.2f} MB    | {bf_latency:10.2f} ms")
    print(f"  MobileFaceNet INT8   | {mfn_size:10.2f} MB    | {mfn_latency:10.2f} ms")
    print(f"  MiniFASNet           | {mf_size:10.2f} MB    | {mf_latency:10.2f} ms")
    print("  " + "-" * 21 + "+" + "-" * 17 + "+" + "-" * 22)
    print(f"  TOTAL                | {total_size:10.2f} MB    | {total_latency:10.2f} ms")
    print("=" * 65)
    print("  Edge Deployment Constraints:")
    print("    - Limit: Size < 20.0 MB | Latency < 900.0 ms")
    print(f"    - Actual: Size = {total_size:.2f} MB | Latency = {total_latency:.2f} ms")
    
    # Assertions
    try:
        assert total_size < 20.0, f"Assertion Failed: Total size {total_size:.2f} MB exceeds 20 MB budget!"
        assert total_latency < 900.0, f"Assertion Failed: Combined inference time {total_latency:.2f} ms exceeds 900 ms budget!"
        logger.info("E2E PIPELINE CONSTRAINTS PASSED SUCCESSFULLY! Model bundle is fully optimized for React Native edge AI integration.")
    except AssertionError as e:
        logger.error(str(e))
        sys.exit(1)

if __name__ == "__main__":
    main()
