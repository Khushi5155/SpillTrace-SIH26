import os
import json
import math
import numpy as np
import rasterio
import rasterio.features
import geopandas as gpd
from shapely.geometry import shape, Polygon

# --- CONFIGURATION (UPDATED FOR TEST FIXTURE) ---
SAR_PATH = "test3.tiff"
CLEAN_MASK_PATH = "day3_outputs/post_cleanup_mask_final.png"
PROB_PATH = "day1_output_results/test1_scene_pytorch_prob.tif"

# CHANGE 1: Output directory points to the new 002 sandbox folder
DAY4_DIR = "test_fixture_outputs/SPILL_TEST_FIXTURE_AIS_002"
os.makedirs(DAY4_DIR, exist_ok=True)

# 1. Load Data (Keeping this so script doesn't break, even if we override geometry later)
with rasterio.open(PROB_PATH) as src:
    transform = src.transform
    crs = src.crs or "EPSG:4326"
    prob_map = src.read(1)
    height, width = prob_map.shape

with rasterio.open(CLEAN_MASK_PATH) as src:
    clean_mask = (src.read(1) > 127).astype(np.uint8)

# 2. OVERRIDE: Injecting Synthetic Geometry for Gulf of Mexico
print("Injecting synthetic Test Fixture geometry for Gulf of Mexico...")

# Hardcoded coordinates from Pratyush's hint
centroid_lon = -90.480124
centroid_lat = 29.699723
# Increase offset from 0.005 to 0.05 to create a much larger ~10km polygon
offset = 0.05 

synthetic_polygon = Polygon([
    (centroid_lon - offset, centroid_lat - offset),
    (centroid_lon + offset, centroid_lat - offset),
    (centroid_lon + offset, centroid_lat + offset),
    (centroid_lon - offset, centroid_lat + offset),
    (centroid_lon - offset, centroid_lat - offset)
])

# Replace standard features array with our synthetic fixture
features = [{
    "slick_id": 1,
    "centroid": [centroid_lon, centroid_lat],
    "bounding_box": list(synthetic_polygon.bounds),
    "area_km2": 1.2, # Dummy metric for fixture
    "perimeter_m": 4440.0, # Dummy metric for fixture
    "orientation": 0.0,
    "compactness": 0.78,
    "confidence": 0.99,
    "geometry": synthetic_polygon
}]

# 3. Export GeoJSON
if features:
    # Force output CRS to standard EPSG:4326
    gdf = gpd.GeoDataFrame(features, crs="EPSG:4326")
    
    geojson_path = os.path.join(DAY4_DIR, "slick_geometry.geojson")
    gdf.to_file(geojson_path, driver="GeoJSON")
    print(f"Saved 1 synthetic test-fixture polygon to {geojson_path}")

# 4. Export Metadata Contract (UPDATED FOR TEST FIXTURE)
pixel_count_after = int(np.sum(clean_mask > 0))
pixel_count_before = 159232 

metadata = {
    # CHANGE 2: Update Spill ID to 002
    "spill_id": "SPILL_TEST_FIXTURE_AIS_002",
    
    # CHANGE 3: Update Timestamp to perfectly align with AIS window
    "acquisition_start_utc": "2025-01-08T00:10:00Z",
    "acquisition_end_utc": "2025-01-08T00:10:00Z",
    
    "sar_source": "Sentinel-1",
    "source_crs": "EPSG:4326",
    "output_crs": "EPSG:4326",
    "georeferencing_method": "injected_coordinates_for_prototype",
    "georeferencing_confidence": "prototype_scale",
    "detector_name": "SpillTrace_Team",
    "model_name": "ResNet50DeepLabV3Plus",
    "checkpoint": "oil_spill_seg_resnet_50_deeplab_v3%2B_80.pt",
    "model_status": "experimental",
    "oil_class_index": 1,
    "classification_method": "pixelwise_argmax_with_threshold",
    "probability_threshold": 0.30,
    "morphology_parameters": "MORPH_OPEN(3x3) -> MORPH_CLOSE(5x5) -> MIN_AREA(100px)",
    "pixel_count_before_cleanup": pixel_count_before,
    "pixel_count_after_cleanup": pixel_count_after,
    "number_of_components": 1,
    "area_method": "geodesic_approximation",
    "total_area_km2": 1.2,
    "total_perimeter_m": 4440.0,
    
    # CHANGE 4: Add mandatory Legal/Safety tags
    "data_mode": "TEST_FIXTURE",
    "scenario_type": "Analyst Parameter-Driven Scenario Simulation",
    "timestamp_verification": False
}

with open(os.path.join(DAY4_DIR, "slick_geometry_metadata.json"), "w") as f:
    json.dump(metadata, f, indent=4)
print("Saved Day 4 metadata contract.")