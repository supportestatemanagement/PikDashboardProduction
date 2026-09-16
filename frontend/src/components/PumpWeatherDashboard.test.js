import { render, screen } from "@testing-library/react";
import { PeakPanel, StatusPanel, summarizePumpDays } from "./PumpWeatherDashboard";

test("shows a single weighted total for the selected range", () => {
  render(<StatusPanel station="PS1" filter={{ start: "2026-09-01", end: "2026-09-09" }} data={{ pumpStatusEvents: [
    { station: "PS1", date: "2026-09-08", status: "Run 2" },
    { station: "PS1", date: "2026-09-09", status: "Run 3" },
    { station: "PS2", date: "2026-09-09", status: "Run 6" },
  ] }} />);
  expect(screen.getByText(/01 Sep 2026 - 09 Sep 2026/i)).toBeInTheDocument();
  expect(screen.getByText("5")).toHaveTextContent(/^5$/);
  expect(screen.queryByText("08 Sep 2026")).not.toBeInTheDocument();
});

test("counts pump starts and separates stations and days", () => {
  const event = (status, station = "PS1", date = "2026-09-09") => ({ status, station, date });
  const result = summarizePumpDays([
    event("Run 1"), event("Run 1"), event("Run 2"), event("Run 2"),
    event("Standby"), event("Run 6", "PS2"), event("Run 3", "PS1", "2026-09-08"),
  ], "PS1");
  expect(result).toEqual([
    { date: "2026-09-09", counts: { "Run 1": 2, "Run 2": 2 }, total: 2 },
    { date: "2026-09-08", counts: { "Run 3": 1 }, total: 3 },
  ]);
});

const pumpEvents = (observations) => observations.map(([time, status]) => ({
  station: "PS3", date: "2026-09-09", time, status,
}));

test.each([
  ["same-hour updates", [["04:00", "Run 4"], ["04:00", "Run 5"], ["04:00", "Run 2"], ["04:00", "1"]], 5],
  ["restart after standby", [["04:00", "Run 5"], ["05:00", "Run 1"], ["06:00", "stby"], ["07:00", "Run 1"]], 6],
  ["increase after reduction", [["04:00", "Run 5"], ["05:00", "Run 2"], ["06:00", "Run 3"]], 6],
  ["four-hour gap", [["04:00", "Run 1"], ["08:00", "Run 1"]], 1],
  ["blank and unknown statuses do not restart a run", [["04:00", "Run 1"], ["06:00", ""], ["07:00", "N/A"], ["08:00", "Run 1"]], 1],
  ["one-hour gap", [["04:00", "Run 1"], ["05:00", "Run 1"]], 1],
  ["long gap with multiple pumps", [["04:00", "Run 3"], ["12:00", "Run 3"]], 3],
  ["increase after a long gap", [["04:00", "Run 2"], ["12:00", "Run 3"]], 3],
  ["standby followed by a long gap", [["04:00", "Run 2"], ["05:00", "Standby"], ["12:00", "Run 2"]], 4],
  ["short gap", [["04:00", "Run 1"], ["07:59", "Run 1"]], 1],
  ["continuous updates across four-hour boundaries", [["04:00", "Run 1"], ["06:00", "Run 1"], ["08:00", "Run 1"]], 1],
  ["chronological order", [["06:00", "Run 3"], ["04:00", "Run 5"], ["05:00", "Run 2"]], 6],
  ["sheet midnight is the end of the day", [["00:00", "stby"], ["20:00", "Run 2"], ["23:00", "Run 2"]], 2],
  ["uploaded PS3 example", [["12:00", "stby"], ["16:00", "Run 4"], ["17:00", "Run 5"], ["18:00", "Run 2"], ["20:00", "1"], ["24:00", "stby"]], 5],
])("handles %s", (_name, observations, expected) => {
  expect(summarizePumpDays(pumpEvents(observations), "PS3")[0].total).toBe(expected);
});

test("summary and peak-date run count use the same pump starts", () => {
  const filter = { start: "2026-09-09", end: "2026-09-09" };
  const data = {
    pumpStatusEvents: pumpEvents([["04:00", "Run 5"], ["05:00", "Run 2"], ["06:00", "Run 3"]]),
    stationPeaks: [{ station: "PS3", date: filter.start, time: "05:00", level: -1.2 }],
  };
  render(<><StatusPanel data={data} station="PS3" filter={filter} /><PeakPanel data={data} filter={filter} setFilter={() => {}} navbarKey={filter.start} /></>);
  expect(screen.getAllByText("6")).toHaveLength(2);
});

test("distinguishes standby observations from missing observations", () => {
  expect(summarizePumpDays([], "PS1")).toEqual([]);
  expect(summarizePumpDays([{ station: "PS1", date: "2026-09-09", status: "Standby" }], "PS1"))
    .toEqual([{ date: "2026-09-09", counts: {}, total: 0 }]);
});
