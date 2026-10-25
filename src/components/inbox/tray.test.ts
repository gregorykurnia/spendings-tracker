import { describe, expect, it } from "vitest";
import {
  shotAnnouncement,
  shotDetail,
  shotState,
  trayBusy,
  trayFinished,
  trayHeading,
  type Shot,
  type ShotStatus,
} from "./tray";

const shot = (n: number, status: ShotStatus, found = 0): Shot => ({ n, status, found });

describe("the tray's heading", () => {
  it("says how many are being read, and to keep the page open", () => {
    expect(trayHeading([shot(1, "ok", 3), shot(2, "reading"), shot(3, "wait")])).toEqual({
      title: "Reading 3 screenshots",
      sub: "Keep this open until it's done.",
    });
    expect(trayHeading([shot(1, "reading")]).title).toBe("Reading 1 screenshot");
  });

  it("says all were read, with how many lines they gave", () => {
    expect(trayHeading([shot(1, "ok", 3), shot(2, "ok", 1)])).toEqual({
      title: "Read all 2 screenshots",
      sub: "Found 4 transactions.",
    });
    expect(trayHeading([shot(1, "ok", 1)])).toEqual({
      title: "Read the screenshot",
      sub: "Found 1 transaction.",
    });
  });

  it("says how many were read when some need the owner", () => {
    expect(trayHeading([shot(1, "ok", 3), shot(2, "fail"), shot(3, "empty")])).toEqual({
      title: "Read 1 of 3 screenshots",
      sub: "Found 3 transactions. The rest need you.",
    });
  });

  it("says nothing was added when none could be read", () => {
    expect(trayHeading([shot(1, "fail"), shot(2, "empty")])).toEqual({
      title: "Nothing added",
      sub: "Retake them, or type the spends in.",
    });
    expect(trayHeading([shot(1, "fail")]).sub).toBe("Retake it, or type the spends in.");
  });
});

describe("a row", () => {
  it("states where its screenshot is", () => {
    expect(shotState(shot(1, "wait"))).toBe("Waiting");
    expect(shotState(shot(1, "reading"))).toBe("Reading…");
    expect(shotState(shot(1, "ok", 4))).toBe("Found 4 transactions");
    expect(shotState(shot(1, "ok", 1))).toBe("Found 1 transaction");
    expect(shotState(shot(1, "fail"))).toBe("Couldn't read this one");
    expect(shotState(shot(1, "empty"))).toBe("Nothing found");
  });

  it("explains a failed or empty one", () => {
    expect(shotDetail("fail")).toMatch(/blurry or cut off/);
    expect(shotDetail("empty")).toMatch(/no transactions/);
  });

  it("announces the end of a screenshot's reading", () => {
    expect(shotAnnouncement(shot(2, "ok", 3))).toBe("Screenshot 2 read. Found 3 transactions.");
    expect(shotAnnouncement(shot(2, "fail"))).toBe("Screenshot 2 couldn't be read.");
    expect(shotAnnouncement(shot(2, "empty"))).toBe("Screenshot 2 has no transactions.");
  });
});

describe("when the tray is busy or done", () => {
  it("is busy while one waits or is read", () => {
    expect(trayBusy([shot(1, "ok"), shot(2, "wait")])).toBe(true);
    expect(trayBusy([shot(1, "reading")])).toBe(true);
    expect(trayBusy([shot(1, "ok"), shot(2, "fail"), shot(3, "empty")])).toBe(false);
    expect(trayBusy([])).toBe(false);
  });

  it("clears itself only when every screenshot was read", () => {
    expect(trayFinished([shot(1, "ok", 2), shot(2, "ok", 1)])).toBe(true);
    expect(trayFinished([shot(1, "ok", 2), shot(2, "fail")])).toBe(false);
    expect(trayFinished([shot(1, "ok", 2), shot(2, "wait")])).toBe(false);
    expect(trayFinished([])).toBe(false);
  });
});
