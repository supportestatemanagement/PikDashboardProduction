import { fireEvent, render, screen, within } from "@testing-library/react";
import WaterQualityDashboard, { parseWaterDate, tdsStatus, phNumber } from "./WaterQualityDashboard";

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
test("filters dates, searches records, filters TDS and areas", async () => {
  global.fetch = jest.fn().mockResolvedValue({ ok: true, json: async () => ({ status: "success", data: [
    { NO: "1", TANGGAL: "22-Sep-26", "LOKASI SAMPLING": "Crown", TDS: "1000", AREA: "BGM" },
    { NO: "2", TANGGAL: "22 Sept 2026", "LOKASI SAMPLING": "Garden", TDS: "90", AREA: "GI" },
    { NO: "3", TANGGAL: "21-Sep-26", "LOKASI SAMPLING": "Old sample", TDS: "500", AREA: "RWI" },
  ] }) });
  render(<WaterQualityDashboard dateRange={{ start: new Date(2026, 8, 22), end: new Date(2026, 8, 22) }} />);
  await screen.findByText("Crown");
  expect(screen.queryByText("Old sample")).not.toBeInTheDocument();
  fireEvent.change(screen.getByLabelText("Filter TDS"), { target: { value: "green" } });
  expect(within(screen.getAllByRole("row")[1]).getByText("Garden")).toBeInTheDocument();
  fireEvent.change(screen.getByLabelText("Filter TDS"), { target: { value: "" } });
  fireEvent.change(screen.getByRole("searchbox"), { target: { value: "crown" } });
  expect(screen.queryByText("Garden")).not.toBeInTheDocument();
  fireEvent.change(screen.getByRole("searchbox"), { target: { value: "" } });
  fireEvent.change(screen.getByLabelText("Filter Area"), { target: { value: "gi" } });
  expect(screen.queryByText("Crown")).not.toBeInTheDocument();
  expect(screen.getByText("Garden")).toBeInTheDocument();
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
  await screen.findByText('Location 0');
  expect(screen.getAllByRole('row')).toHaveLength(11);
  expect(screen.queryByRole('button', { name: 'Refresh' })).not.toBeInTheDocument();
  expect(screen.queryByText('Total records')).not.toBeInTheDocument();
  expect(screen.queryByText('Remarks')).not.toBeInTheDocument();
  expect(screen.getAllByRole('article')).toHaveLength(5);
  const card = screen.getByRole('article', { name: 'BGM water quality' });
  expect(within(card).getByText('12 sampling locations')).toBeInTheDocument();
  expect(within(card).getByText('315.8')).toBeInTheDocument();
  expect(screen.getAllByText('8.66')).toHaveLength(10);
  expect(within(screen.getByLabelText('Filter Water Color')).getAllByRole('option')).toHaveLength(2);
  fireEvent.click(screen.getByRole('button', { name: 'Next' }));
  expect(screen.getAllByRole('row')).toHaveLength(3);
  fireEvent.change(screen.getByLabelText('Filter TDS'), { target: { value: 'red' } });
  expect(screen.getByText('Location 0')).toBeInTheDocument();
  expect(screen.getByText('500')).toHaveClass('red');
  expect(screen.getByText('Page 1 of 1')).toBeInTheDocument();
  fireEvent.change(screen.getByLabelText('Filter Water Pressure'), { target: { value: 'baik' } });
  expect(screen.getByText(/No records match/)).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Clear filters' }));
  expect(screen.getAllByRole('row')).toHaveLength(11);
});
