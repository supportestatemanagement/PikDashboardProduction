import { summarizePumpDays } from "./PumpWeatherDashboard";

test("weights run observations and separates stations and days", () => {
  const event = (status, station = "PS1", date = "2026-09-09") => ({ status, station, date });
  const result = summarizePumpDays([
    event("Run 1"), event("Run 1"), event("Run 2"), event("Run 2"),
    event("Standby"), event("Run 6", "PS2"), event("Run 3", "PS1", "2026-09-08"),
  ], "PS1");
  expect(result).toEqual([
    { date: "2026-09-09", counts: { "Run 1": 2, "Run 2": 2 }, total: 6 },
    { date: "2026-09-08", counts: { "Run 3": 1 }, total: 3 },
  ]);
});

test("distinguishes standby observations from missing observations", () => {
  expect(summarizePumpDays([], "PS1")).toEqual([]);
  expect(summarizePumpDays([{ station: "PS1", date: "2026-09-09", status: "Standby" }], "PS1"))
    .toEqual([{ date: "2026-09-09", counts: {}, total: 0 }]);
});
