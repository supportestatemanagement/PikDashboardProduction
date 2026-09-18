import { fireEvent, render, screen } from "@testing-library/react";
import Navbar from "./Navbar";

const props = () => ({
  activeTab: "dashboard", setActiveTab: jest.fn(), onLogout: jest.fn(),
  isSidebarOpen: true, setIsSidebarOpen: jest.fn(), isMobile: false,
});

test("Call Center expands into the existing emergency and parking dashboards", () => {
  const callbacks = props();
  render(<Navbar {...callbacks} />);
  const parent = screen.getByRole("button", { name: "Call Center" });
  expect(parent).toHaveAttribute("aria-expanded", "false");
  expect(screen.queryByRole("button", { name: "Parking", exact: true })).not.toBeInTheDocument();
  fireEvent.click(parent);
  expect(callbacks.setActiveTab).not.toHaveBeenCalled();
  expect(parent).toHaveAttribute("aria-expanded", "true");
  fireEvent.click(screen.getByRole("button", { name: "Emergency" }));
  expect(callbacks.setActiveTab).toHaveBeenLastCalledWith("callcenter");
  fireEvent.click(screen.getByRole("button", { name: "Parking", exact: true }));
  expect(callbacks.setActiveTab).toHaveBeenLastCalledWith("perparkiran");
});

test("restored parking selection opens the group and closes the sidebar after mobile navigation", () => {
  const callbacks = { ...props(), activeTab: "perparkiran", isMobile: true };
  render(<Navbar {...callbacks} />);
  expect(screen.getByRole("button", { name: "Call Center" })).toHaveAttribute("aria-expanded", "true");
  expect(screen.getByRole("button", { name: "Parking", exact: true })).toHaveAttribute("aria-current", "page");
  fireEvent.click(screen.getByRole("button", { name: "Emergency" }));
  expect(callbacks.setActiveTab).toHaveBeenCalledWith("callcenter");
  expect(callbacks.setIsSidebarOpen).toHaveBeenCalledWith(false);
});
