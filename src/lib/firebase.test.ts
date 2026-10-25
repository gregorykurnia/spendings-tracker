import { describe, expect, it } from "vitest";
import { emulatorTarget } from "./firebase";

describe("emulatorTarget", () => {
  it("uses the real project when no emulator is set", () => {
    expect(emulatorTarget("spendings-tracker-123", undefined)).toBeNull();
    expect(emulatorTarget(undefined, undefined)).toBeNull();
  });

  it("connects a demo project to the emulator", () => {
    expect(emulatorTarget("demo-spendings", "127.0.0.1:8181")).toEqual({
      host: "127.0.0.1",
      port: 8181,
    });
  });

  it("refuses the emulator with a project that isn't a demo one", () => {
    expect(() => emulatorTarget("spendings-tracker-123", "127.0.0.1:8181")).toThrow(/demo-/);
    expect(() => emulatorTarget(undefined, "127.0.0.1:8181")).toThrow(/demo-/);
  });

  it("refuses a demo project without the emulator", () => {
    expect(() => emulatorTarget("demo-spendings", undefined)).toThrow(/EMULATOR/);
  });

  it("refuses an emulator address without a port", () => {
    expect(() => emulatorTarget("demo-spendings", "localhost")).toThrow(/host:port/);
  });
});
