import { fireEvent, render, screen, within } from '@testing-library/react';
import CustomerServiceDashboard from './CustomerServiceDashboard';
import { fetchCustomerRows, normalizeCustomerRows } from '../services/customerService';
jest.mock('../services/customerService', () => ({ ...jest.requireActual('../services/customerService'), fetchCustomerRows: jest.fn() }));
const dateRange = { start: new Date(2026, 9, 1), end: new Date(2026, 9, 31) };
const row = changes => ({ 'Project Code': 'BGM', 'Created At': '01/10/2026 18:00:00', 'Unit Code': '001', 'Requester Name': 'Example', Source: 'EMAIL', 'Service Type': 'REQUEST', 'Category Name': 'Customer Service', 'Sub Category Name': 'Permintaan Informasi', 'Response Status': 'Complete on Target', 'Handling Status': 'Work in Progress', ...changes });
beforeEach(() => fetchCustomerRows.mockResolvedValue(normalizeCustomerRows([
  row({}), row({ 'Project Code': 'GIS', Source: 'PHONE', 'Category Name': 'Engineering', 'Sub Category Name': 'Keluhan Listrik' }),
  row({ 'Project Code': 'EBI', 'Created At': '01/09/2026 12:00:00' }),
])));
test('loads sheet rows, uses independent area/category filters and filters all table columns', async () => {
  render(<CustomerServiceDashboard dateRange={dateRange} />);
  await screen.findByRole('main', { name: 'Customer Service Dashboard' });
  expect(screen.queryByText('Other')).not.toBeInTheDocument();
  expect(screen.getByLabelText('Daily Project Code')).toHaveValue('');
  const records = screen.getByRole('region', { name: 'Customer Service Records' });
  expect(within(records).getAllByRole('columnheader')).toHaveLength(13);
  expect(within(records).getAllByRole('row')).toHaveLength(3);
  fireEvent.change(screen.getByLabelText('Issue Project Code'), { target: { value: 'GIS' } });
  expect(screen.getByLabelText('Issue Category Name')).toHaveTextContent('Engineering');
  expect(screen.getByLabelText('Issue Category Name')).not.toHaveTextContent('Customer Service');
  fireEvent.change(screen.getByLabelText('Issue Category Name'), { target: { value: 'Engineering' } });
  expect(screen.getByLabelText('Top reported sub categories')).toHaveTextContent('Keluhan Listrik');
  fireEvent.change(screen.getByLabelText('Filter Project Code'), { target: { value: 'BGM' } });
  expect(within(records).getAllByRole('row')).toHaveLength(2);
  expect(within(records).getByText('Complete on Target', { selector: 'span' })).toHaveClass('green');
  fireEvent.click(screen.getByRole('button', { name: 'Clear filters' }));
  expect(within(records).getAllByRole('row')).toHaveLength(3);
});
test('shows a retry on failure and supports empty results', async () => {
  fetchCustomerRows.mockRejectedValueOnce(new Error('Connection failed')).mockResolvedValueOnce([]);
  render(<CustomerServiceDashboard dateRange={dateRange} />);
  await screen.findByRole('alert');
  fireEvent.click(screen.getByRole('button', { name: 'Coba lagi' }));
  await screen.findByText('Tidak ada tiket sesuai filter.');
  expect(screen.getByRole('button', { name: 'Next' })).toBeDisabled();
});
