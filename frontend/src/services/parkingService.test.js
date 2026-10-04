import { normalizeParkingRows, formatParkingTime } from './parkingService';

const row = changes => ({ received_at_wib: '2026-10-03T18:30:59+07:00', sitename: 'KAWASAN RUKAN PIK - CORDOBA', car_capacity: '200', bike_capacity: '300', car_qty: '280', bike_qty: '722', ...changes });

test('groups sheet locations and keeps the latest snapshot per location independent of row order', () => {
  const result = normalizeParkingRows([
    row({ received_at_wib: '2026-10-03T19:30:59+07:00', car_qty: '100' }),
    row(),
    row({ sitename: 'GOLF ISLAND - A' }),
    row({ sitename: 'RIVERWALK ISLAND - B' }),
    row({ sitename: 'OTHER' }),
  ]);
  expect(result.map(item => item.area)).toEqual(['BGM', 'GI', 'RWI']);
  expect(result[0]).toMatchObject({ capacity: 500, occupied: 822, carCapacity: 200, bikeCapacity: 300, carQty: 100, bikeQty: 722 });
  expect(result[0].capacity - result[0].occupied).toBe(-322);
});

test('does not replace a malformed latest reading with older data or convert empty counts to zero', () => {
  expect(normalizeParkingRows([row(), row({ received_at_wib: '2026-10-03T19:30:59+07:00', car_qty: '' })])).toEqual([]);
  expect(normalizeParkingRows([row({ received_at_wib: 'invalid' })])).toEqual([]);
  expect(normalizeParkingRows([row({ car_capacity: '0', bike_capacity: '0', car_qty: '0', bike_qty: '0' })])[0].capacity).toBe(0);
});

test('formats source timestamps in WIB', () => {
  expect(formatParkingTime(Date.parse('2026-10-03T18:30:59+07:00'))).toContain('18.30');
  expect(formatParkingTime(0)).toBe('Belum ada data');
});
