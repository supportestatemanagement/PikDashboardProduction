import { act, fireEvent, render, screen, within, waitFor } from "@testing-library/react";
import WaterQualityDashboard, { parseWaterDate, tdsStatus, phNumber, summarizeMeasurements, measurementPoints, dailyMeasurementPoints, compareMeasurements, formatWaterDate, formatWaterTime } from "./WaterQualityDashboard";

test.each([[0, "green"], [299, "green"], [300, "red"], [499, "red"], [500, "red"], [501, "red"], ["", "unknown"], [null, "unknown"], ["-", "unknown"], ["299,5", "green"]])("classifies TDS %s as %s", (value, expected) => {
  expect(tdsStatus(value)).toBe(expected);
});
test("parses actual sheet date variants consistently", () => {
  const expected = new Date(2026, 8, 22).getTime();
  ["22-Sep-26", "22 Sept 2026 ", "Tuesday, September 22, 2026", "2026-09-22"].forEach(date => expect(parseWaterDate(date)).toBe(expected));
  expect(parseWaterDate("")).toBeNull();
  expect(parseWaterDate("31-Feb-26")).toBeNull();
});
const originalFetch = global.fetch;
afterEach(() => { global.fetch = originalFetch; });

test('counts two TDS bands and filters inclusive pH boundaries without classifying missing values', async () => {
  const data = [
    ['Below', '299.9', '6.49'], ['Lower', '300', '6.5'],
    ['Upper', '499', '8.5'], ['Above', '500', '8.51'], ['Missing', '', ''],
  ].map(([location, TDS, KETERANGAN]) => ({ 'LOKASI SAMPLING': location, TDS, KETERANGAN, AREA: 'BGM', TANGGAL: '22-Sep-26' }));
  global.fetch = jest.fn().mockResolvedValue({ ok: true, json: async () => ({ status: 'success', data }) });
  render(<WaterQualityDashboard />);
  const table = within(screen.getByRole('table'));
  await table.findByText('Lower');
  const card = screen.getByRole('article', { name: 'BGM water quality' });
  expect(card.querySelector('.water-count-green')).toHaveTextContent('1');
  expect(card.querySelector('.water-count-red')).toHaveTextContent('3');
  expect(card.querySelectorAll('.water-area-bands > div')).toHaveLength(2);
  fireEvent.change(screen.getByLabelText('Filter pH'), { target: { value: 'green' } });
  expect(table.getByText('Lower')).toBeInTheDocument();
  expect(table.getByText('Upper')).toBeInTheDocument();
  expect(table.queryByText('Below')).not.toBeInTheDocument();
  expect(table.queryByText('Above')).not.toBeInTheDocument();
  expect(table.queryByText('Missing')).not.toBeInTheDocument();
  fireEvent.change(screen.getByLabelText('Filter pH'), { target: { value: 'red' } });
  expect(table.getByText('Below')).toBeInTheDocument();
  expect(table.getByText('Above')).toBeInTheDocument();
  expect(table.queryByText('Lower')).not.toBeInTheDocument();
  expect(table.queryByText('Upper')).not.toBeInTheDocument();
  expect(table.queryByText('Missing')).not.toBeInTheDocument();
  fireEvent.change(screen.getByLabelText('Filter TDS'), { target: { value: 'red' } });
  expect(table.queryByText('Below')).not.toBeInTheDocument();
  expect(table.getByText('Above')).toBeInTheDocument();
});

test('summarizes extrema with tied locations and computes median from valid pH values', () => {
  const result = summarizeMeasurements([
    { TDS: '100', KETERANGAN: 'PH: 6', 'LOKASI SAMPLING': 'A' },
    { TDS: '500', KETERANGAN: 'PH: 9', 'LOKASI SAMPLING': 'B' },
    { TDS: '500', KETERANGAN: 'PH: 7', 'LOKASI SAMPLING': 'C' },
    { TDS: '', KETERANGAN: 'PH: 8' }, { TDS: '-', KETERANGAN: '-' },
  ]);
  expect(result).toEqual({ minTds: { value: 100, locations: 'A' }, maxTds: { value: 500, locations: 'B, C' }, medianPh: 7.5, minPh: 6, maxPh: 9, minPhLocations: 'A', maxPhLocations: 'B' });
  expect(summarizeMeasurements([]).medianPh).toBeNull();
  expect(summarizeMeasurements([{ KETERANGAN: '7' }]).medianPh).toBe(7);
});

