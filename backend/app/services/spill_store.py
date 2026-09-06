from pathlib import Path

_SPILLS: dict[str, dict] = {}

def create_spill_record(spill_id: str, filename: str, stored_path: Path) -> dict:
    record = {
        "spill_id": spill_id,
        "filename": filename,
        "stored_path": str(stored_path.resolve()),
        "status": "uploaded",
    }
    _SPILLS[spill_id] = record
    return record

def get_spill_record(spill_id: str) -> dict | None:
    return _SPILLS.get(spill_id)

def update_spill_record(spill_id: str, **fields) -> dict | None:
    record = _SPILLS.get(spill_id)
    if not record:
        return None
    record.update(fields)
    return record