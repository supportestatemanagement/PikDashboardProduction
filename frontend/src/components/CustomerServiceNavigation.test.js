import { fireEvent, render, screen } from '@testing-library/react';
import Navbar from './Navbar';

test('opens the standalone Customer Service menu with the date range picker', () => {
  const select = jest.fn();
  render(<Navbar activeTab="customerservice" setActiveTab={select} isSidebarOpen setIsSidebarOpen={jest.fn()} isMobile={false} dateRange={{ start: new Date(2026, 0, 1), end: new Date(2026, 9, 2) }} onDateChange={jest.fn()} />);
  const menu = screen.getByRole('button', { name: 'Customer Service', exact: true });
  expect(menu).toHaveAttribute('aria-current', 'page');
  fireEvent.click(menu);
  expect(select).toHaveBeenCalledWith('customerservice');
  expect(screen.getByText('Customer Service Dashboard')).toBeInTheDocument();
  expect(screen.getByText(/1 Jan 2026 - 2 Okt 2026/)).toBeInTheDocument();
});
