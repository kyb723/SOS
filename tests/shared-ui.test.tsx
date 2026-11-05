import { afterEach, describe, it, expect, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import Home from "../src/app/schedule-app";
import type { DemoData, Employee } from "../src/lib/scheduling";
const id = "20000000-0000-4000-8000-000000000002";
const other = "20000000-0000-4000-8000-000000000003";
const team: Employee[] = [
  { id, name: "Alex Test", role: "full-time", employmentType: "full-time" },
  {
    id: other,
    name: "Jamie Test",
    role: "part-time",
    employmentType: "part-time",
  },
];
const data: DemoData = {
  version: 1,
  shifts: [
    {
      id: "s",
      employeeId: id,
      date: "2026-11-09",
      start: "11:00",
      end: "17:00",
      branch: "ST",
      status: "published",
    },
  ],
  availability: [
    {
      id: "a",
      employeeId: id,
      dates: ["2026-11-09"],
      start: "09:00",
      end: "18:00",
      allDay: false,
      branches: ["ST"],
    },
    {
      id: "b",
      employeeId: other,
      dates: ["2026-11-10"],
      start: "09:00",
      end: "18:00",
      allDay: false,
      branches: ["CSW"],
    },
  ],
  shItems: [],
};
describe("shared staff rota rendering", () => {
  afterEach(() => vi.useRealTimers());
  it("renders colleague availability before scheduling and retains availability next to assigned shifts", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-11-05T00:00:00Z"));
    const html = renderToStaticMarkup(
      <Home initialData={data} team={team} actor={{ id, role: "STAFF" }} />,
    );
    expect(html).toContain("Alex Test");
    expect(html).toContain("Jamie Test");
    expect(html.match(/Av · Review availability/g)).toHaveLength(2);
    expect(html).toContain("11:00");
    expect(html).toContain("Authenticated shared rota");
  });
  it("does not offer demo identity switching or demo reset in an authenticated workspace", () => {
    const html = renderToStaticMarkup(
      <Home initialData={data} team={team} actor={{ id, role: "STAFF" }} />,
    );
    expect(html).not.toContain("Staff Demo");
    expect(html).not.toContain("Manager Demo");
    expect(html).not.toContain("Reset demo");
    expect(html).not.toContain("Export demo backup");
    expect(html).not.toContain("Add shift</button>");
  });
  it("preserves an independent demo without requiring any database environment", () => {
    const html = renderToStaticMarkup(<Home />);
    expect(html).toContain("Staff Demo");
    expect(html).toContain("Export demo backup");
    expect(html).toContain("Simulation only");
  });
});
