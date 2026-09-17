import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import MonthlyTrafficChart from "./MonthlyTrafficChart";
import { fetchMonthlyTraffic, toApiDate } from "../services/trafficService";

jest.mock("../services/trafficService", () => ({
  ...jest.requireActual("../services/trafficService"),
  fetchMonthlyTraffic: jest.fn(),
}));

beforeEach(() => {
  fetchMonthlyTraffic.mockReset();
  fetchMonthlyTraffic.mockResolvedValue({ rows: [], granularity: "daily" });
});

test("keeps month filters in the popup and restores current month when closed", async () => {
  const current = toApiDate(new Date()).slice(0, 7);
  const { rerender } = render(<MonthlyTrafficChart maximized={false} onMaximize={() => {}} />);
  expect(screen.queryByRole("img")).not.toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Perbesar panel" })).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Tutup panel" })).toBeInTheDocument();
  await screen.findByText("Belum ada data untuk rentang bulan ini.");
  expect(screen.queryByLabelText("Bulan awal")).not.toBeInTheDocument();
  expect(fetchMonthlyTraffic).toHaveBeenLastCalledWith(current, current, expect.anything());
  rerender(<MonthlyTrafficChart maximized onMaximize={() => {}} />);
  fireEvent.change(screen.getByLabelText("Bulan awal"), { target: { value: "2025-01" } });
  fireEvent.change(screen.getByLabelText("Bulan akhir"), { target: { value: "2025-03" } });
  fireEvent.click(screen.getByText("Terapkan"));
  await waitFor(() => expect(fetchMonthlyTraffic).toHaveBeenLastCalledWith("2025-01", "2025-03", expect.anything()));
  rerender(<MonthlyTrafficChart maximized={false} onMaximize={() => {}} />);
  await waitFor(() => expect(fetchMonthlyTraffic).toHaveBeenLastCalledWith(current, current, expect.anything()));
  await screen.findByText("Belum ada data untuk rentang bulan ini.");
});

test("shows a failed request instead of a zero traffic chart", async () => {
  fetchMonthlyTraffic.mockRejectedValue(new Error("Koneksi gagal"));
  render(<MonthlyTrafficChart maximized={false} onMaximize={() => {}} />);
  expect(await screen.findByRole("alert")).toHaveTextContent("Koneksi gagal");
  expect(screen.queryByRole("img")).not.toBeInTheDocument();
});
