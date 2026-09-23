import { fireEvent, render, screen, within } from '@testing-library/react';
import WaterQualityTrend, { formatTrendValue } from './WaterQualityTrend';

test('formats pH consistently to two decimals including midpoint medians', () => {
  expect(formatTrendValue(6.755, 'pH')).toBe('6.76');
  expect(formatTrendValue(7, 'pH')).toBe('7.00');
  expect(formatTrendValue(7.2, 'pH')).toBe('7.20');
});

test('renders point labels with left padding and expands the same filtered chart', () => {
  const originalShow = HTMLDialogElement.prototype.showModal;
  const originalClose = HTMLDialogElement.prototype.close;
  HTMLDialogElement.prototype.showModal = function () { this.setAttribute('open', ''); };
  HTMLDialogElement.prototype.close = function () { this.removeAttribute('open'); };
  try {
    const points = [
      { id: 'a', area: 'BGM', time: new Date(2026, 8, 22).getTime(), value: 6.755, count: 2 },
      { id: 'b', area: 'GI', time: new Date(2026, 8, 23).getTime(), value: 7, count: 3 },
    ];
    render(<WaterQualityTrend metric="pH" areas={['BGM', 'GI']} points={points} />);
    const chart = screen.getByRole('region', { name: 'pH Trend' });
    expect(chart.querySelectorAll('.water-data-label')).toHaveLength(2);
    expect(chart.querySelector('.water-data-label')).toHaveTextContent('6.76');
    expect(Number(chart.querySelector('circle').getAttribute('cx'))).toBeGreaterThan(65);
    const expand = screen.getByRole('button', { name: 'Expand pH Trend' });
    fireEvent.click(expand);
    const dialog = screen.getByRole('dialog', { name: 'pH Trend expanded' });
    expect(within(dialog).getByRole('img').getAttribute('viewBox')).toBe('0 0 1400 520');
    expect(document.body.style.overflow).toBe('hidden');
    fireEvent.change(within(dialog).getByRole('combobox'), { target: { value: 'GI' } });
    expect(dialog.querySelectorAll('circle')).toHaveLength(1);
    fireEvent.click(within(dialog).getByRole('button', { name: 'Close pH Trend' }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(expand).toHaveFocus();
    expect(document.body.style.overflow).not.toBe('hidden');
    expect(screen.getByLabelText('pH Trend Area')).toHaveValue('GI');
    fireEvent.click(expand);
    fireEvent(screen.getByRole('dialog'), new Event('cancel', { bubbles: true }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  } finally {
    HTMLDialogElement.prototype.showModal = originalShow;
    HTMLDialogElement.prototype.close = originalClose;
  }
});
