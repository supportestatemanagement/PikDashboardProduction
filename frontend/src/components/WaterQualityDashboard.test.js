import { fireEvent, render, screen, within } from "@testing-library/react";
import WaterQualityDashboard, { parseWaterDate, tdsStatus, phNumber, summarizeMeasurements, measurementPoints, compareMeasurements } from "./WaterQualityDashboard";

test.each([[0, "green"], [299, "green"], [300, "orange"], [499, "orange"], [500, "red"], [501, "red"], ["", "unknown"], [null, "unknown"], ["-", "unknown"], ["299,5", "green"]])("classifies TDS %s as %s", (value, expected) => {
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

test('summarizes extrema with tied locations and computes median from valid pH values', () => {
  const result = summarizeMeasurements([
    { TDS: '100', KETERANGAN: 'PH: 6', 'LOKASI SAMPLING': 'A' },
    { TDS: '500', KETERANGAN: 'PH: 9', 'LOKASI SAMPLING': 'B' },
    { TDS: '500', KETERANGAN: 'PH: 7', 'LOKASI SAMPLING': 'C' },
    { TDS: '', KETERANGAN: 'PH: 8' }, { TDS: '-', KETERANGAN: '-' },
  ]);
  expect(result).toEqual({ minTds: { value: 100, locations: 'A' }, maxTds: { value: 500, locations: 'B, C' }, medianPh: 7.5, minPh: 6, maxPh: 9 });
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
  expect(tds.querySelectorAll('circle')).toHaveLength(21);
  fireEvent.change(screen.getByLabelText('TDS Trend Area'), { target: { value: 'GI' } });
  expect(tds.querySelectorAll('circle')).toHaveLength(1);
  expect(screen.getByRole('region', { name: 'pH Trend' }).querySelectorAll('circle')).toHaveLength(21);
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
