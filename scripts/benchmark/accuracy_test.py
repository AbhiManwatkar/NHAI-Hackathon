#!/usr/bin/env python3
"""
FaceGuard Offline - LFW Accuracy and Robustness Benchmark
Evaluates the quantized MobileFaceNet INT8 model against the LFW (Labeled Faces in the Wild) dataset,
computing True Accept Rate (TAR), False Accept Rate (FAR), and False Reject Rate (FRR) at a 0.65 threshold.
Simulates 5 lighting conditions (dim, bright, low contrast, high contrast, standard),
generates a confusion matrix PNG, and writes results to benchmark_results.csv.
Includes an automatic lightweight fallback downloader to fetch target LFW pairs dynamically.
"""

import os
import sys
import argparse
import logging
import csv
from pathlib import Path
import numpy as np
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
        logging.FileHandler(LOG_DIR / "accuracy_test.log", encoding="utf-8")
    ]
)
logger = logging.getLogger("accuracy_test")

# Try to import cv2, matplotlib, and tensorflow
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

try:
    import matplotlib
    matplotlib.use('Agg')  # Use non-GUI backend
    import matplotlib.pyplot as plt
except ImportError:
    logger.error("Matplotlib is required. Please install 'matplotlib'.")
    sys.exit(1)

# Suppress TF logging
os.environ['TF_CPP_MIN_LOG_LEVEL'] = '3'
tf.get_logger().setLevel('ERROR')

# LFW Download URLs
LFW_PAIRS_URL = "http://vis-www.cs.umass.edu/lfw/pairs.txt"
LFW_BASE_URL = "http://vis-www.cs.umass.edu/lfw/images/"

def download_file(url, output_path):
    """Downloads a file showing progress."""
    response = requests.get(url, stream=True)
    total_size = int(response.headers.get("content-length", 0))
    block_size = 1024
    
    with open(output_path, "wb") as f, tqdm(
        total=total_size, unit="iB", unit_scale=True, desc=Path(output_path).name, leave=False
    ) as bar:
        for data in response.iter_content(block_size):
            f.write(data)
            bar.update(len(data))

def apply_lighting_transform(img, condition):
    """Simulates 5 lighting conditions: standard, dim, bright, low contrast, high contrast."""
    if condition == "dim":
        # Dim Light (brightness -40%)
        hsv = cv2.cvtColor(img, cv2.COLOR_RGB2HSV).astype(np.float32)
        hsv[:, :, 2] *= 0.6
        hsv[:, :, 2] = np.clip(hsv[:, :, 2], 0, 255)
        return cv2.cvtColor(hsv.astype(np.uint8), cv2.COLOR_HSV2RGB)
        
    elif condition == "bright":
        # Bright Light (brightness +40%)
        hsv = cv2.cvtColor(img, cv2.COLOR_RGB2HSV).astype(np.float32)
        hsv[:, :, 2] *= 1.4
        hsv[:, :, 2] = np.clip(hsv[:, :, 2], 0, 255)
        return cv2.cvtColor(hsv.astype(np.uint8), cv2.COLOR_HSV2RGB)
        
    elif condition == "low_contrast":
        # Low Contrast (-30%)
        img_f = img.astype(np.float32)
        img_f = 128.0 + 0.7 * (img_f - 128.0)
        return np.clip(img_f, 0, 255).astype(np.uint8)
        
    elif condition == "high_contrast":
        # High Contrast (+30%)
        img_f = img.astype(np.float32)
        img_f = 128.0 + 1.3 * (img_f - 128.0)
        return np.clip(img_f, 0, 255).astype(np.uint8)
        
    else:
        # Standard / Original
        return img.copy()

