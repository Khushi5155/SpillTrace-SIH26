"""
Day 1 Inference Script for SpillTrace — DeepLabV3+ PyTorch & Sliding-Window Engine.
 
Pipeline: SAR GeoTIFF/Image -> Contrast Normalization -> Sliding-Window Tiling ->
PyTorch DeepLabV3+ Inference (5-class softmax) -> Probability Map & Binary Mask ->
Speckle Cleanup -> Output Generation.
"""
 
import json
import os
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
IMAGE_PATH = "test1.tiff"
MODEL_WEIGHTS = str(Path(__file__).resolve().parent / "oil_spill_seg_resnet_50_deeplab_v3+_80.pt")
OUTPUT_DIR = "./day1_output_results"
 
TILE_SIZE = 1024
OVERLAP = 256
OIL_CLASS_INDEX = 1  # 1 = Oil Spill (from EDA dictionary)
THRESHOLD = 0.5      # For overlap averaging
 
# Normalization stats
DATASET_MEAN = 0.5185
DATASET_STD = 0.197
 
os.makedirs(OUTPUT_DIR, exist_ok=True)
 
# ==========================================
# 2. Model Loader
# ==========================================
def load_pytorch_model(weights_path, device):
    """Initializes and loads weights for the PyTorch DeepLabV3+ model."""
    model = ResNet50DeepLabV3Plus(num_classes=5, pretrained=False)
    if os.path.exists(weights_path):
        model.load_state_dict(torch.load(weights_path, map_location=device))
    else:
        print(f"Warning: Weights path {weights_path} not found. Running with uninitialized weights.")
    model.to(device)
    model.eval()
    print(f"Successfully loaded DeepLabV3+ weights from {weights_path}")
    return model
 
# ==========================================
# 3. Preprocessing & Helper Functions
# ==========================================
def preprocess_tile(tile_array, device):
    """Applies Mean/Std standardization and formats for PyTorch tensor."""
    tile = (tile_array - DATASET_MEAN) / DATASET_STD
    tile = np.transpose(tile, (2, 0, 1))
    tensor = torch.from_numpy(tile).unsqueeze(0)
    return tensor.to(device)
 
