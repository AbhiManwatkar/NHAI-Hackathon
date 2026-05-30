#!/usr/bin/env python3
"""
FaceGuard Offline - MiniFASNet Converter
Downloads pretrained MiniFASNetV2 FT7 weights and Silent-Face-Anti-Spoofing model definition,
wraps the network in PyTorch to output a 2-class softmax score [real_score, spoof_score],
and converts the model through PyTorch -> ONNX -> TFLite using onnx2tf.
"""

import os
import sys
import argparse
import logging
import subprocess
import shutil
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
        logging.FileHandler(LOG_DIR / "convert_minifasnet.log", encoding="utf-8")
    ]
)
logger = logging.getLogger("convert_minifasnet")

# Source URLs
MINIFASNET_CODE_URL = "https://raw.githubusercontent.com/minivision-ai/Silent-Face-Anti-Spoofing/master/src/model_lib/MiniFASNet.py"
MINIFASNET_WEIGHTS_URL = "https://github.com/yakhyo/face-anti-spoofing/releases/download/weights/MiniFASNetV2.pth"

def download_file(url, output_path):
    """Downloads a file with a progress bar."""
    logger.info(f"Downloading: {url}")
    response = requests.get(url, stream=True)
    total_size = int(response.headers.get("content-length", 0))
    block_size = 1024
    
    with open(output_path, "wb") as f, tqdm(
        total=total_size, unit="iB", unit_scale=True, desc=Path(output_path).name
    ) as bar:
        for data in response.iter_content(block_size):
            f.write(data)
            bar.update(len(data))

def install_onnx2tf_if_needed():
    """Verify that onnx2tf is installed, or try to install it."""
    try:
        import onnx2tf
        logger.info("onnx2tf library is already installed.")
    except ImportError:
        logger.warning("onnx2tf library not found in Python environment. Trying to install via pip...")
        try:
            subprocess.run([sys.executable, "-m", "pip", "install", "onnx2tf", "onnx", "onnxruntime"], check=True)
            logger.info("Successfully installed onnx2tf and dependencies.")
        except Exception as e:
            logger.error(f"Failed to automatically install onnx2tf: {e}")
            logger.error("Please run: pip install onnx2tf onnx onnxruntime")
            sys.exit(1)

