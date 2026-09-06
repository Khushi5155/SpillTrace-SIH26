"""
SpillTrace AIS Correlation Engine.

Loads the backward-drift origin corridor (GeoJSON) and intersects it with
historical AIS vessel data (CSV) to identify suspect ships that were 
present in the predicted origin zone.
"""

import os
import json
import pandas as pd
import geopandas as gpd
from shapely.geometry import Point

# ==========================================
# 1. Configuration & Constants
# ==========================================
# Ensure this matches the name in your directory
AIS_CSV_PATH = "ais_sample_10000.csv" 
CORRIDOR_PATH = "day5_outputs/origin_corridor.geojson"
OUTPUT_JSON = "ais_output_results/suspect_vessels.json"

def find_culprit_vessels():
    print("--- Initializing AIS Spatial Correlation Engine ---")
    
    # 1. Load the Hindcast Origin Corridor
    if not os.path.exists(CORRIDOR_PATH):
        print(f"Error: {CORRIDOR_PATH} not found. Run Day 5 hindcast first.")
        return

    corridor_gdf = gpd.read_file(CORRIDOR_PATH)
    # Extract the main polygon geometry
    origin_poly = corridor_gdf.geometry.iloc[0] 

    # 2. Load the AIS Dataset
    if not os.path.exists(AIS_CSV_PATH):
        print(f"Error: {AIS_CSV_PATH} not found.")
        return

    print("Loading AIS vessel data...")
    df_ais = pd.read_csv(AIS_CSV_PATH)

    # 3. Convert tabular AIS coordinates to spatial Points
    geometry = [Point(xy) for xy in zip(df_ais['longitude'], df_ais['latitude'])]
    ais_gdf = gpd.GeoDataFrame(df_ais, geometry=geometry, crs="EPSG:4326")

    # 4. Execute Spatial Intersection (Point-in-Polygon)
    print("Executing Point-in-Polygon spatial query...")
    suspects_gdf = ais_gdf[ais_gdf.geometry.within(origin_poly)]

    # 5. Process and Format the Results
    if suspects_gdf.empty:
        print("Result: No suspect vessels found in the origin corridor.")
        suspects = []
    else:
        print(f"CRITICAL MATCH: Found {len(suspects_gdf)} suspect vessel(s) inside the origin zone!")
        # Clean up the output by filling empty names with "UNKNOWN" and grabbing key columns
        suspects_gdf_clean = suspects_gdf[['mmsi', 'base_date_time', 'vessel_name', 'vessel_type', 'latitude', 'longitude']].fillna("UNKNOWN")
        suspects = suspects_gdf_clean.to_dict(orient="records")

    # 6. Generate Backend Payload
    os.makedirs(os.path.dirname(OUTPUT_JSON), exist_ok=True)
    payload = {
        "module": "SpillTrace AIS Correlation Engine",
        "status": "success",
        "suspect_count": len(suspects),
        "suspects": suspects,
        "notes": "Matched vessel locations against Day 5 hindcast origin corridor."
    }
    
    with open(OUTPUT_JSON, "w") as f:
        json.dump(payload, f, indent=4)

    print(f"Payload generated successfully: {OUTPUT_JSON}")

if __name__ == "__main__":
    find_culprit_vessels()