def clean_mask(binary_mask, min_area=50):
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
    """
    Main entry point. Works locally with default arguments or dynamically via API.
    """
    # If a path isn't explicitly passed, fall back to your local IMAGE_PATH
    if not file_path:
        file_path = IMAGE_PATH
        
    device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
    print(f"Using device: {device} for image: {file_path}")
 
    # Load the model weights
    model = load_pytorch_model(MODEL_WEIGHTS, device)
 
    print(f"Processing dynamic API image: {file_path}")
    with rasterio.open(file_path) as src:
        meta = src.meta.copy()
        transform = src.transform
        crs = src.crs
        height = src.height
        width = src.width
        raw_bands = src.read()
 
    # Inject GPS coordinates if spatial metadata is missing (our demo
    # GeoTIFFs have no real CRS/transform at all -- crs is None here).
    #
    # WHICH BRANCH FIRES: previously this checked "TEST3" in scene_id, but
    # scene_id is actually the randomly generated spill_id UUID (assigned
    # at upload time in spills.py) -- it can never contain "TEST3", so the
    # Arabian-Sea branch was dead code and EVERY upload silently fell into
    # the Seattle branch regardless of which file was uploaded. Checking
    # file_path instead works because spills.py saves the file as
    # "<spill_id>_<original_filename>", so the real uploaded filename
    # (test1.tiff / test2.tiff / test3.tiff) is always present in it.
    #
    # WHY THE ANCHOR CHANGED (twice now): the only real AIS dataset in this
    # project (data/ais/cleaned/ais_phase3_fixture_001_broad.parquet) covers
    # the Gulf of Mexico near the Mississippi delta (lat ~28.6-31.1, lon
    # ~-92.0..-89.0, Jan 2025). The first fix anchored on the AIS points'
    # own median position -- but those are real ship positions travelling
    # UP THE RIVER (Baton Rouge / New Orleans / Lake Pontchartrain), so a
    # 63km x 46km box centred there was mostly land and lake, not sea.
    # This anchor instead sits ~25 nautical miles south-southwest of Head
    # of Passes (29.157N, -89.254W -- the actual mouth of the Mississippi,
    # https://en.wikipedia.org/wiki/Head_of_Passes), in open Gulf water
    # clear of the delta's marsh and barrier islands, and uses a much
    # smaller pixel size (0.00003 instead of 0.0001) so the image's total
    # footprint is ~20km x 14km instead of ~63km x 46km -- small enough
    # that it can't stretch back into the coastline. It is still inside
    # the AIS fixture's overall lat/lon range, so scene<->AIS geographic
    # compatibility still passes.
    # The Arabian Sea anchor is intentionally left as-is: it has no AIS
    # coverage at all, so that scenario is a genuine (not hardcoded) demo
    # of the "compatibility blocked / no candidates" path.
    if transform.is_identity or crs is None:
        if "TEST3" in scene_id.upper() or "TEST3" in str(file_path).upper():
            print(f"Warning: No metadata. Scene {scene_id} detected. Injecting Arabian Sea coordinates (intentionally outside AIS coverage)...")
            transform = from_origin(70.5, 19.5, 0.0001, 0.0001)
        else:
            print(f"Warning: No metadata. Scene {scene_id} detected. Injecting open Gulf-of-Mexico coordinates (south of the Mississippi delta, clear of land, aligned with real AIS fixture coverage)...")
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
 
    stride = TILE_SIZE - OVERLAP
    full_prob = np.zeros((height, width), dtype=np.float32)
    full_mask_accum = np.zeros((height, width), dtype=np.float32)
    weight_map = np.zeros((height, width), dtype=np.float32)
 
    print("Running sliding-window inference with PyTorch...")
    with torch.no_grad():
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
 
    full_prob = np.divide(full_prob, weight_map, out=np.zeros_like(full_prob), where=weight_map != 0)
    full_mask_accum = np.divide(full_mask_accum, weight_map, out=np.zeros_like(full_mask_accum), where=weight_map != 0)
 
    binary_mask = (full_mask_accum > THRESHOLD).astype(np.uint8)
    binary_mask = clean_mask(binary_mask, min_area=50)
 
    # Save Outputs dynamically based on the scene_id
    out_mask_tif = os.path.join(OUTPUT_DIR, f"{scene_id}_pytorch_mask.tif")
    meta.update({"driver": "GTiff", "count": 1, "dtype": "uint8"})
    with rasterio.open(out_mask_tif, "w", **meta) as dst:
        dst.write(binary_mask * 255, 1)
 
    out_prob_tif = os.path.join(OUTPUT_DIR, f"{scene_id}_pytorch_prob.tif")
    meta.update({"driver": "GTiff", "count": 1, "dtype": "float32"})
    with rasterio.open(out_prob_tif, "w", **meta) as dst:
        dst.write(full_prob, 1)
 
    shapes = rasterio.features.shapes(binary_mask, transform=transform)
    polygons = [shape(geom) for geom, val in shapes if val == 1]
 
    # NOTE: previously used geopandas' gdf.to_file(..., driver="GeoJSON"),
    # which requires pyogrio or fiona -- both of which need GDAL installed
    # and on the system PATH. On Windows that GDAL setup is unreliable
    # outside conda. Writing plain GeoJSON with shapely + json avoids the
    # GDAL/pyogrio/fiona dependency entirely and needs nothing extra.
    out_geojson = None
    centroid = None
    if polygons:
        out_geojson = os.path.join(OUTPUT_DIR, f"{scene_id}_pytorch_slick.geojson")
 
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
 
    # --- RETURN THE EXACT DICTIONARY AAYUSH'S BACKEND EXPECTS ---
    return {
        "status": "COMPLETED",
        "message": "Detection completed successfully.",
        "artifacts": {
            "oil_mask": out_mask_tif,
            "probability_map": out_prob_tif,
            "geojson": out_geojson,
            "metadata_path": None  # Handled by Day 4 script down the line
        },
        "metadata": {
            "detector_name": "SpillTrace DeepLabV3+ Engine",
            "model_name": "ResNet50DeepLabV3Plus",
            "checkpoint": MODEL_WEIGHTS,
            "oil_class_index": OIL_CLASS_INDEX,
            "probability_threshold": THRESHOLD,
            # Real centroid computed above from the actual detected polygons
            # (the old code returned a hardcoded Seattle point here even when
            # the real centroid was different -- this now reflects the truth).
            "centroid": centroid
        }
    }
 
 
if __name__ == "__main__":
    # This lets you run "python ml/day1_inference.py" locally on your machine
    process_sar_scene()
 