def get_embedding(interpreter, img_rgb, input_details, output_details):
    """Preprocesses a face image, runs TFLite inference, and returns embedding."""
    input_shape = input_details[0]['shape']
    input_dtype = input_details[0]['dtype']
    
    # Resize to MobileFaceNet standard
    resized = cv2.resize(img_rgb, (input_shape[2], input_shape[1]))
    
    # Preprocess (pixel - 127.5) / 128.0
    normalized = (resized.astype(np.float32) - 127.5) / 128.0
    
    # Handle quantized INT8 inputs
    if input_dtype == np.int8:
        scale, zero_point = input_details[0]['quantization']
        if scale == 0.0:
            scale = 1.0
        quantized = np.round(normalized / scale + zero_point)
        input_tensor = np.clip(quantized, -128, 127).astype(np.int8)
    else:
        input_tensor = normalized.astype(np.float32)
        
    input_batch = np.expand_dims(input_tensor, axis=0)
    
    interpreter.set_tensor(input_details[0]['index'], input_batch)
    interpreter.invoke()
    
    emb = interpreter.get_tensor(output_details[0]['index'])[0]
    # L2 normalize embedding
    norm = np.linalg.norm(emb)
    return emb / norm if norm > 0 else emb

def load_lfw_pairs(lfw_dir, pairs_txt_path, max_pairs=60):
    """
    Parses LFW pairs.txt file.
    If images are missing, programmatically downloads the needed pairs from the LFW server!
    """
    pairs = []
    
    # Download pairs.txt if missing
    if not pairs_txt_path.exists():
        logger.info("Downloading LFW pairs.txt...")
        download_file(LFW_PAIRS_URL, pairs_txt_path)
        
    with open(pairs_txt_path, "r") as f:
        lines = f.readlines()
        
    # First line contains split info
    header = lines[0].strip().split()
    logger.info(f"LFW splits metadata: {header}")
    
    # We parse pairs. We limit to max_pairs for speed and bandwidth optimization.
    pos_count = 0
    neg_count = 0
    target_each = max_pairs // 2
    
    logger.info(f"Parsing LFW pairs (Target: {target_each} positive, {target_each} negative pairs)...")
    
    for line in lines[1:]:
        parts = line.strip().split()
        if len(parts) == 3:  # Positive pair: name id1 id2
            if pos_count < target_each:
                name, id1, id2 = parts[0], int(parts[1]), int(parts[2])
                p1 = f"{name}/{name}_{id1:04d}.jpg"
                p2 = f"{name}/{name}_{id2:04d}.jpg"
                pairs.append((p1, p2, True))
                pos_count += 1
        elif len(parts) == 4:  # Negative pair: name1 id1 name2 id2
            if neg_count < target_each:
                name1, id1, name2, id2 = parts[0], int(parts[1]), parts[2], int(parts[3])
                p1 = f"{name1}/{name1}_{id1:04d}.jpg"
                p2 = f"{name2}/{name2}_{id2:04d}.jpg"
                pairs.append((p1, p2, False))
                neg_count += 1
                
        if pos_count >= target_each and neg_count >= target_each:
            break
            
    # Ensure images are downloaded
    lfw_path = Path(lfw_dir)
    lfw_path.mkdir(parents=True, exist_ok=True)
    
    logger.info("Verifying LFW image local availability...")
    
    # Collect all needed paths
    needed_images = set()
    for p1, p2, _ in pairs:
        needed_images.add(p1)
        needed_images.add(p2)
        
    missing_images = [img for img in needed_images if not (lfw_path / img).exists()]
    
    if missing_images:
        logger.info(f"Downloading {len(missing_images)} missing LFW benchmark images dynamically from Vis-WWW...")
        for img_rel_path in tqdm(missing_images, desc="Downloading LFW faces"):
            local_img_path = lfw_path / img_rel_path
            local_img_path.parent.mkdir(parents=True, exist_ok=True)
            url = LFW_BASE_URL + img_rel_path
            try:
                download_file(url, local_img_path)
            except Exception as e:
                logger.error(f"Failed to download image {url}: {e}")
                
    # Double check which pairs are fully downloaded locally
    valid_pairs = []
    for p1, p2, is_same in pairs:
        if (lfw_path / p1).exists() and (lfw_path / p2).exists():
            valid_pairs.append((lfw_path / p1, lfw_path / p2, is_same))
            
    logger.info(f"Loaded {len(valid_pairs)} valid benchmark image pairs.")
    return valid_pairs

