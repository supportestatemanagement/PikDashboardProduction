import { render, screen, within } from "@testing-library/react";
import CctvDashboard from "./CctvDashboard";

const originalFetch = global.fetch;
afterEach(() => { global.fetch = originalFetch; });

test("lists offline camera names under full area names without table columns", async () => {
  global.fetch = jest.fn().mockResolvedValue({ json: async () => ({ status: "success", data: [
    { Tahun: 2025, Area: " bgm ", Kondisi: "off", "Nama Pada Layar (OSD)": "BGM Camera", "Sub Area": "Gate", Lokasi: "Entrance" },
    { Tahun: 2025, Area: "GI", Kondisi: "OFFLINE", "Nama Pada Layar (OSD)": "GI Camera" },
    { Tahun: 2025, Area: "PIK 2", Kondisi: "RUSAK", "Nama Pada Layar (OSD)": "PIK2 Camera" },
    { Tahun: 2025, Area: "BGM", Kondisi: "ON", "Nama Pada Layar (OSD)": "Online Camera" },
  ] }) });
  const { container } = render(<CctvDashboard />);
  const bgm = await screen.findByRole("region", { name: "Bukit Golf Mediterania (1)" });
  expect(within(bgm).getByText("BGM Camera")).toBeInTheDocument();
  expect(within(bgm).queryByText("Gate")).not.toBeInTheDocument();
  expect(within(bgm).queryByText("Entrance")).not.toBeInTheDocument();
  expect(within(bgm).getAllByRole("listitem")).toHaveLength(1);
  expect(within(screen.getByRole("region", { name: "Golf Island (1)" })).getByText("GI Camera")).toBeInTheDocument();
  expect(within(screen.getByRole("region", { name: "PIK 2 (1)" })).getByText("PIK2 Camera")).toBeInTheDocument();
  expect(within(screen.getByRole("region", { name: "Riverwalk Island (0)" })).getByText("Tidak ada CCTV offline.")).toBeInTheDocument();
  const offline = screen.getByRole("region", { name: "Daftar CCTV offline per area" });
  expect(within(offline).queryByRole("table")).not.toBeInTheDocument();
  expect(within(offline).queryByText("Nama Pada Layar (OSD)")).not.toBeInTheDocument();
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