test('trend points retain every raw measurement and duplicate timestamp without aggregation', () => {
  const rows = [
    { TANGGAL: '22-Sep-26', JAM: '10:00', TDS: '900', KETERANGAN: 'PH: 8', AREA: 'BGM' },
    { TANGGAL: '22-Sep-26', JAM: '09:00', TDS: '100', KETERANGAN: 'PH: 6', AREA: 'BGM' },
    { TANGGAL: '22-Sep-26', JAM: '10:00', TDS: '300', KETERANGAN: 'PH: 7', AREA: 'GI' },
    { TANGGAL: '22-Sep-26', JAM: '', TDS: '800', AREA: 'BGM' },
    { TANGGAL: '22-Sep-26', JAM: '25:00', TDS: '700', AREA: 'BGM' },
  ];
  expect(measurementPoints(rows, 'TDS').map(point => point.value)).toEqual([100, 900, 300]);
  expect(measurementPoints(rows, 'pH').map(point => point.value)).toEqual([6, 8, 7]);
});

test('sorts numeric values, dates and times with missing values last', () => {
  expect(compareMeasurements({ TDS: '90' }, { TDS: '1000' }, { key: 'TDS', direction: 'ascending' })).toBeLessThan(0);
  expect(compareMeasurements({ KETERANGAN: 'PH: 10' }, { KETERANGAN: 'PH: 8' }, { key: 'KETERANGAN', direction: 'ascending' })).toBeGreaterThan(0);
  expect(compareMeasurements({ JAM: '9:30' }, { JAM: '10:00' }, { key: 'JAM', direction: 'ascending' })).toBeLessThan(0);
  expect(compareMeasurements({ TANGGAL: '22-Sep-26' }, { TANGGAL: '21 Sept 2026' }, { key: 'TANGGAL', direction: 'ascending' })).toBeGreaterThan(0);
  expect(compareMeasurements({ TDS: '' }, { TDS: '90' }, { key: 'TDS', direction: 'descending' })).toBeGreaterThan(0);
});

test('supports page sizes, sortable headers and independent trend area filters', async () => {
  const data = Array.from({ length: 21 }, (_, index) => ({ TANGGAL: '22-Sep-26', JAM: '12:00', TDS: String(100 + index), KETERANGAN: 'PH: 7', AREA: index === 0 ? 'GI' : 'BGM', 'LOKASI SAMPLING': `Site ${index}` }));
  global.fetch = jest.fn().mockResolvedValue({ ok: true, json: async () => ({ status: 'success', data }) });
  render(<WaterQualityDashboard />);
  const table = await screen.findByRole('table');
  await waitFor(() => expect(screen.getByRole('region', { name: 'Water Quality Records' })).toHaveAttribute('aria-busy', 'false'));
  expect(within(table).queryByRole('columnheader', { name: 'No.' })).not.toBeInTheDocument();
  expect(within(table).queryByRole('combobox')).not.toBeInTheDocument();
  for (const size of [5, 10, 15, 20]) {
    fireEvent.change(screen.getByLabelText('Rows per page'), { target: { value: String(size) } });
    expect(within(table).getAllByRole('row')).toHaveLength(size + 1);
  }
  fireEvent.click(screen.getByRole('button', { name: 'Sort TDS' }));
  expect(within(table).getAllByRole('row')[1]).toHaveTextContent('100');
  fireEvent.click(screen.getByRole('button', { name: 'Sort TDS' }));
  expect(within(table).getAllByRole('row')[1]).toHaveTextContent('120');
  const tds = screen.getByRole('region', { name: 'TDS Trend' });
  expect(tds.querySelectorAll('circle')).toHaveLength(2);
  fireEvent.change(screen.getByLabelText('TDS Trend Area'), { target: { value: 'GI' } });
  expect(tds.querySelectorAll('circle')).toHaveLength(1);
  expect(screen.getByRole('region', { name: 'pH Trend' }).querySelectorAll('circle')).toHaveLength(2);
  expect(screen.getByRole('button', { name: 'Sort TDS' }).querySelector('svg')).toBeInTheDocument();
  expect(screen.getByPlaceholderText('Enter time (HH:MM)')).toBeInTheDocument();
  expect(screen.getByRole('option', { name: 'Red: ≥ 300' })).toBeInTheDocument();
});

