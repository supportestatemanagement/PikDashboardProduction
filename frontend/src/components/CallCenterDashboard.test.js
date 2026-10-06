import { fireEvent, render, screen, within, waitFor } from '@testing-library/react';
import CallCenterDashboard from './CallCenterDashboard';

test('area selection filters only the top reported issues chart', async () => {
  const originalFetch = global.fetch;
  global.fetch = jest.fn().mockResolvedValue({ json: async () => ({ status: 'success', data: [
    { Tanggal: '2026-10-06', Area: 'BGM', Category: 'keluhan listrik', Detailed: 'listrik mati', Dept: 'Teknik' },
    { Tanggal: '2026-10-06', Area: 'GI', Category: 'keluhan air', Detailed: 'air tidak mengalir', Dept: 'Teknik' },
    { Tanggal: '2026-10-06', Area: 'GI', Category: ' Keluhan Air ', Detailed: 'kebocoran air', Dept: 'Teknik' },
  ] }) });
  try {
    render(<CallCenterDashboard dateRange={{ start: new Date(2026, 9, 6), end: new Date(2026, 9, 6) }} />);
    const select = await screen.findByLabelText('Top Reported Issues Area');
    await waitFor(() => expect(select).toBeEnabled());
    const card = select.closest('.chart-card');
    expect(within(card).getByText('keluhan listrik')).toBeInTheDocument();
    expect(within(card).getByText('keluhan air')).toBeInTheDocument();
    expect(within(card).getByText('2')).toBeInTheDocument();
    expect(within(card).queryByText('air tidak mengalir')).not.toBeInTheDocument();
    expect(within(card).queryByText('kebocoran air')).not.toBeInTheDocument();
    fireEvent.change(select, { target: { value: 'BGM' } });
    expect(within(card).getByText('keluhan listrik')).toBeInTheDocument();
    expect(within(card).queryByText('keluhan air')).not.toBeInTheDocument();
    fireEvent.change(select, { target: { value: '' } });
    expect(within(card).getByText('keluhan air')).toBeInTheDocument();
  } finally { global.fetch = originalFetch; }
});