def main():
    parser = argparse.ArgumentParser(
        description="Convert MiniFASNetV2 FT7 from PyTorch -> ONNX -> TFLite (2-class Softmax).",
        formatter_class=argparse.ArgumentDefaultsHelpFormatter
    )
    parser.add_argument(
        "--output",
        type=str,
        default="models/minifasnet.tflite",
        help="Path where the final TFLite model will be saved."
    )
    parser.add_argument(
        "--weights",
        type=str,
        default="models/MiniFASNetV2.pth",
        help="Path to save / load the PyTorch weights file."
    )
    
    args = parser.parse_args()
    
    # 1. Setup paths
    output_path = Path(args.output)
    output_path.parent.mkdir(parents=True, exist_ok=True)
    
    weights_path = Path(args.weights)
    weights_path.parent.mkdir(parents=True, exist_ok=True)
    
    model_lib_dir = Path("scripts/model_lib")
    model_lib_dir.mkdir(parents=True, exist_ok=True)
    
    code_path = model_lib_dir / "MiniFASNet.py"
    
    # Ensure there is an __init__.py in scripts/model_lib
    init_path = model_lib_dir / "__init__.py"
    if not init_path.exists():
        init_path.touch()
        
    # 2. Download code and weights
    if not code_path.exists():
        logger.info("Fetching MiniFASNet.py definition from original Silent-Face-Anti-Spoofing repo...")
        download_file(MINIFASNET_CODE_URL, code_path)
        
    if not weights_path.exists():
        logger.info("Downloading pretrained MiniFASNetV2 PyTorch weights from community releases...")
        download_file(MINIFASNET_WEIGHTS_URL, weights_path)
        
    # 3. Add to sys.path so we can import the model
    sys.path.insert(0, str(Path("scripts").resolve()))
    
    # Imports
    import torch
    import torch.nn as nn
    import torch.nn.functional as F
    
    try:
        from model_lib.MiniFASNet import MiniFASNetV2
    except ImportError as e:
        logger.error(f"Failed to import MiniFASNet: {e}. Make sure scripts/model_lib/MiniFASNet.py exists.")
        sys.exit(1)
        
    # 4. Load PyTorch weights
    logger.info("Initializing MiniFASNetV2 model...")
    state_dict = torch.load(weights_path, map_location="cpu")
    if "state_dict" in state_dict:
        state_dict = state_dict["state_dict"]
    # Clean keys from DataParallel prefix
    state_dict = {k.replace("module.", ""): v for k, v in state_dict.items()}
    
    # MiniFASNetV2 can be defined with (5, 5) or (7, 7) conv6 kernel.
    # Since yakhyo's model is trained on 80x80, conv6_kernel is (5, 5).
    # We try both to be safe and compatible with other sizes.
    loaded = False
    for kernel_size in [(5, 5), (7, 7)]:
        try:
            logger.info(f"Trying to load weights with conv6_kernel={kernel_size}...")
            model = MiniFASNetV2(conv6_kernel=kernel_size, num_classes=3, img_channel=3)
            model.load_state_dict(state_dict, strict=True)
            logger.info(f"Successfully loaded PyTorch weights with conv6_kernel={kernel_size}!")
            loaded = True
            break
        except Exception as e:
            logger.warning(f"Failed to load with conv6_kernel={kernel_size}: {e}")
            
    if not loaded:
        logger.warning("Strict loading failed. Trying non-strict loading to match weights...")
        try:
            model = MiniFASNetV2(conv6_kernel=(5, 5), num_classes=3, img_channel=3)
            model.load_state_dict(state_dict, strict=False)
            logger.info("Loaded weights with strict=False.")
        except Exception as e:
            logger.error(f"Failed to load weights at all: {e}")
            sys.exit(1)
            
    # 5. Wrap in Custom Class to produce 2-class Softmax output
    class MiniFASNetWrapper(nn.Module):
        def __init__(self, base_model):
            super().__init__()
            self.base_model = base_model
            
        def forward(self, x):
            # Original output shape: [batch, 3] representing raw logits
            logits = self.base_model(x)
            # Softmax to turn logits to probabilities
            probs = F.softmax(logits, dim=1)
            # Map 3 classes to 2:
            # Class 0: Real
            # Class 1: Photo Spoof
            # Class 2: Video Spoof
            # Output: [real_score, spoof_score]
            real_score = probs[:, 0:1]
            spoof_score = probs[:, 1:2] + probs[:, 2:3]
            return torch.cat([real_score, spoof_score], dim=1)
            
    wrapper_model = MiniFASNetWrapper(model)
    wrapper_model.eval()
    
    # 6. Export to ONNX
    onnx_path = weights_path.parent / "minifasnet.onnx"
    logger.info(f"Exporting PyTorch model to ONNX: {onnx_path}")
    
    dummy_input = torch.randn(1, 3, 80, 80)
    
    # Test forward pass in PyTorch
    with torch.no_grad():
        out = wrapper_model(dummy_input)
    logger.info(f"PyTorch Wrapper Output Shape: {out.shape} (Expected: [1, 2])")
    logger.info(f"PyTorch Wrapper Sample Output: {out.numpy()}")
    
    torch.onnx.export(
        wrapper_model,
        dummy_input,
        str(onnx_path),
        input_names=["input"],
        output_names=["output"],
        dynamic_axes={"input": {0: "batch_size"}, "output": {0: "batch_size"}},
        opset_version=11
    )
    logger.info("ONNX export complete.")
    
    # 7. Convert ONNX -> TFLite using onnx2tf
    install_onnx2tf_if_needed()
    
    temp_tflite_dir = weights_path.parent / "temp_tflite"
    if temp_tflite_dir.exists():
        shutil.rmtree(temp_tflite_dir)
    temp_tflite_dir.mkdir(parents=True, exist_ok=True)
    
    logger.info("Converting ONNX to TFLite using onnx2tf...")
    try:
        # Run onnx2tf conversion
        cmd = [
            "onnx2tf",
            "-i", str(onnx_path),
            "-o", str(temp_tflite_dir),
            "--non_verbose"
        ]
        logger.info(f"Running command: {' '.join(cmd)}")
        result = subprocess.run(cmd, capture_output=True, text=True, check=True)
        logger.info("onnx2tf conversion completed successfully!")
    except subprocess.CalledProcessError as e:
        logger.error(f"onnx2tf conversion failed: {e.stderr}")
        sys.exit(1)
        
    # Find the output .tflite file in temp_tflite_dir
    # Typically, onnx2tf names the output model like `minifasnet_float32.tflite` or `model_float32.tflite`
    tflite_files = list(temp_tflite_dir.glob("*.tflite"))
    if not tflite_files:
        logger.error(f"No .tflite files found in conversion output directory: {temp_tflite_dir}")
        sys.exit(1)
        
    src_tflite = tflite_files[0]
    logger.info(f"Found TFLite file: {src_tflite}")
    
    # Copy to the final destination
    shutil.copy2(src_tflite, output_path)
    logger.info(f"Successfully saved liveness model to: {output_path}")
    
    # 8. Clean up temporary files
    try:
        shutil.rmtree(temp_tflite_dir)
        onnx_path.unlink()
        logger.info("Cleaned up intermediate ONNX and temp conversion folders.")
    except Exception as e:
        logger.warning(f"Cleanup warning: {e}")
        
    # 9. Verify the final TFLite model using Interpreter
    import tensorflow as tf
    try:
        interpreter = tf.lite.Interpreter(model_path=str(output_path))
        interpreter.allocate_tensors()
        
        input_details = interpreter.get_input_details()
        output_details = interpreter.get_output_details()
        
        print("\n================== MiniFASNet TFLite Metadata ==================")
        print(f"Model File Size: {output_path.stat().st_size / (1024 * 1024):.2f} MB (Target: ~1.5 MB)")
        print("INPUT DETAILS:")
        print(f"  Shape: {input_details[0]['shape']}")
        print(f"  Type:  {input_details[0]['dtype']}")
        print("OUTPUT DETAILS:")
        print(f"  Shape: {output_details[0]['shape']}")
        print(f"  Type:  {output_details[0]['dtype']}")
        print("=================================================================\n")
        
        # Fast test inference
        input_shape = input_details[0]['shape']
        test_input = np.random.randn(*input_shape).astype(np.float32)
        interpreter.set_tensor(input_details[0]['index'], test_input)
        interpreter.invoke()
        test_output = interpreter.get_tensor(output_details[0]['index'])
        logger.info(f"Verification Success! Output probabilities: {test_output}")
        
    except Exception as e:
        logger.error(f"Failed to verify converted TFLite liveness model: {e}")
        sys.exit(1)

if __name__ == "__main__":
    main()
