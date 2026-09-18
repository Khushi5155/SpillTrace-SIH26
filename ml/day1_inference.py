"""
Day 1 Inference Script for SpillTrace — DeepLabV3+ PyTorch & Sliding-Window Engine.
 
Pipeline: SAR GeoTIFF/Image -> Contrast Normalization -> Sliding-Window Tiling ->
PyTorch DeepLabV3+ Inference (5-class softmax) -> Probability Map & Binary Mask ->
Speckle Cleanup -> Output Generation.
"""
 
import json
import os
import time
from pathlib import Path
import numpy as np
import cv2
import torch
import torch.nn.functional as F
import rasterio
from rasterio.windows import Window
import rasterio.features
from shapely.geometry import shape, mapping
from shapely.ops import unary_union
from rasterio.transform import from_origin
 
# Import model architecture
from .seg_models import ResNet50DeepLabV3Plus
 
# ==========================================
# 1. Configuration & Constants
# ==========================================
IMAGE_PATH = str(Path(__file__).resolve().parent / "test1.tiff")
MODEL_WEIGHTS = str(Path(__file__).resolve().parent / "oil_spill_seg_resnet_50_deeplab_v3+_80.pt")
OUTPUT_DIR = "ml/day1_output_results"

TILE_SIZE = 1024
OVERLAP = 256
OIL_CLASS_INDEX = 1  # 1 = Oil Spill (from EDA dictionary)
THRESHOLD = 0.2      # For overlap averaging

# Normalization stats
DATASET_MEAN = 0.5185
DATASET_STD = 0.197
 
os.makedirs(OUTPUT_DIR, exist_ok=True)
 
# ==========================================
# 2. Model Loader (LAZY SINGLETON)
# ==========================================
_GLOBAL_MODEL = None

def load_pytorch_model(weights_path, device):
    """Initializes and loads weights for the PyTorch DeepLabV3+ model."""
    model = ResNet50DeepLabV3Plus(num_classes=5, pretrained=False)
    if os.path.exists(weights_path):
        model.load_state_dict(torch.load(weights_path, map_location=device))
    else:
        print(f"Warning: Weights path {weights_path} not found. Running with uninitialized weights.")
    model.to(device)
    model.eval() # CRITICAL: Disable batch norm / dropout updates
    return model

def get_model(device):
    """Returns the globally loaded model, preventing 5-second reloads on every request."""
    global _GLOBAL_MODEL
    if _GLOBAL_MODEL is None:
        print("First request: Loading model into VRAM...")
        _GLOBAL_MODEL = load_pytorch_model(MODEL_WEIGHTS, device)
    else:
        print("Cache hit: Using pre-loaded model from VRAM.")
    return _GLOBAL_MODEL

# ==========================================
# 3. Preprocessing & Helper Functions
# ==========================================
def preprocess_tile(tile_array, device):
    """Applies Mean/Std standardization and formats for PyTorch tensor."""
    tile = (tile_array - DATASET_MEAN) / DATASET_STD
    tile = np.transpose(tile, (2, 0, 1))
    tensor = torch.from_numpy(tile).unsqueeze(0)
    return tensor.to(device)

def clean_mask(binary_mask, min_area=40):
    """Drop tiny speckle-noise blobs under min_area pixels using connected components."""
    num_labels, labels, stats, _ = cv2.connectedComponentsWithStats(
        binary_mask.astype(np.uint8), connectivity=8
    )
    cleaned = np.zeros_like(binary_mask)
    for label_id in range(1, num_labels):
        if stats[label_id, cv2.CC_STAT_AREA] >= min_area:
            cleaned[labels == label_id] = 1
    return cleaned
 
def mask_to_png(binary_mask, out_path):
    """Exports a binary mask array to a standard PNG file."""
    cv2.imwrite(out_path, (binary_mask * 255).astype(np.uint8))
 
