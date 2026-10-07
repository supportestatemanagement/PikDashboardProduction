import { fireEvent, render, screen, within } from "@testing-library/react";
import CctvDashboard from "./CctvDashboard";
jest.mock('./CctvGroupMap', () => () => <div>Peta Kelompok CCTV</div>);

const originalFetch = global.fetch;
afterEach(() => { global.fetch = originalFetch; });

test("displays offline cameras in four area columns in one body row", async () => {
  global.fetch = jest.fn().mockResolvedValue({ json: async () => ({ status: "success", data: [
    { Tahun: 2025, Area: " bgm ", Kondisi: "off", "Nama Pada Layar (OSD)": "BGM Camera", "Sub Area": "Gate", Lokasi: "Entrance", Detail: "Kabel jaringan putus", Progress: "Sudah diperbaiki" },
    { Tahun: 2025, Area: "GI", Kondisi: "OFFLINE", "Nama Pada Layar (OSD)": "GI Camera" },
    { Tahun: 2025, Area: "PIK 2", Kondisi: "RUSAK", "Nama Pada Layar (OSD)": "PIK2 Camera" },
    { Tahun: 2025, Area: "BGM", Kondisi: "ON", "Nama Pada Layar (OSD)": "Online Camera" },
  ] }) });
  const { container } = render(<CctvDashboard />);
  const bgm = await screen.findByRole("cell", { name: "Bukit Golf Mediterania (1)" });
  expect(within(bgm).getByText("BGM Camera")).toBeInTheDocument();
  expect(within(bgm).getByText("Detail")).toBeInTheDocument();
  expect(within(bgm).getByText("Kabel jaringan putus")).toBeInTheDocument();
  expect(within(bgm).getByText("Sudah diperbaiki")).toBeInTheDocument();
  expect(within(screen.getByRole("cell", { name: "PIK 2 (1)" })).getAllByText("—")).toHaveLength(2);
  expect(within(bgm).queryByText("Gate")).not.toBeInTheDocument();
  expect(within(bgm).queryByText("Entrance")).not.toBeInTheDocument();
  expect(within(bgm).getAllByRole("listitem")).toHaveLength(1);
  expect(within(screen.getByRole("cell", { name: "Golf Island (1)" })).getByText("GI Camera")).toBeInTheDocument();
  expect(within(screen.getByRole("cell", { name: "PIK 2 (1)" })).getByText("PIK2 Camera")).toBeInTheDocument();
  expect(within(screen.getByRole("cell", { name: "Riverwalk Island (0)" })).getByText("Tidak ada CCTV offline.")).toBeInTheDocument();
  const offline = screen.getByRole("region", { name: "Daftar CCTV offline per area" });
  const table = within(offline).getByRole("table");
  expect(within(table).getAllByRole("columnheader")).toHaveLength(4);
  expect(table.querySelectorAll("tbody tr")).toHaveLength(1);
  expect(within(offline).queryByText("Nama Pada Layar (OSD)")).not.toBeInTheDocument();
  expect(screen.queryByText("Online Camera")).not.toBeInTheDocument();
  expect(container.querySelector("svg text[transform]")).toBeNull();
  expect([...container.querySelectorAll("svg text")].some(node => node.textContent === "0")).toBe(false);
});

test('offline table expands into a dialog and restores focus when closed', async () => {
  const originalShow = HTMLDialogElement.prototype.showModal;
  const originalClose = HTMLDialogElement.prototype.close;
  HTMLDialogElement.prototype.showModal = function () { this.setAttribute('open', ''); };
  HTMLDialogElement.prototype.close = function () { this.removeAttribute('open'); };
  global.fetch = jest.fn().mockResolvedValue({ json: async () => ({ status: 'success', data: [] }) });
  render(<CctvDashboard />);
  const button = await screen.findByRole('button', { name: 'Perbesar CCTV Offline' });
  fireEvent.click(button);
  expect(screen.getByRole('dialog', { name: 'CCTV Offline diperbesar' })).toBeInTheDocument();
  expect(document.body.style.overflow).toBe('hidden');
  fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Tutup' }));
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  expect(button).toHaveFocus();
  HTMLDialogElement.prototype.showModal = originalShow;
  HTMLDialogElement.prototype.close = originalClose;
});

test("shows a fetch error instead of reporting no offline cameras", async () => {
  global.fetch = jest.fn().mockResolvedValue({ json: async () => ({ status: "error" }) });
  render(<CctvDashboard />);
  expect(await screen.findByRole("alert")).toHaveTextContent("Gagal memuat data CCTV offline.");
  expect(screen.queryByText("Tidak ada CCTV offline.")).not.toBeInTheDocument();
});
