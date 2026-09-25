"""Normalize DistribusiAirBersih rows into one map location per coordinate."""
import datetime
import re


def build_water_locations(records):
    locations = {}
    skipped = 0
    for index, record in enumerate(records, start=2):
        row = {str(key).strip().casefold(): value for key, value in record.items()}
        text = lambda key: str(row.get(key, "") or "").strip()
        date = None
        for pattern in ("%d/%m/%Y", "%Y-%m-%d", "%d-%m-%Y"):
            try:
                date = datetime.datetime.strptime(text("tanggal"), pattern).date()
                break
            except ValueError:
                pass
        try:
            latitude, longitude = map(float, re.split(r"\s*[,;]\s*|\s+", text("koordinat").strip("()[]")))
            valid_position = -90 <= latitude <= 90 and -180 <= longitude <= 180
        except ValueError:
            valid_position = False
        if date is None or not valid_position:
            skipped += 1
            continue
        key = (latitude, longitude)
        if key not in locations:
            locations[key] = {"id": f"water-{latitude}-{longitude}", "name": text("lokasi") or "Distribusi Air Bersih",
                              "position": list(key), "distributions": []}
        locations[key]["distributions"].append({
            "id": f"water-row-{index}", "number": row.get("no.", ""),
            "date": date.isoformat(), "location": text("lokasi"),
            "village": text("kampung"), "district": text("kecamatan"),
            "households": row.get("jumlah kk", ""), "residents": row.get("jumlah warga", ""),
        })
    for location in locations.values():
        location["distributions"].sort(key=lambda entry: entry["date"])
    return list(locations.values()), skipped
