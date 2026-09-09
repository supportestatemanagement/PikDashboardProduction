import { render, screen, within } from "@testing-library/react";
import CctvDashboard from "./CctvDashboard";

const originalFetch = global.fetch;
afterEach(() => { global.fetch = originalFetch; });

test("groups offline cameras by area and displays OSD, sub area and location", async () => {
  global.fetch = jest.fn().mockResolvedValue({ json: async () => ({ status: "success", data: [
    { Tahun: 2025, Area: " bgm ", Kondisi: "off", "Nama Pada Layar (OSD)": "BGM Camera", "Sub Area": "Gate", Lokasi: "Entrance" },
    { Tahun: 2025, Area: "GI", Kondisi: "OFFLINE", "Nama Pada Layar (OSD)": "GI Camera" },
    { Tahun: 2025, Area: "PIK 2", Kondisi: "RUSAK", "Nama Pada Layar (OSD)": "PIK2 Camera" },
    { Tahun: 2025, Area: "BGM", Kondisi: "ON", "Nama Pada Layar (OSD)": "Online Camera" },
  ] }) });
  const { container } = render(<CctvDashboard />);
  const bgm = await screen.findByRole("table", { name: "BGM (1)" });
  expect(within(bgm).getByText("BGM Camera")).toBeInTheDocument();
  expect(within(bgm).getByText("Gate")).toBeInTheDocument();
  expect(within(bgm).getByText("Entrance")).toBeInTheDocument();
  expect(within(screen.getByRole("table", { name: "GI (1)" })).getByText("GI Camera")).toBeInTheDocument();
  expect(within(screen.getByRole("table", { name: "PIK2 (1)" })).getByText("PIK2 Camera")).toBeInTheDocument();
  expect(within(screen.getByRole("table", { name: "RWI (0)" })).getByText("Tidak ada CCTV offline.")).toBeInTheDocument();
  expect(screen.queryByText("Online Camera")).not.toBeInTheDocument();
  expect(container.querySelector("svg text[transform]")).toBeNull();
  expect([...container.querySelectorAll("svg text")].some(node => node.textContent === "0")).toBe(false);
});

test("shows a fetch error instead of reporting no offline cameras", async () => {
  global.fetch = jest.fn().mockResolvedValue({ json: async () => ({ status: "error" }) });
  render(<CctvDashboard />);
  expect(await screen.findByRole("alert")).toHaveTextContent("Gagal memuat data CCTV offline.");
  expect(screen.queryByText("Tidak ada CCTV offline.")).not.toBeInTheDocument();
});
