import { fireEvent, render, screen, within } from "@testing-library/react";
import WaterQualityDashboard, { parseWaterDate, tdsStatus } from "./WaterQualityDashboard";

test.each([[0, "green"], [299, "green"], [300, "orange"], [499, "orange"], [500, "orange"], [501, "red"], ["", "unknown"], [null, "unknown"], ["-", "unknown"], ["299,5", "green"]])("classifies TDS %s as %s", (value, expected) => {
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
test("filters dates, searches records, sorts TDS numerically and filters areas", async () => {
  global.fetch = jest.fn().mockResolvedValue({ ok: true, json: async () => ({ status: "success", data: [
    { NO: "1", TANGGAL: "22-Sep-26", "LOKASI SAMPLING": "Crown", TDS: "1000", AREA: "BGM" },
    { NO: "2", TANGGAL: "22 Sept 2026", "LOKASI SAMPLING": "Garden", TDS: "90", AREA: "GI" },
    { NO: "3", TANGGAL: "21-Sep-26", "LOKASI SAMPLING": "Old sample", TDS: "500", AREA: "RWI" },
  ] }) });
  render(<WaterQualityDashboard dateRange={{ start: new Date(2026, 8, 22), end: new Date(2026, 8, 22) }} />);
  await screen.findByText("Crown");
  expect(screen.queryByText("Old sample")).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: /^TDS/ }));
  expect(within(screen.getAllByRole("row")[1]).getByText("Garden")).toBeInTheDocument();
  fireEvent.change(screen.getByRole("searchbox"), { target: { value: "crown" } });
  expect(screen.queryByText("Garden")).not.toBeInTheDocument();
  fireEvent.change(screen.getByRole("searchbox"), { target: { value: "" } });
  fireEvent.change(screen.getByRole("combobox"), { target: { value: "GI" } });
  expect(screen.queryByText("Crown")).not.toBeInTheDocument();
  expect(screen.getByText("Garden")).toBeInTheDocument();
});
test("shows a retry action after a request failure", async () => {
  global.fetch = jest.fn().mockRejectedValue(new Error("Offline"));
  render(<WaterQualityDashboard />);
  expect(await screen.findByRole("alert")).toHaveTextContent("Unable to load");
  expect(screen.getByRole("button", { name: "Try again" })).toBeInTheDocument();
});
