import os
import sys
import argparse
import logging
import numpy as np
from tqdm import tqdm
from PIL import Image, ImageEnhance, ImageOps

# Setup logging
LOG_DIR = os.path.join(os.path.dirname(os.path.dirname(__file__)), 'logs')
os.makedirs(LOG_DIR, exist_ok=True)
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s [%(levelname)s] %(message)s',
    handlers=[
        logging.FileHandler(os.path.join(LOG_DIR, 'prepare_calibration_data.log')),
        logging.StreamHandler(sys.stdout)
    ]
)

def apply_augmentations(img):
    # Apply brightness ±40%
    brightness_factor = np.random.uniform(0.6, 1.4)
    img = ImageEnhance.Brightness(img).enhance(brightness_factor)
    
    # Apply contrast ±30%
    contrast_factor = np.random.uniform(0.7, 1.3)
    img = ImageEnhance.Contrast(img).enhance(contrast_factor)
    
    # Apply shadow overlay or harsh highlight
    if np.random.rand() > 0.5:
        # Shadow overlay (draw a dark gradient or patch)
        shadow = Image.new("L", img.size, color=0)
        # Simple linear gradient
        for y in range(img.size[1]):
            for x in range(img.size[0]):
                shadow.putpixel((x, y), int(120 * (x / img.size[0])))
        img = Image.composite(img, ImageOps.colorize(shadow, (0,0,0), (255,255,255)), shadow)
    else:
        # Harsh highlight
        highlight = Image.new("L", img.size, color=255)
        for y in range(img.size[1]):
            for x in range(img.size[0]):
                highlight.putpixel((x, y), int(255 - 150 * (y / img.size[1])))
        img = Image.blend(img, ImageOps.colorize(highlight, (0,0,0), (255,255,255)), 0.2)
        
    return img

def main():
    parser = argparse.ArgumentParser(description="Prepare calibration faces for MobileFaceNet post-training quantisation.")
    parser.add_argument('--count', type=int, default=200, help="Number of calibration images to generate.")
    parser.add_argument('--out_dir', type=str, default=None, help="Directory to save calibration images.")
    args = parser.parse_args()

    script_dir = os.path.dirname(os.path.abspath(__file__))
    project_root = os.path.dirname(os.path.dirname(script_dir))
    
    out_dir = args.out_dir
    if not out_dir:
        out_dir = os.path.join(project_root, 'scripts', 'calibration_faces')
    
    os.makedirs(out_dir, exist_ok=True)
    logging.info(f"Generating {args.count} synthetic calibration faces using South Asian demographics simulations (ITA values 20-55)...")
    
    # Create synthetic/augmented faces using procedural patterns to represent diverse demographics
    for i in tqdm(range(args.count), desc="Generating calibration dataset"):
        # Generate base skin tones matching Indian/South Asian ITA (Individual Typology Angle) range (20 to 55)
        # ITA range 20 to 55 corresponds to intermediate/tan/brown skin tones.
        ita = np.random.uniform(20, 55)
        # Convert ITA back to brown skin tone RGB representation
        r = int(140 + 2 * ita)
        g = int(90 + 1.8 * ita)
        b = int(60 + 1.5 * ita)
        
        # Draw a synthetic face-like structure
        img = Image.new("RGB", (112, 112), color=(r, g, b))
        # Add basic geometric features to simulate face structure (forehead, eyes, mouth)
        pixels = img.load()
        # Draw hair region
        for y in range(30):
            for x in range(112):
                if np.random.rand() > 0.1:
                    pixels[x, y] = (15, 10, 10)
        # Draw eyes region
        for x in [35, 77]:
            for dx in range(-6, 7):
                for dy in range(-3, 4):
                    pixels[x+dx, 50+dy] = (20, 15, 10)
        # Draw mouth region
        for x in range(40, 73):
            for dy in range(-2, 3):
                pixels[x, 80+dy] = (150, 70, 70)
                
        # Apply environmental augmentations (lighting, contrast, shadow, highlight)
        img = apply_augmentations(img)
        img.save(os.path.join(out_dir, f"calib_{i:03d}.png"))
        
    logging.info(f"Calibration data preparation complete. Saved to: {out_dir}")

if __name__ == '__main__':
    main()
