import { act, fireEvent, render, screen, within } from '@testing-library/react';
import CustomerServiceDashboard from './CustomerServiceDashboard';
import { fetchCustomerRows, normalizeCustomerRows } from '../services/customerService';
jest.mock('../services/customerService', () => ({ ...jest.requireActual('../services/customerService'), fetchCustomerRows: jest.fn() }));
const dateRange = { start: new Date(2026, 9, 1), end: new Date(2026, 9, 31) };
const row = changes => ({ 'Project Code': 'BGM', 'Created At': '01/10/2026 18:00:00', 'Unit Code': '001', 'Requester Name': 'Example', Source: 'EMAIL', 'Service Type': 'REQUEST', 'Category Name': 'Customer Service', 'Sub Category Name': 'Permintaan Informasi', 'Response Status': 'Complete on Target', 'Handling Status': 'Work in Progress', 'SLA Days': '2', ...changes });
beforeEach(() => fetchCustomerRows.mockResolvedValue(normalizeCustomerRows([
  row({}), row({ 'Project Code': 'GI', Source: 'PHONE', 'SLA Days': '10', 'Category Name': 'Engineering', 'Sub Category Name': 'Keluhan Listrik' }),
  row({ 'Project Code': 'RWI', 'Created At': '01/09/2026 12:00:00' }),
])));
test('loads sheet rows, uses independent area/category filters and filters all table columns', async () => {
  render(<CustomerServiceDashboard dateRange={dateRange} />);
  await screen.findByRole('img', { name: 'Monthly Customer Service Tickets' });
  expect(screen.queryByText('Other')).not.toBeInTheDocument();
  expect(screen.getByLabelText('Monthly Project Code')).toHaveValue('');
  expect([...document.querySelectorAll('.cs-summary-card')].map(card => card.querySelector('small')?.textContent || card.querySelector('span').textContent)).toEqual(['TOTAL TICKETS', 'BGM', 'GI', 'RWI', 'PIK 2']);
  expect(screen.getByRole('img', { name: 'Monthly Customer Service Tickets' })).toHaveTextContent('2026-10: 2 tiket');
  expect(screen.getByRole('heading', { name: 'Request Source Distribution' })).toBeInTheDocument();
  expect(screen.getByRole('heading', { name: 'Service Type Distribution' })).toBeInTheDocument();
  expect(screen.getByRole('heading', { name: 'Service Category Distribution' })).toBeInTheDocument();
  expect(screen.getByLabelText('Tickets by Source')).toHaveClass('cs-horizontal');
  expect(screen.getByLabelText('Tickets by Source')).not.toHaveTextContent('%');
  const records = screen.getByRole('region', { name: 'Customer Service Records' });
  expect(within(records).getAllByRole('columnheader')).toHaveLength(13);
  expect(within(records).getAllByRole('row')).toHaveLength(3);
  fireEvent.change(screen.getByLabelText('Issue Project Code'), { target: { value: 'GI' } });
  expect(screen.getByLabelText('Issue Category Name')).toHaveTextContent('Engineering');
  expect(screen.getByLabelText('Issue Category Name')).not.toHaveTextContent('Customer Service');
  fireEvent.change(screen.getByLabelText('Issue Category Name'), { target: { value: 'Engineering' } });
  expect(screen.getByLabelText('Top reported sub categories')).toHaveTextContent('Keluhan Listrik');
  fireEvent.change(screen.getByLabelText('Filter Project Code'), { target: { value: 'BGM' } });
  expect(within(records).getAllByRole('row')).toHaveLength(2);
  expect(within(records).getByText('Complete on Target', { selector: 'span' })).toHaveClass('green');
  fireEvent.click(screen.getByRole('button', { name: 'Clear filters' }));
  expect(within(records).getAllByRole('row')).toHaveLength(3);
  const sla = screen.getByRole('combobox', { name: 'Filter SLA Days' });
  expect(within(sla).getAllByRole('option').map(option => option.textContent)).toEqual(['All', '2', '10']);
  fireEvent.change(sla, { target: { value: '10' } });
  expect(within(records).getAllByRole('row')).toHaveLength(2);
  expect(within(records).getByRole('cell', { name: 'GI' })).toBeInTheDocument();
});
test('shows a retry on failure and supports empty results', async () => {
  fetchCustomerRows.mockRejectedValueOnce(new Error('Connection failed')).mockResolvedValueOnce([]);
  render(<CustomerServiceDashboard dateRange={dateRange} />);
  await screen.findByRole('alert');
  fireEvent.click(screen.getByRole('button', { name: 'Coba lagi' }));
  await screen.findByText('Tidak ada tiket sesuai filter.');
  expect(screen.getByRole('button', { name: 'Next' })).toBeDisabled();
});

test('shows all panels immediately with local skeletons, then replaces them with data', async () => {
  let resolve;
  fetchCustomerRows.mockImplementationOnce(() => new Promise(done => { resolve = done; }));
  render(<CustomerServiceDashboard dateRange={dateRange} />);
  expect(screen.getByRole('main', { name: 'Customer Service Dashboard' })).toBeInTheDocument();
  expect(screen.getAllByLabelText('Memuat jumlah tiket')).toHaveLength(5);
  expect(document.querySelectorAll('.cs-chart[aria-busy="true"]')).toHaveLength(5);
  const table = screen.getByRole('region', { name: 'Customer Service Records' });
  expect(table).toHaveAttribute('aria-busy', 'true');
  expect(within(table).getAllByRole('columnheader')).toHaveLength(13);
  expect(screen.getByLabelText('Filter SLA Days')).toBeDisabled();
  expect(screen.getByLabelText('Monthly Project Code')).toBeDisabled();
  expect(screen.queryByText('Tidak ada tiket sesuai filter.')).not.toBeInTheDocument();
  expect(screen.queryByText('Memuat Customer Service...')).not.toBeInTheDocument();
  await act(async () => resolve(normalizeCustomerRows([row({})])));
  expect(screen.queryByLabelText('Memuat jumlah tiket')).not.toBeInTheDocument();
  expect(table).toHaveAttribute('aria-busy', 'false');
  expect(screen.getByLabelText('Filter SLA Days')).toBeEnabled();
  expect(screen.getByRole('img', { name: 'Monthly Customer Service Tickets' })).toBeInTheDocument();
});
