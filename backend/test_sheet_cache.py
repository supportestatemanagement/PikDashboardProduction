import unittest
from concurrent.futures import ThreadPoolExecutor
from unittest.mock import MagicMock, patch
from sheet_cache import CachedWorkbook


class SheetCacheTests(unittest.TestCase):
    def setUp(self):
        self.raw = MagicMock()
        self.source = self.raw.worksheet.return_value
        self.source.get_all_records.return_value = [{'count': 1}]
        self.book = CachedWorkbook(self.raw)
        self.sheet = self.book.worksheet('CCTV')

    def test_concurrent_reads_share_refresh_and_return_independent_data(self):
        with ThreadPoolExecutor(max_workers=8) as pool:
            results = list(pool.map(lambda _: self.book.worksheet('CCTV').get_all_records(), range(20)))
        self.raw.worksheet.assert_called_once_with('CCTV')
        self.source.get_all_records.assert_called_once()
        results[0][0]['count'] = 99
        self.assertEqual(self.sheet.get_all_records(), [{'count': 1}])

    def test_expiry_and_writes_refresh_data(self):
        with patch('sheet_cache.time.monotonic', return_value=0):
            self.sheet.get_all_records()
        with patch('sheet_cache.time.monotonic', return_value=61):
            self.sheet.get_all_records()
            self.sheet.append_row(['new'])
            self.sheet.get_all_records()
        self.assertEqual(self.source.get_all_records.call_count, 3)

    def test_429_cooldown_does_not_repeat_reads_or_serve_stale_data(self):
        error = RuntimeError('quota')
        error.response = MagicMock(status_code=429)
        self.source.get_all_records.side_effect = error
        with patch('sheet_cache.time.monotonic', return_value=0):
            for _ in range(3):
                with self.assertRaises(RuntimeError):
                    self.sheet.get_all_records()
        self.source.get_all_records.assert_called_once()
        self.source.get_all_records.side_effect = None
        with patch('sheet_cache.time.monotonic', return_value=61):
            self.assertEqual(self.sheet.get_all_records(), [{'count': 1}])

    def test_read_options_have_separate_caches(self):
        self.sheet.get_all_records()
        self.sheet.get_all_records(numericise_ignore=['all'])
        self.assertEqual(self.source.get_all_records.call_count, 2)