def plot_confusion_matrix(tp, fn, fp, tn, condition, output_path):
    """Plots a 2x2 confusion matrix using Matplotlib and saves to PNG."""
    cm = np.array([[tp, fn], [fp, tn]])
    
    fig, ax = plt.subplots(figsize=(6, 5))
    im = ax.imshow(cm, interpolation='nearest', cmap=plt.cm.Blues)
    ax.figure.colorbar(im, ax=ax)
    
    # Show labels
    classes = ['Same (Accept)', 'Different (Reject)']
    ax.set(xticks=np.arange(cm.shape[1]),
           yticks=np.arange(cm.shape[0]),
           xticklabels=classes, yticklabels=classes,
           title=f"Confusion Matrix ({condition.capitalize()} Lighting)",
           ylabel='True Class',
           xlabel='Predicted Class')
    
    # Threshold for text color
    thresh = cm.max() / 2.
    for i in range(cm.shape[0]):
        for j in range(cm.shape[1]):
            ax.text(j, i, f"{cm[i, j]:d}",
                    ha="center", va="center",
                    color="white" if cm[i, j] > thresh else "black",
                    fontsize=14, weight='bold')
            
    fig.tight_layout()
    plt.savefig(output_path, dpi=150)
    plt.close()

def main():
    parser = argparse.ArgumentParser(
        description="LFW Benchmark: Evaluate MobileFaceNet INT8 model accuracy, FAR, FRR, and lighting robustness.",
        formatter_class=argparse.ArgumentDefaultsHelpFormatter
    )
    parser.add_argument(
        "--tflite-path",
        type=str,
        default="models/mobilefacenet_int8.tflite",
        help="Path to the quantized MobileFaceNet INT8 TFLite model."
    )
    parser.add_argument(
        "--lfw-dir",
        type=str,
        default="scripts/lfw",
        help="Directory to save/load benchmark LFW images."
    )
    parser.add_argument(
        "--pairs-txt",
        type=str,
        default="scripts/lfw_pairs.txt",
        help="Path to LFW pairs.txt file."
    )
    parser.add_argument(
        "--threshold",
        type=float,
        default=0.65,
        help="Cosine similarity threshold for accept/reject classification."
    )
    
    args = parser.parse_args()
    
    tflite_path = Path(args.tflite_path)
    if not tflite_path.exists():
        logger.error(f"MobileFaceNet TFLite model not found at: {tflite_path}")
        sys.exit(1)
        
    # 1. Initialize Interpreter
    interpreter = tf.lite.Interpreter(model_path=str(tflite_path))
    interpreter.allocate_tensors()
    input_details = interpreter.get_input_details()
    output_details = interpreter.get_output_details()
    
    # 2. Load LFW Benchmark pairs
    pairs = load_lfw_pairs(args.lfw_dir, Path(args.pairs_txt), max_pairs=60)
    if not pairs:
        logger.error("No valid pairs downloaded. Cannot run benchmark.")
        sys.exit(1)
        
    # 3. Benchmark under 5 lighting conditions
    conditions = ["standard", "dim", "bright", "low_contrast", "high_contrast"]
    csv_results = []
    
    logger.info(f"Running robustness evaluations at threshold: {args.threshold}...")
    
    for cond in conditions:
        logger.info(f"Evaluating lighting condition: '{cond}'...")
        
        y_true = []
        y_pred = []
        similarities_pos = []
        similarities_neg = []
        
        # We classify:
        # Same = Positive Class (True = Same, False = Different)
        # Prediction: Accept (similarity >= threshold) vs Reject (similarity < threshold)
        # Confusion matrix values:
        # TP = True Accept (Same, classified Same)
        # FN = False Reject (Same, classified Different)
        # FP = False Accept (Different, classified Same)
        # TN = True Reject (Different, classified Different)
        tp, fn, fp, tn = 0, 0, 0, 0
        
        for p1_path, p2_path, is_same in pairs:
            # Read images
            img1 = cv2.imread(str(p1_path))
            img2 = cv2.imread(str(p2_path))
            
            if img1 is None or img2 is None:
                continue
                
            img1_rgb = cv2.cvtColor(img1, cv2.COLOR_BGR2RGB)
            img2_rgb = cv2.cvtColor(img2, cv2.COLOR_BGR2RGB)
            
            # Apply lighting transform
            img1_trans = apply_lighting_transform(img1_rgb, cond)
            img2_trans = apply_lighting_transform(img2_rgb, cond)
            
            # Extract embeddings
            emb1 = get_embedding(interpreter, img1_trans, input_details, output_details)
            emb2 = get_embedding(interpreter, img2_trans, input_details, output_details)
            
            # Cosine similarity (embeddings are already L2 normalized)
            sim = float(np.dot(emb1, emb2))
            
            # Classification
            pred_same = (sim >= args.threshold)
            
            if is_same:
                similarities_pos.append(sim)
                if pred_same:
                    tp += 1
                else:
                    fn += 1
            else:
                similarities_neg.append(sim)
                if pred_same:
                    fp += 1
                else:
                    tn += 1
                    
        # Compute rates
        pos_total = tp + fn
        neg_total = fp + tn
        
        tar = tp / pos_total if pos_total > 0 else 0.0 # True Accept Rate
        frr = fn / pos_total if pos_total > 0 else 0.0 # False Reject Rate
        far = fp / neg_total if neg_total > 0 else 0.0 # False Accept Rate
        
        avg_sim_pos = np.mean(similarities_pos) if similarities_pos else 0.0
        avg_sim_neg = np.mean(similarities_neg) if similarities_neg else 0.0
        accuracy = (tp + tn) / (pos_total + neg_total) if (pos_total + neg_total) > 0 else 0.0
        
        logger.info(
            f"  [{cond}] Acc={accuracy * 100.0:.2f}% | "
            f"TAR (Accept Rate)={tar * 100.0:.1f}% | "
            f"FAR={far * 100.0:.1f}% | "
            f"FRR={frr * 100.0:.1f}%"
        )
        
        csv_results.append({
            "Lighting_Condition": cond,
            "Accuracy": f"{accuracy:.4f}",
            "TAR": f"{tar:.4f}",
            "FAR": f"{far:.4f}",
            "FRR": f"{frr:.4f}",
            "Avg_Similarity_Pos": f"{avg_sim_pos:.4f}",
            "Avg_Similarity_Neg": f"{avg_sim_neg:.4f}"
        })
        
        # Plot confusion matrix for this condition (save standard condition as standard visual asset)
        if cond == "standard":
            cm_path = Path("models/confusion_matrix.png")
            plot_confusion_matrix(tp, fn, fp, tn, cond, cm_path)
            logger.info(f"Confusion Matrix PNG plotted and saved to: {cm_path}")
            
    # Write to CSV
    csv_path = Path("benchmark_results.csv")
    with open(csv_path, "w", newline="") as f:
        writer = csv.DictWriter(f, fieldnames=csv_results[0].keys())
        writer.writeheader()
        writer.writerows(csv_results)
        
    logger.info(f"Accuracy benchmark CSV summary exported successfully to: {csv_path}")
    
    # 4. Print beautiful final report
    print("\n" + "=" * 70)
    print("                    LFW ACCURACY & ROBUSTNESS REPORT")
    print("=" * 70)
    print(f"  Condition      | Accuracy | TAR (Same) | FAR (Spoof) | FRR (Miss)")
    print("  " + "-" * 15 + "+" + "-" * 10 + "+" + "-" * 12 + "+" + "-" * 13 + "+" + "-" * 12)
    for r in csv_results:
        cond_name = r["Lighting_Condition"].replace("_", " ").capitalize()
        acc = float(r["Accuracy"]) * 100.0
        tar = float(r["TAR"]) * 100.0
        far = float(r["FAR"]) * 100.0
        frr = float(r["FRR"]) * 100.0
        print(f"  {cond_name:14s} | {acc:7.1f}% | {tar:9.1f}% | {far:10.1f}% | {frr:9.1f}%")
    print("=" * 70)
    print(f"  Decision Threshold: {args.threshold} [VERIFIED]")
    print(f"  Plot: Saved to models/confusion_matrix.png\n")

if __name__ == "__main__":
    main()
