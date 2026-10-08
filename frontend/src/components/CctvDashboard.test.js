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
  expect(within(screen.getByRole("cell", { name: "Toll Kataraja (1)" })).getAllByText("—")).toHaveLength(2);
  expect(within(bgm).queryByText("Gate")).not.toBeInTheDocument();
  expect(within(bgm).queryByText("Entrance")).not.toBeInTheDocument();
  expect(within(bgm).getAllByRole("listitem")).toHaveLength(1);
  expect(within(screen.getByRole("cell", { name: "Golf Island (1)" })).getByText("GI Camera")).toBeInTheDocument();
  expect(within(screen.getByRole("cell", { name: "Toll Kataraja (1)" })).getByText("PIK2 Camera")).toBeInTheDocument();
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
  const button = await screen.findByRole('button', { name: 'Perbesar CCTV Offline PIK 1' });
  fireEvent.click(button);
  expect(screen.getByRole('dialog', { name: 'CCTV Offline PIK 1 diperbesar' })).toBeInTheDocument();
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
  expect((await screen.findAllByRole("alert"))[0]).toHaveTextContent("Gagal memuat data CCTV offline.");
  expect(screen.queryByText("Tidak ada CCTV offline.")).not.toBeInTheDocument();
});

test('combines totals, shows PIK2 offline quantities, and switches brand independently', async () => {
  global.fetch = jest.fn(url => Promise.resolve({ json: async () => ({ status: 'success', data: url.includes('pik2') ? [
    { 'Jumlah Kamera': 20, Area: 'PIK 2 MILENIAL', 'Sub Area': 'ALABAMA', Brand: 'Dahua', Tahun: 2024, Kondisi: 'ON', 'Detail Offline': '3 Kamera Gangguan Port', 'Progress Perbaikan': 'Proses garansi' },
  ] : [{ Tahun: 2025, Area: 'GI', Brand: 'Hikvision', Kondisi: 'ON' }] }) }));
  const { container } = render(<CctvDashboard />);
  expect(await screen.findByText('PIK 1: 1 · PIK 2: 20')).toBeInTheDocument();
  const offline = screen.getByRole('region', { name: 'Daftar CCTV offline PIK 2' });
  expect(within(offline).getByText('Proses garansi')).toBeInTheDocument();
  expect(within(offline).getByText('(3 offline)')).toBeInTheDocument();
  const brand = within(container.querySelector('.cctv-brand'));
  fireEvent.click(brand.getByRole('button', { name: 'PIK 2' }));
  expect(brand.getByText('Dahua')).toBeInTheDocument();
  expect(brand.queryByText('Hikvision')).not.toBeInTheDocument();
  expect(container.querySelector('.cctv-locations')).toHaveAttribute('hidden');
  expect(container.querySelector('.cctv-distribution')).toHaveAttribute('hidden');
});