test('daily trends aggregate by calendar date and area with valid values only', () => {
  const rows = [
    { TANGGAL: '23-Sep-26', TDS: '100', KETERANGAN: 'PH: 6', AREA: 'BGM' },
    { TANGGAL: 'Wednesday, September 23, 2026', TDS: '500', KETERANGAN: 'PH: 8', AREA: 'BGM' },
    { TANGGAL: '23 Sept 2026', TDS: '900', KETERANGAN: 'PH: 12', AREA: 'BGM' },
    { TANGGAL: '23-Sep-26', TDS: '', KETERANGAN: '-', AREA: 'BGM' },
    { TANGGAL: '23-Sep-26', TDS: '10', KETERANGAN: 'PH: 7', AREA: 'GI' },
    { TANGGAL: '24-Sep-26', TDS: '200', KETERANGAN: 'PH: 9', AREA: 'BGM' },
  ];
  expect(dailyMeasurementPoints(rows, 'TDS').map(({ area, value, count }) => ({ area, value, count }))).toEqual([
    { area: 'BGM', value: 500, count: 3 }, { area: 'GI', value: 10, count: 1 }, { area: 'BGM', value: 200, count: 1 },
  ]);
  expect(dailyMeasurementPoints(rows, 'pH').map(point => point.value)).toEqual([8, 7, 9]);
  expect(dailyMeasurementPoints(rows.slice(0, 2), 'pH')[0].value).toBe(7);
});

test('normalizes displayed dates and times from sheet formats', () => {
  ['23-Sep-26', '23 Sept 2026', 'Wednesday, September 23, 2026'].forEach(value => expect(formatWaterDate(value)).toBe('23-Sep-26'));
  expect(formatWaterTime('00.02')).toBe('00:02');
  expect(formatWaterTime('00,25')).toBe('00:25');
  expect(formatWaterTime('6:00')).toBe('06:00');
  expect(formatWaterTime('25:00')).toBe('');
});
test("filters dates, searches records, filters TDS and areas", async () => {
  global.fetch = jest.fn().mockResolvedValue({ ok: true, json: async () => ({ status: "success", data: [
    { NO: "1", TANGGAL: "22-Sep-26", "LOKASI SAMPLING": "Crown", TDS: "1000", AREA: "BGM" },
    { NO: "2", TANGGAL: "22 Sept 2026", "LOKASI SAMPLING": "Garden", TDS: "90", AREA: "GI" },
    { NO: "3", TANGGAL: "21-Sep-26", "LOKASI SAMPLING": "Old sample", TDS: "500", AREA: "RWI" },
  ] }) });
  render(<WaterQualityDashboard dateRange={{ start: new Date(2026, 8, 22), end: new Date(2026, 8, 22) }} />);
  await within(await screen.findByRole("table")).findByText("Crown");
  expect(screen.queryByText("Old sample")).not.toBeInTheDocument();
  fireEvent.change(screen.getByLabelText("Filter TDS"), { target: { value: "green" } });
  expect(within(screen.getAllByRole("row")[1]).getByText("Garden")).toBeInTheDocument();
  fireEvent.change(screen.getByLabelText("Filter TDS"), { target: { value: "" } });
  fireEvent.change(screen.getByRole("searchbox"), { target: { value: "crown" } });
  expect(within(screen.getByRole("table")).queryByText("Garden")).not.toBeInTheDocument();
  fireEvent.change(screen.getByRole("searchbox"), { target: { value: "" } });
  fireEvent.change(screen.getByLabelText("Filter Area"), { target: { value: "gi" } });
  expect(within(screen.getByRole("table")).queryByText("Crown")).not.toBeInTheDocument();
  expect(within(screen.getByRole("table")).getByText("Garden")).toBeInTheDocument();
});
test("shows a retry action after a request failure", async () => {
  global.fetch = jest.fn().mockRejectedValue(new Error("Offline"));
  render(<WaterQualityDashboard />);
  expect(await screen.findByRole("alert")).toHaveTextContent("Unable to load");
  expect(screen.getByRole("button", { name: "Try again" })).toBeInTheDocument();
});

