import { fireEvent, render, screen, within } from '@testing-library/react';
import SourceInfo from './SourceInfo';

test('source information opens as one modal, closes with Escape and returns focus', () => {
  const show = HTMLDialogElement.prototype.showModal;
  const close = HTMLDialogElement.prototype.close;
  HTMLDialogElement.prototype.showModal = function () { this.setAttribute('open', ''); };
  HTMLDialogElement.prototype.close = function () { this.removeAttribute('open'); };
  try {
    render(<SourceInfo />);
    const button = screen.getByRole('button', { name: 'Informasi sumber data bencana' });
    fireEvent.click(button);
    const dialog = screen.getByRole('dialog', { name: 'Informasi sumber data' });
    expect(within(dialog).getAllByRole('link')).toHaveLength(6);
    expect(within(dialog).getByText('NOAA/CPC ↗')).toHaveAttribute('href', 'https://www.cpc.ncep.noaa.gov/data/indices/wksst9120.for');
    expect(document.body.style.overflow).toBe('hidden');
    fireEvent(dialog, new Event('cancel', { bubbles: true }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(document.body.style.overflow).not.toBe('hidden');
    expect(button).toHaveFocus();
    fireEvent.click(button);
    fireEvent.click(screen.getByRole('button', { name: 'Tutup informasi sumber' }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  } finally {
    HTMLDialogElement.prototype.showModal = show;
    HTMLDialogElement.prototype.close = close;
  }
});
