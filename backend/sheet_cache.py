"""Per-worker Sheets read cache; serialize refreshes and invalidate on writes."""
import copy
import threading
import time


class CachedWorksheet:
    READS = {'get_all_records', 'get_all_values', 'row_values', 'col_values', 'get', 'get_values', 'batch_get'}
    WRITES = {'append_row', 'append_rows', 'update', 'update_cell', 'update_cells', 'batch_update', 'clear', 'delete_rows', 'insert_row', 'insert_rows'}

    def __init__(self, sheet, ttl=60):
        self.sheet = sheet
        self.ttl = ttl
        self.cache = {}
        self.lock = threading.RLock()
        self.retry_at = 0
        self.failure = None

    def __getattr__(self, name):
        method = getattr(self.sheet, name)
        if name in self.READS:
            def read(*args, **kwargs):
                key = (name, repr(args), repr(sorted(kwargs.items())))
                with self.lock:
                    now = time.monotonic()
                    cached = self.cache.get(key)
                    if cached and now < cached[0]:
                        return copy.deepcopy(cached[1])
                    if now < self.retry_at:
                        raise self.failure
                    try:
                        result = method(*args, **kwargs)
                    except Exception as error:
                        if getattr(getattr(error, 'response', None), 'status_code', None) == 429:
                            self.retry_at = time.monotonic() + 60
                            self.failure = error
                        raise
                    self.cache[key] = (time.monotonic() + self.ttl, copy.deepcopy(result))
                    return result
            return read
        if name in self.WRITES:
            def write(*args, **kwargs):
                with self.lock:
                    try:
                        return method(*args, **kwargs)
                    finally:
                        self.cache.clear()
            return write
        return method


class CachedWorkbook:
    def __init__(self, workbook, ttl=60):
        self.workbook = workbook
        self.ttl = ttl
        self.sheets = {}
        self.lock = threading.Lock()

    def worksheet(self, title):
        with self.lock:
            if title not in self.sheets:
                self.sheets[title] = CachedWorksheet(self.workbook.worksheet(title), self.ttl)
            return self.sheets[title]

    def __getattr__(self, name):
        return getattr(self.workbook, name)
