import { getAreaTrafficStage, getTrafficStage, mapTrafficDashboard } from "./services/trafficService";

test("maps final worksheet columns and applies the PIK1 formula", () => {
  const result = mapTrafficDashboard({
    summary: {
      "Vehicle IN - BGM": 100,
      "Vehicle IN - GI": 200,
      "Vehicle IN- RWI": 300,
      "Vehicle IN - PIK2": 400,
      "CP - BGM": 500,
      "Total Pengunjung": 1000,
    },
    hourly: [],
  });
  expect(result.vehicles.pik1).toBe(600);
  expect(result.vehicles.pik2).toBe(400);
  expect(result.checkpoints.bgm).toBe(500);
  expect(result.totalVehicles).toBe(1000);
});

test("uses the centralized existing stage thresholds", () => {
  expect(getTrafficStage(20000).stage).toBe(1);
  expect(getTrafficStage(20001).stage).toBe(2);
  expect(getTrafficStage(50001).stage).toBe(5);
});

test("uses independent stage-one thresholds for each polygon area", () => {
  expect(getAreaTrafficStage("BGM", 20000).stage).toBe(1);
  expect(getAreaTrafficStage("BGM", 20001).stage).toBe(2);
  expect(getAreaTrafficStage("GI", 15000).stage).toBe(1);
  expect(getAreaTrafficStage("GI", 15001).stage).toBe(2);
  expect(getAreaTrafficStage("RWI", 10000).stage).toBe(1);
  expect(getAreaTrafficStage("RWI", 10001).stage).toBe(2);
});
