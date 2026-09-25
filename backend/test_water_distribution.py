import unittest
from water_distribution import build_water_locations


class WaterDistributionTests(unittest.TestCase):
    def row(self, **changes):
        return {"No.": 1, "Tanggal": "09/09/2026", "Lokasi": "Tanjung Pasir",
                "Kampung": "Kp. Gaga", "Kecamatan": "Teluknaga", "Jumlah KK": 320,
                "Jumlah Warga": 1280, "Koordinat": "-6.0350230,106.6561049", **changes}

    def test_same_coordinates_keep_all_dates_and_details_in_order(self):
        locations, skipped = build_water_locations([
            self.row(**{"Tanggal": "13/09/2026", "Jumlah KK": 375, "Jumlah Warga": 1500}),
            self.row(**{"Koordinat": " -6.035023, 106.65610490 "}),
            self.row(**{"Tanggal": "13/09/2026", "Kampung": "Kampung lain"}),
        ])
        self.assertEqual(skipped, 0)
        self.assertEqual(len(locations), 1)
        entries = locations[0]["distributions"]
        self.assertEqual([entry["date"] for entry in entries], ["2026-09-09", "2026-09-13", "2026-09-13"])
        self.assertEqual(entries[0]["village"], "Kp. Gaga")
        self.assertEqual(entries[1]["households"], 375)
        self.assertEqual(entries[1]["residents"], 1500)
        self.assertEqual(entries[2]["village"], "Kampung lain")

    def test_missing_invalid_dates_and_coordinates_are_skipped(self):
        rows = [self.row(**{"Tanggal": value}) for value in ("", "  ", "-", "31/02/2026")]
        rows += [self.row(**{"Koordinat": value}) for value in ("", "NaN,106", "-91,106", "-6,181")]
        locations, skipped = build_water_locations(rows + [self.row(), self.row(**{"Koordinat": "-6.1,106.7"})])
        self.assertEqual(skipped, 8)
        self.assertEqual(len(locations), 2)


if __name__ == '__main__':
    unittest.main()
