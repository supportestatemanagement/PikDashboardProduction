import { fireEvent, render, screen, within, waitFor } from '@testing-library/react';
import CallCenterDashboard from './CallCenterDashboard';

test('area selection filters only the top reported issues chart', async () => {
  const originalFetch = global.fetch;
  global.fetch = jest.fn().mockResolvedValue({ json: async () => ({ status: 'success', data: [
    { Tanggal: '2026-10-06', Area: 'BGM', Detailed: 'keluhan listrik', Dept: 'Teknik' },
    { Tanggal: '2026-10-06', Area: 'GI', Detailed: 'keluhan air', Dept: 'Teknik' },
  ] }) });
  try {
    render(<CallCenterDashboard dateRange={{ start: new Date(2026, 9, 6), end: new Date(2026, 9, 6) }} />);
    const select = await screen.findByLabelText('Top Reported Issues Area');
    await waitFor(() => expect(select).toBeEnabled());
    const card = select.closest('.chart-card');
    expect(within(card).getByText('keluhan listrik')).toBeInTheDocument();
    expect(within(card).getByText('keluhan air')).toBeInTheDocument();
    fireEvent.change(select, { target: { value: 'BGM' } });
    expect(within(card).getByText('keluhan listrik')).toBeInTheDocument();
    expect(within(card).queryByText('keluhan air')).not.toBeInTheDocument();
    fireEvent.change(select, { target: { value: '' } });
    expect(within(card).getByText('keluhan air')).toBeInTheDocument();
  } finally { global.fetch = originalFetch; }
});
