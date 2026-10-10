import { test, expect, type Page } from "@playwright/test";
const state = (p: Page) =>
  p.evaluate(() => JSON.parse(localStorage.getItem("stillroom.v3")!));
async function open(p: Page) {
  await p.goto("/");
  await expect(p.locator(".app")).not.toHaveAttribute("inert", "");
}
async function choose(p: Page, label: string, value: string) {
  await p.getByRole("combobox", { name: label, exact: true }).click();
  await p.getByRole("option", { name: value, exact: true }).click();
}
async function settings(p: Page, tab: string) {
  await p.getByRole("button", { name: "Settings", exact: true }).click();
  await p.getByRole("tab", { name: tab, exact: true }).click();
}
async function tool(p: Page, tab: string) {
  await p.getByRole("button", { name: "More study actions" }).click();
  await p.getByRole("button", { name: "Study tools", exact: true }).click();
  await choose(p, "Study tool", tab);
}
async function close(p: Page) {
  await p.getByRole("button", { name: "Close dialog", exact: true }).click();
}
test("fresh contexts remain independent, themes persist, and no unchanged timer writes", async ({
  page,
  browser,
}) => {
  await page.addInitScript(() => {
    const original = Storage.prototype.setItem;
    (window as any).writes = 0;
    Storage.prototype.setItem = function (k, v) {
      if (k === "stillroom.v3") (window as any).writes++;
      return original.call(this, k, v);
    };
  });
  await open(page);
  expect((await state(page)).tasks).toEqual([]);
  expect((await state(page)).history).toEqual([]);
  await page.getByLabel("Session intention").fill("Private intention");
  const second = await browser.newContext();
  const other = await second.newPage();
  await open(other);
  expect((await state(other)).timer.intention).toBe("");
  await page.getByRole("button", { name: "Start" }).click();
  await page.waitForTimeout(100);
  const writes = await page.evaluate(() => (window as any).writes);
  await page.waitForTimeout(800);
  expect(await page.evaluate(() => (window as any).writes)).toBe(writes);
  await page.reload();
  expect((await state(page)).timer.intention).toBe("Private intention");
  await second.close();
});
test("two tabs share a single owner and record expiration once after takeover", async ({
  page,
  context,
}) => {
  await open(page);
  await page.evaluate(() => {
    const s = JSON.parse(localStorage.getItem("stillroom.v3")!);
    s.settings.countdown = 2;
    s.timer.mode = "countdown";
    s.timer.duration = 2000;
    s.preferences.view = "timer";
    localStorage.setItem("stillroom.v3", JSON.stringify(s));
  });
  await page.reload();
  await page.getByRole("button", { name: "Start", exact: false }).click();
  const id = (await state(page)).timer.id;
  const other = await context.newPage();
  await other.goto("/");
  await expect(
    other.getByRole("button", { name: "Take over in this tab" }),
  ).toBeVisible();
  await other.getByRole("button", { name: "Take over in this tab" }).click();
  await expect(other.locator(".app")).not.toHaveAttribute("inert", "");
  await expect(
    page.getByRole("button", { name: "Take over in this tab" }),
  ).toBeVisible();
  await expect
    .poll(
      async () =>
        (await state(other)).history.filter((h: any) => h.id === id).length,
    )
    .toBe(1);
  await page.getByRole("button", { name: "Take over in this tab" }).click();
  await expect(page.locator(".app")).not.toHaveAttribute("inert", "");
  expect(
    (await state(page)).history.filter((h: any) => h.id === id),
  ).toHaveLength(1);
});
test("failed browser storage remains usable and reports memory-only state", async ({
  page,
}) => {
  await page.addInitScript(() => {
    Storage.prototype.setItem = function () {
      throw new DOMException("Full", "QuotaExceededError");
    };
  });
  await open(page);
  await expect(page.getByRole("alert")).toContainText("memory only");
  await page.getByLabel("Session intention").fill("Still usable");
  await page.getByRole("button", { name: "Start" }).click();
  await expect(page.getByRole("button", { name: "Pause" })).toBeVisible();
  await page
    .getByRole("button", { name: "Show companion panel", exact: true })
    .click();
  await page.getByRole("tab", { name: "Notes" }).click();
  await expect(page.locator(".saved-indicator")).toHaveText("In memory");
});
test("practice, early finish, reflection, weekly snapshots and continue studying", async ({
  page,
}) => {
  await open(page);
  await page.clock.install();
  await tool(page, "Exam practice");
  await page.getByLabel("Exam name", { exact: true }).fill("Maths paper");
  await page.getByLabel("Total minutes").fill("30");
  await page
    .getByRole("button", { name: "Start practice", exact: true })
    .click();
  await page.clock.fastForward(60000);
  await page.getByLabel("Questions completed", { exact: true }).fill("2");
  await page.getByRole("button", { name: "Finish early & reflect" }).click();
  await page.getByLabel("What did I finish?").fill("Two questions");
  await page.getByLabel("What is my next step?").fill("Check question three");
  await choose(page, "How was my focus?", "Focused");
  await page.getByRole("button", { name: "Save reflection" }).click();
  let s = await state(page);
  expect(s.history).toHaveLength(1);
  expect(s.history[0].mode).toBe("practice");
  expect(s.history[0].duration).toBeGreaterThanOrEqual(60000);
  expect(s.timer.cycle).toBe(0);
  expect(s.study.reflections[s.history[0].id].next).toBe(
    "Check question three",
  );
  await choose(page, "Study tool", "Weekly review");
  await expect(
    page.getByText("No historical plan was captured for this week."),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Capture this week’s current task plan" })
    .click();
  expect(Object.keys((await state(page)).study.plans)).toHaveLength(1);
  await close(page);
  await expect(page.locator(".next-step")).toContainText(
    "Check question three",
  );
  await page.getByRole("button", { name: "More study actions" }).click();
  await page.getByRole("button", { name: "Continue studying" }).click();
  expect((await state(page)).timer.runningSince).toBeNull();
});
test("reviews schedule locally, reschedule, complete, and prepare paused study", async ({
  page,
}) => {
  await open(page);
  await tool(page, "Revision queue");
  await page.getByRole("button", { name: "New review" }).click();
  await page.getByLabel("Review topic").fill("Integration");
  await page.getByRole("button", { name: "Tomorrow", exact: true }).click();
  await page.getByRole("button", { name: "Save review", exact: true }).click();
  await choose(page, "Review view", "All reviews");
  await expect(
    page.getByRole("heading", { name: "Integration", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Study this" }).click();
  expect((await state(page)).timer.intention).toBe("Integration");
  expect((await state(page)).timer.runningSince).toBeNull();
  await tool(page, "Revision queue");
  await choose(page, "Review view", "All reviews");
  await choose(page, "After completing a review", "Review again in one week");
  await page
    .getByRole("button", { name: "Complete review", exact: true })
    .click();
  expect((await state(page)).study.reviews).toHaveLength(2);
});
test("notes selection creates editable tasks, completion snapshots, and parking does not pause", async ({
  page,
}) => {
  await open(page);
  await page
    .getByRole("button", { name: "Show companion panel", exact: true })
    .click();
  await page.getByRole("tab", { name: "Notes" }).click();
  await page
    .getByLabel("Scratchpad notes")
    .fill("Read chapter one\nKeep original note");
  await page.getByRole("button", { name: "Create task from notes" }).click();
  await expect(page.getByLabel("What will you work on?")).toHaveValue(
    "Read chapter one",
  );
  await page.getByRole("button", { name: "Save task" }).click();
  await page.getByRole("tab", { name: /^Tasks/ }).click();
  await page
    .getByRole("button", { name: "Complete Read chapter one", exact: true })
    .click();
  expect((await state(page)).study.completions).toHaveLength(1);
  await page.getByRole("button", { name: "Start" }).click();
  const original = (await state(page)).timer.runningSince;
  await page.getByRole("button", { name: "More study actions" }).click();
  await page
    .getByRole("button", { name: "Save for later", exact: true })
    .click();
  await page.getByLabel("A thought to come back to").fill("Buy a notebook");
  await page.getByRole("button", { name: "Save thought & return" }).click();
  expect((await state(page)).timer.runningSince).toBe(original);
  expect((await state(page)).study.parking).toHaveLength(1);
  expect((await state(page)).notes[""]).toContain("Keep original note");
});
test("command palette keyboard matching and in-page mini timer share controller", async ({
  page,
}) => {
  await page.addInitScript(() => {
    Object.defineProperty(window, "documentPictureInPicture", {
      value: undefined,
      configurable: true,
    });
  });
  await open(page);
  await page.locator(".workspace").click({ position: { x: 10, y: 10 } });
  await page.keyboard.press("Alt+k");
  await page
    .getByRole("combobox", { name: "Search commands" })
    .fill("25 minutes");
  await page.keyboard.press("Enter");
  expect((await state(page)).timer.mode).toBe("countdown");
  expect((await state(page)).timer.runningSince).toBeNull();
  await page.getByRole("button", { name: "More study actions" }).click();
  await page.getByRole("button", { name: "Mini timer", exact: true }).click();
  await page
    .locator(".mini-fallback")
    .getByRole("button", { name: "Start / resume" })
    .click();
  await expect(page.locator(".start-button")).toBeVisible();
  const id = (await state(page)).timer.id;
  await page
    .locator(".mini-fallback")
    .getByRole("button", { name: "Pause", exact: true })
    .click();
  expect((await state(page)).timer.id).toBe(id);
  expect((await state(page)).history).toHaveLength(0);
  await page.getByLabel("Session intention").focus();
  await page.keyboard.press("Alt+k");
  await expect(page.getByRole("dialog")).toHaveCount(0);
});
test("uploaded media survives reload and clear-data removes indexed media", async ({
  page,
}) => {
  await open(page);
  await settings(page, "Backgrounds");
  await page
    .getByLabel("Upload background", { exact: true })
    .setInputFiles("public/icon-192.png");
  await expect
    .poll(async () => (await state(page)).preferences.background.mediaId)
    .not.toBe("");
  const id = (await state(page)).preferences.background.mediaId;
  await close(page);
  await page.reload();
  await expect(page.locator(".background-scene img")).toBeVisible();
  expect((await state(page)).preferences.background.mediaId).toBe(id);
  await settings(page, "Data & Privacy");
  await page
    .getByRole("button", { name: "Clear all local data", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Yes, clear everything", exact: true })
    .click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  expect(
    await page.evaluate(
      () =>
        new Promise<number>((resolve, reject) => {
          const r = indexedDB.open("stillroom.media", 1);
          r.onsuccess = () => {
            const db = r.result;
            const q = db.transaction("assets").objectStore("assets").count();
            q.onsuccess = () => {
              resolve(q.result);
              db.close();
            };
          };
          r.onerror = () => reject(r.error);
        }),
    ),
  ).toBe(0);
});
test("dropdown portals open in dark and light themes, including settings and tools", async ({
  page,
}) => {
  await open(page);
  for (const theme of ["Midnight Library", "Paper Desk"]) {
    await settings(page, "Appearance");
    await page
      .getByRole("dialog")
      .getByRole("button", { name: new RegExp(theme) })
      .click();
    await close(page);
    await page.getByRole("combobox", { name: "Active study subject" }).click();
    let popup = page.locator("[data-stillroom-menu]");
    await expect(popup).toBeVisible();
    const colors = await popup.evaluate((e) => ({
      bg: getComputedStyle(e).backgroundColor,
      fg: getComputedStyle(e).color,
    }));
    expect(colors.bg).not.toBe("rgba(0, 0, 0, 0)");
    expect(colors.bg).not.toBe(colors.fg);
    await page.keyboard.press("Escape");
    await settings(page, "Clock & Typography");
    for (const name of [
      "Timer font",
      "Timer font weight",
      "Session tally style",
      "Clock timezone",
    ]) {
      await page.getByRole("combobox", { name, exact: true }).click();
      await expect(popup).toBeVisible();
      expect(await popup.evaluate((e) => !!e.closest("dialog"))).toBe(true);
      await page.keyboard.press("ArrowDown");
      await page.keyboard.press("Escape");
    }
    await page.screenshot({
      path: `artifacts/dropdown-${theme.replaceAll(" ", "-")}.png`,
      fullPage: true,
    });
    await close(page);
    await tool(page, "Revision queue");
    await page.getByRole("combobox", { name: "Review view" }).click();
    await expect(popup).toBeVisible();
    await page.keyboard.press("Escape");
    await close(page);
  }
  for (const width of [320, 768, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    await tool(page, "Exam practice");
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    expect(
      await page
        .locator("dialog")
        .evaluate((e) => e.scrollWidth <= e.clientWidth),
    ).toBe(true);
    await close(page);
  }
});
