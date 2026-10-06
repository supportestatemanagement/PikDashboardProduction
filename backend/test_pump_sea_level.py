import unittest
from pump_sea_level import apply_sea_levels, sea_date


class SeaLevelTests(unittest.TestCase):
    def test_dates(self):
        self.assertEqual(sea_date('01-Apr-26'), '2026-04-01')
        self.assertEqual(sea_date('11-Mei-26'), '2026-05-11')

    def test_override_blank_fallback_and_midnight(self):
        rows = [{'date': '2026-04-01', 'time': '01:00', 'sea': 9},
                {'date': '2026-04-01', 'time': '02:00', 'sea': 9},
                {'date': '2026-04-01', 'time': '00:00', 'sea': 9},
                {'date': '2026-03-31', 'time': '01:00', 'sea': 2}]
        result = apply_sea_levels(rows, [['Tanggal', '1', '2', '24'], ['01-Apr-26', '1.70', '', '0']])
        self.assertEqual([r['sea'] for r in result], [2, 1.33, None, -0.37])
        self.assertEqual(rows[0]['sea'], 9)

    def test_independent_hours_and_missing_trailing_cells(self):
        result = apply_sea_levels([], [['Tanggal', '1', '2', '3'], ['11-Mei-26', '1,80', '']])
        self.assertEqual([r['sea'] for r in result], [1.43, None, None])
        self.assertEqual([r['time'] for r in result], ['01:00', '02:00', '03:00'])
        self.assertTrue(all(r['seaOnly'] for r in result))


if __name__ == '__main__':
    unittest.main()