test('shows the dashboard panels immediately with local loading placeholders', async () => {
  let resolveRequest;
  global.fetch = jest.fn(() => new Promise(resolve => { resolveRequest = resolve; }));
  render(<WaterQualityDashboard />);
  expect(screen.getAllByRole('article')).toHaveLength(5);
  expect(screen.getByRole('region', { name: 'TDS Trend' })).toHaveAttribute('aria-busy', 'true');
  expect(screen.getByRole('region', { name: 'pH Trend' })).toHaveAttribute('aria-busy', 'true');
  expect(screen.getByRole('region', { name: 'Record filters' })).toBeInTheDocument();
  expect(screen.getByRole('table')).toBeInTheDocument();
  expect(screen.queryByText(/No records match/)).not.toBeInTheDocument();
  expect(screen.queryByText('No measurements')).not.toBeInTheDocument();
  await act(async () => resolveRequest({ ok: true, json: async () => ({ status: 'success', data: [{ TANGGAL: '23-Sep-26', TDS: '120', AREA: 'BGM', 'LOKASI SAMPLING': 'Test location' }] }) }));
  expect(within(screen.getByRole('table')).getByText('Test location')).toBeInTheDocument();
  expect(screen.getByRole('region', { name: 'TDS Trend' })).toHaveAttribute('aria-busy', 'false');
});

test.each([['PH : 8.66', 8.66], ['pH 7,2', 7.2], ['8.1', 8.1], ['', null], ['no sample', null]])('extracts numeric pH from %s', (value, expected) => {
  expect(phNumber(value)).toBe(expected);
});
test('shows detailed area cards, ten rows per page and combined category filters', async () => {
  const data = Array.from({ length: 12 }, (_, index) => ({ NO: String(index + 1), TANGGAL: '22-Sep-26', JAM: '12:00', 'LOKASI SAMPLING': `Location ${index}`, TDS: index === 0 ? '500' : '299', AREA: 'BGM', 'WARNA AIR': index % 2 ? 'Jernih ' : 'jernih', 'TEKANAN AIR': index === 0 ? 'buruk' : 'baik', KETERANGAN: 'PH : 8.66' }));
  global.fetch = jest.fn().mockResolvedValue({ ok: true, json: async () => ({ status: 'success', data }) });
  render(<WaterQualityDashboard />);
  await within(await screen.findByRole('table')).findByText('Location 0');
  expect(screen.getAllByRole('row')).toHaveLength(11);
  expect(screen.queryByRole('button', { name: 'Refresh' })).not.toBeInTheDocument();
  expect(screen.queryByText('Total records')).not.toBeInTheDocument();
  expect(screen.queryByText('Remarks')).not.toBeInTheDocument();
  expect(screen.getAllByRole('article')).toHaveLength(5);
  const card = screen.getByRole('article', { name: 'BGM water quality' });
  expect(within(card).getByText('12 sampling locations')).toBeInTheDocument();
  expect(within(card).getByText('315.8')).toBeInTheDocument();
  expect(within(screen.getByRole('table')).getAllByText('8.66')).toHaveLength(10);
  expect(within(screen.getByLabelText('Filter Water Color')).getAllByRole('option')).toHaveLength(2);
  fireEvent.click(screen.getByRole('button', { name: 'Next' }));
  expect(screen.getAllByRole('row')).toHaveLength(3);
  fireEvent.change(screen.getByLabelText('Filter TDS'), { target: { value: 'red' } });
  expect(within(screen.getByRole('table')).getByText('Location 0')).toBeInTheDocument();
  expect(within(screen.getByRole('table')).getByText('500')).toHaveClass('red');
  expect(screen.getByText('Page 1 of 1')).toBeInTheDocument();
  fireEvent.change(screen.getByLabelText('Filter Water Pressure'), { target: { value: 'baik' } });
  expect(screen.getByText(/No records match/)).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Clear filters' }));
  expect(screen.getAllByRole('row')).toHaveLength(11);
});
