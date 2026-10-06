import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import RainfallPanel from './RainfallPanel';

const originalFetch = global.fetch;
afterEach(() => { global.fetch = originalFetch; });

test('shows rainfall thresholds, sorts readings, and preserves zero and blank values', async () => {
  global.fetch = jest.fn().mockResolvedValue({ ok: true, json: async () => ({ status: 'success', data: [
    { date: '2026-10-06', time: '11:00', value: 0, status: 'Cerah' },
    { date: '2026-10-06', time: '09:55', value: 2, status: 'Hujan' },
    { date: '2026-10-06', time: '10:00', value: null, status: '' },
  ] }) });
  render(<RainfallPanel date="2026-10-06" />);
  const chart = await screen.findByRole('img', { name: 'Grafik Curah Hujan dalam milimeter' });
  expect(screen.getByText('Siaga 1: 20')).toBeInTheDocument();
  expect(screen.getByText('Siaga 2: 10')).toBeInTheDocument();
  expect(screen.getByText('Siaga 3: 5')).toBeInTheDocument();
  expect([...chart.querySelectorAll('circle')].map(node => node.getAttribute('aria-label'))).toEqual(['09:55: 2 mm', '11:00: 0 mm']);
  expect(chart.querySelectorAll('polyline')).toHaveLength(2);
  const point = screen.getByLabelText('09:55: 2 mm');
  fireEvent.mouseEnter(point);
  expect(screen.getByRole('tooltip')).toHaveTextContent('2 mm');
  fireEvent.click(point);
  fireEvent.mouseLeave(point);
  expect(screen.getByRole('tooltip')).toHaveTextContent('Hujan');
  fireEvent.keyDown(point, { key: 'Escape' });
  expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
  const label = screen.getByText('Siaga 2: 10');
  const group = label.parentElement;
  expect(Number(group.querySelector('rect').getAttribute('y')) + 17).toBe(Number(group.querySelector('line').getAttribute('y1')));
});

test('hides rainfall card when selected date has no readings', async () => {
  global.fetch = jest.fn().mockResolvedValue({ ok: true, json: async () => ({ status: 'success', data: [] }) });
  render(<RainfallPanel date="2026-10-06" />);
  await waitFor(() => expect(screen.queryByRole('article', { name: 'Curah Hujan' })).not.toBeInTheDocument());
});