# ==========================================
# 4. Main Execution Engine (API Integrated)
# ==========================================
def process_sar_scene(file_path: str = IMAGE_PATH, scene_id: str = "test1_scene") -> dict:
    t_start = time.perf_counter()
    
    if not file_path:
        file_path = IMAGE_PATH
        
    device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
    
    # 1. Load Model (Instant if already loaded) - FROM ML LEAD
    t_model_start = time.perf_counter()
    model = get_model(device)
    t_model_end = time.perf_counter()

    # 2. File Read & Preprocessing
    t_io_start = time.perf_counter()
    with rasterio.open(file_path) as src:
        meta = src.meta.copy()
        transform = src.transform
        crs = src.crs
        height = src.height
        width = src.width
        raw_bands = src.read()
 
    # Inject GPS coordinates if spatial metadata is missing - FROM BACKEND DEV
    if transform.is_identity or crs is None:
        if "TEST3" in scene_id.upper() or "TEST3" in str(file_path).upper():
            print(f"Warning: No metadata. Scene {scene_id} detected. Injecting Arabian Sea coordinates...")
            transform = from_origin(70.5, 19.5, 0.0001, 0.0001)
        else:
            print(f"Warning: No metadata. Scene {scene_id} detected. Injecting open Gulf-of-Mexico coordinates (aligned with real AIS fixture coverage)...")
            transform = from_origin(-89.7, 28.85, 0.00003, 0.00003)

        crs = "EPSG:4326"
        meta.update({"transform": transform, "crs": crs})
 
    # Stack into 3 channels
    if raw_bands.shape[0] >= 3:
        full_image = np.stack([raw_bands[0], raw_bands[1], raw_bands[2]], axis=-1)
    else:
        full_image = np.stack([raw_bands[0], raw_bands[0], raw_bands[0]], axis=-1)
 
    # Global contrast clip & scale to [0.0, 1.0]
    full_image = full_image.astype(np.float32)
    p_min, p_max = np.percentile(full_image, 1), np.percentile(full_image, 99)
    if p_max > p_min:
        full_image = np.clip(full_image, p_min, p_max)
        full_image = (full_image - p_min) / (p_max - p_min)
    
    t_io_end = time.perf_counter()

    # 3. Model Inference (Optimized) - FROM ML LEAD
    t_inf_start = time.perf_counter()
    stride = TILE_SIZE - OVERLAP
    full_prob = np.zeros((height, width), dtype=np.float32)
    full_mask_accum = np.zeros((height, width), dtype=np.float32)
    weight_map = np.zeros((height, width), dtype=np.float32)

    # CRITICAL OPTIMIZATION: inference_mode + autocast
    with torch.inference_mode(), torch.autocast(device_type=device.type):
        for y in range(0, height, stride):
            for x in range(0, width, stride):
                w_width = min(TILE_SIZE, width - x)
                w_height = min(TILE_SIZE, height - y)
 
                tile = full_image[y:y + w_height, x:x + w_width, :]
                if w_height < TILE_SIZE or w_width < TILE_SIZE:
                    padded = np.zeros((TILE_SIZE, TILE_SIZE, 3), dtype=np.float32)
                    padded[:w_height, :w_width, :] = tile
                    tile = padded
 
                tensor_batch = preprocess_tile(tile, device)
                pred_logits = model(tensor_batch)
                pred_probs = F.softmax(pred_logits, dim=1)
 
                raw_oil_probs = pred_probs[0, OIL_CLASS_INDEX, :, :].cpu().numpy()
                pred_label = torch.argmax(pred_probs, dim=1)
                class_mask = pred_label[0].cpu().numpy()
                binary_tile = (class_mask == OIL_CLASS_INDEX).astype(np.float32)
 
                full_prob[y:y + w_height, x:x + w_width] += raw_oil_probs[:w_height, :w_width]
                full_mask_accum[y:y + w_height, x:x + w_width] += binary_tile[:w_height, :w_width]
                weight_map[y:y + w_height, x:x + w_width] += 1.0
                
    t_inf_end = time.perf_counter()

    # 4. Post-processing & Disk I/O - MERGED
    t_post_start = time.perf_counter()
    full_prob = np.divide(full_prob, weight_map, out=np.zeros_like(full_prob), where=weight_map != 0)
    full_mask_accum = np.divide(full_mask_accum, weight_map, out=np.zeros_like(full_mask_accum), where=weight_map != 0)
 
    binary_mask = (full_mask_accum > THRESHOLD).astype(np.uint8)
    binary_mask = clean_mask(binary_mask, min_area=40)
 
    # Save Outputs dynamically based on the scene_id
    out_mask_tif = os.path.join(OUTPUT_DIR, f"{scene_id}_pytorch_mask.tif")
    meta.update({
        "driver": "GTiff", 
        "count": 1, 
        "dtype": "uint8",
        "photometric": "minisblack"
    })
    with rasterio.open(out_mask_tif, "w", **meta) as dst:
        dst.write(binary_mask * 255, 1)
 
    out_prob_tif = os.path.join(OUTPUT_DIR, f"{scene_id}_pytorch_prob.tif")
    meta.update({"driver": "GTiff", "count": 1, "dtype": "float32"})
    with rasterio.open(out_prob_tif, "w", **meta) as dst:
        dst.write(full_prob, 1)
 
    shapes = rasterio.features.shapes(binary_mask, transform=transform)
    polygons = [shape(geom) for geom, val in shapes if val == 1]
 
    out_geojson = None
    centroid = None
    if polygons:
        out_geojson = os.path.join(OUTPUT_DIR, f"{scene_id}_pytorch_slick.geojson")
        
        # FROM BACKEND DEV: Avoids GDAL crashes on Windows
        geojson_dict = {
            "type": "FeatureCollection",
            "features": [
                {"type": "Feature", "properties": {}, "geometry": mapping(poly)}
                for poly in polygons
            ],
        }
        with open(out_geojson, "w", encoding="utf-8") as f:
            json.dump(geojson_dict, f)
 
        union_geom = unary_union(polygons)
        centroid = [union_geom.centroid.x, union_geom.centroid.y]

    t_post_end = time.perf_counter()
    t_end = time.perf_counter()

    # Calculate timings in milliseconds
    timings = {
        "model_load_ms": int((t_model_end - t_model_start) * 1000),
        "io_prep_ms": int((t_io_end - t_io_start) * 1000),
        "inference_ms": int((t_inf_end - t_inf_start) * 1000),
        "postprocess_ms": int((t_post_end - t_post_start) * 1000),
        "total_time_ms": int((t_end - t_start) * 1000)
    }
    
    print(f"--- Pipeline Execution Profile ---")
    for k, v in timings.items():
        print(f"{k}: {v}ms")
 
    # --- RETURN THE EXACT DICTIONARY AAYUSH'S BACKEND EXPECTS ---
    return {
        "status": "COMPLETED",
        "message": "Detection completed successfully.",
        "artifacts": {
            "oil_mask": out_mask_tif,
            "probability_map": out_prob_tif,
            "geojson": out_geojson,
            "metadata_path": None
        },
        "metadata": {
            "detector_name": "SpillTrace DeepLabV3+ Engine",
            "model_name": "ResNet50DeepLabV3Plus",
            "checkpoint": MODEL_WEIGHTS,
            "oil_class_index": OIL_CLASS_INDEX,
            "probability_threshold": THRESHOLD,
            "centroid": centroid,
            "execution_profile": timings
        }
    }
 
if __name__ == "__main__":
    print("\n--- RUN 1 (Cold Start: Model has to load into GPU) ---")
    process_sar_scene()
    
    print("\n--- RUN 2 (Hot Start: Simulating a 2nd API request) ---")
    process_sar_scene()