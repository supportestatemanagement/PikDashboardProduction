"""Apply hourly AirLaut readings without filling missing observations."""
import datetime
import math


def sea_date(value):
    text = str(value or '').strip().lower()
    for local, english in {'mei': 'may', 'agu': 'aug', 'okt': 'oct', 'des': 'dec'}.items():
        text = text.replace(local, english)
    for fmt in ('%d-%b-%y', '%d-%b-%Y', '%Y-%m-%d', '%d/%m/%Y', '%d-%m-%Y'):
        try:
            return datetime.datetime.strptime(text, fmt).date().isoformat()
        except ValueError:
            pass
    return None


def corrected_level(value):
    try:
        number = float(str(value).strip().replace(',', '.'))
        return round(number - 0.37, 4) if math.isfinite(number) else None
    except (ValueError, TypeError):
        return None


def apply_sea_levels(records, values):
    if not values:
        return records
    hours = {index: int(str(header).strip()) for index, header in enumerate(values[0])
             if str(header).strip().isdigit() and 1 <= int(str(header).strip()) <= 24}
    dates = {}
    for cells in values[1:]:
        date = sea_date(cells[0]) if cells else None
        if date:
            dates[date] = {hour: corrected_level(cells[index] if index < len(cells) else '')
                           for index, hour in hours.items()}
    result = []
    observed = set()
    for record in records:
        date, hour = record['date'], int(record['time'].split(':')[0]) or 24
        if date in dates:
            record = {**record, 'sea': dates[date].get(hour)}
            observed.add((date, hour))
        result.append(record)
    # AirLaut can contain hours with no PumpStation observation.
    for date, readings in dates.items():
        for hour, level in readings.items():
            if (date, hour) not in observed:
                result.append({'date': date, 'time': f'{hour:02d}:00', 'sea': level,
                               'seaOnly': True,
                               'weather': None, 'tds': None, 'twa': None,
                               'stations': {name: {'level': None, 'status': None}
                                            for name in ('PS1', 'PS2', 'PS3', 'PS4')}})
    return sorted(result, key=lambda row: (row['date'], row['time'].replace('00:', '24:', 1) if row['time'].startswith('00:') else row['time']))
