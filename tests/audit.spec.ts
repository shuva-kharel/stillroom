import { test, expect, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
async function open(p: Page) {
  await p.goto("/");
  await expect(p.locator(".app")).not.toHaveAttribute("inert", "");
}
async function settings(p: Page, tab: string) {
  await p.getByRole("button", { name: "Settings", exact: true }).click();
  await p.getByRole("tab", { name: tab, exact: true }).click();
}
async function close(p: Page) {
  await p.getByRole("button", { name: "Close dialog", exact: true }).click();
}
async function select(p: Page, label: string, value: string) {
  await p.getByRole("combobox", { name: label, exact: true }).click();
  await p.getByRole("option", { name: value, exact: true }).click();
}
const state = (p: Page) =>
  p.evaluate(() => JSON.parse(localStorage.getItem("stillroom.v3")!));
test("active timer survives themes, room presets, bright upload, and companion changes", async ({
  page,
}) => {
  await open(page);
  await page.getByLabel("Session intention").fill("Keep my active deadline");
  await page.getByRole("button", { name: "Start", exact: true }).click();
  const original = (await state(page)).timer;
  await settings(page, "Appearance");
  await page.getByRole("button", { name: /Aa Paper Desk/ }).click();
  await close(page);
  await page
    .getByRole("button", { name: "Show companion panel", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Hide companion panel", exact: true })
    .click();
  expect((await state(page)).timer).toEqual(original);
  await settings(page, "Backgrounds");
  await page
    .getByRole("button", { name: "Use Mountain Dawn background", exact: true })
    .click();
  await close(page);
  expect((await state(page)).timer).toEqual(original);
  await page.screenshot({
    path: "artifacts/audit/custom-background.png",
    fullPage: true,
  });
  await settings(page, "Appearance");
  await select(page, "Saved room presets", "Deep Work");
  await close(page);
  expect((await state(page)).timer).toEqual(original);
  expect((await state(page)).history).toHaveLength(0);
});
test("mixer combinations, master mute, alarm preview and completion clean up", async ({
  page,
}) => {
  await page.addInitScript(() => {
    const start = AudioBufferSourceNode.prototype.start,
      stop = AudioBufferSourceNode.prototype.stop;
    (window as any).counts = { starts: 0, stops: 0 };
    AudioBufferSourceNode.prototype.start = function (...a) {
      (window as any).counts.starts++;
      return start.apply(this, a);
    };
    AudioBufferSourceNode.prototype.stop = function (...a) {
      (window as any).counts.stops++;
      return stop.apply(this, a);
    };
  });
  await open(page);
  await settings(page, "Sounds & Music");
  await page.getByRole("button", { name: "Play Rain", exact: true }).click();
  await page
    .getByRole("button", { name: "Play Fireplace", exact: true })
    .click();
  await page
    .getByRole("slider", { name: "Rain volume", exact: true })
    .fill("0.3");
  await page
    .getByRole("slider", { name: "Master ambience volume" })
    .fill("0.4");
  await page
    .getByRole("button", { name: "Mute all ambience", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Unmute all ambience" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Stop all", exact: true }).click();
  await expect
    .poll(() => page.evaluate(() => (window as any).counts))
    .toEqual({ starts: 2, stops: 2 });
  await page
    .getByRole("tab", { name: "Alarms & Notifications", exact: true })
    .click();
  await select(page, "Alarm repetition", "Repeat 3 times");
  await page.getByRole("button", { name: "Preview focus alarm" }).click();
  await expect(
    page.getByRole("button", { name: "Dismiss alarm", exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Dismiss alarm", exact: true })
    .click();
  expect((await state(page)).history).toHaveLength(0);
  await close(page);
  await page.getByRole("tab", { name: "Timer", exact: true }).click();
  await page.getByLabel("Countdown minutes").fill("0");
  await page.getByLabel("Countdown seconds").fill("1");
  await page.getByRole("button", { name: "Set timer", exact: true }).click();
  await page.getByRole("button", { name: "Start", exact: true }).click();
  await page
    .getByRole("button", { name: "Dismiss alarm", exact: true })
    .waitFor();
  await page
    .getByRole("button", { name: "Dismiss alarm", exact: true })
    .click();
  expect((await state(page)).history).toHaveLength(1);
  await page.reload();
  expect(await page.evaluate(() => (window as any).counts.starts)).toBe(0);
});
test("Spotify is opt-in, validates links, and reports offline state without affecting study data", async ({
  page,
  context,
}) => {
  let external = 0;
  await page.route("**/open.spotify.com/**", (route) => {
    external++;
    return route.abort();
  });
  await open(page);
  await settings(page, "Sounds & Music");
  await page
    .getByLabel("Spotify link", { exact: true })
    .fill("https://example.com/evil");
  await page
    .getByRole("button", { name: "Add Spotify link", exact: true })
    .click();
  await expect(page.getByRole("alert")).toBeVisible();
  await page
    .getByLabel("Spotify link", { exact: true })
    .fill("https://open.spotify.com/playlist/1234567890123456789012");
  await page.getByLabel("Favorite name", { exact: true }).fill("Test playlist");
  await page
    .getByRole("button", { name: "Add Spotify link", exact: true })
    .click();
  await select(page, "Saved Spotify links", "Test playlist");
  expect(external).toBe(0);
  await page
    .getByRole("switch", { name: "Enable Spotify", exact: true })
    .click();
  await close(page);
  await expect(
    page.getByRole("region", { name: "Spotify music" }),
  ).toContainText("Availability is controlled by Spotify");
  await context.setOffline(true);
  await expect(
    page.getByRole("region", { name: "Spotify music" }),
  ).toContainText("unavailable offline");
  expect((await state(page)).history).toHaveLength(0);
});
test("main, companion and settings are accessible, all modes fit, reduced motion and enlarged text remain usable", async ({
  page,
}) => {
  await open(page);
  for (const [width, height] of [
    [1366, 768],
    [1440, 900],
    [1920, 1080],
    [768, 1024],
    [390, 844],
    [360, 640],
  ]) {
    await page.setViewportSize({ width, height });
    for (const mode of ["Timer", "Clock", "Pomodoro", "Stopwatch"]) {
      await page.getByRole("tab", { name: mode, exact: true }).click();
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
      ).toBe(true);
      if (mode === "Pomodoro" && width >= 1366) {
        const box = await page.locator(".start-button").boundingBox();
        expect(box!.y + box!.height).toBeLessThan(height);
      }
    }
  }
  await page.setViewportSize({ width: 1366, height: 768 });
  await page.getByRole("tab", { name: "Pomodoro", exact: true }).click();
  let result = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
    .analyze();
  expect(result.violations).toEqual([]);
  await page
    .getByRole("button", { name: "Show companion panel", exact: true })
    .click();
  result = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
    .analyze();
  expect(result.violations).toEqual([]);
  await page
    .getByRole("button", { name: "Hide companion panel", exact: true })
    .click();
  await settings(page, "Clock & Typography");
  await page.getByRole("combobox", { name: "Timer font", exact: true }).click();
  await page.keyboard.press("ArrowDown");
  await page.keyboard.press("Enter");
  await expect(
    page.getByRole("combobox", { name: "Timer font", exact: true }),
  ).toBeFocused();
  await close(page);
  await page.emulateMedia({ reducedMotion: "reduce" });
  await settings(page, "Backgrounds");
  await page
    .getByRole("button", { name: "Use Gentle Rain background", exact: true })
    .click();
  await close(page);
  await expect(page.locator(".room-backdrop")).toHaveClass(/animation-paused/);
  await page.setViewportSize({ width: 683, height: 384 });
  await page.locator(".start-button").scrollIntoViewIfNeeded();
  await expect(page.locator(".start-button")).toBeInViewport();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
});
