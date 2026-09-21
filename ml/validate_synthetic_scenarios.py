# ml/validate_synthetic_scenarios.py
import json
from pathlib import Path
import pandas as pd

for i in range(1, 6):
    s_id = f"SPILL_SYNTHETIC_DEMO_TEST{i}"
    base_path = Path(f"ml/synthetic_demo_outputs/{s_id}")
    
    if not base_path.exists():
        continue
        
    assert (base_path / "sar_input_metadata.json").exists()
    assert (base_path / "slick_geometry.geojson").exists()
    assert (base_path / "origin_corridor.geojson").exists()
    assert (base_path / "synthetic_ais_tracks.parquet").exists()
    
    df = pd.read_parquet(base_path / "synthetic_ais_tracks.parquet")
    assert len(df) >= 75
    assert df["mmsi"].nunique() >= 15
    assert df["is_synthetic"].all()
    
    print(f"✅ Validation passed for {s_id}")