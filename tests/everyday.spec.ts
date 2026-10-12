import { test, expect, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

const state = (p: Page) =>
  p.evaluate(() => JSON.parse(localStorage.getItem("stillroom.v3")!));
async function settings(p: Page, tab: string) {
  await p.getByRole("button", { name: "Settings", exact: true }).click();
  await p.getByRole("tab", { name: tab, exact: true }).click();
}
async function close(p: Page) {
  await p.getByRole("button", { name: "Close dialog", exact: true }).click();
}
async function places(p: Page) {
  await p.getByRole("button", { name: "More study actions" }).click();
  await p.getByRole("button", { name: "Saved places", exact: true }).click();
}
for (const width of [1366, 390]) {
  test(`save place, resume, edit, undo and actual backup round trip at ${width}px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: width === 390 ? 844 : 768 });
    await page.goto("/");
    await expect(page.locator(".app")).not.toHaveAttribute("inert", "");
    await page.screenshot({
      path: `artifacts/everyday-room-${width}.png`,
      animations: "disabled",
    });
    await page.getByRole("button", { name: "Start", exact: true }).click(); // No intention required.
    const timer = (await state(page)).timer;
    await page.getByRole("button", { name: "Save place", exact: true }).click();
    await expect(
      page.getByLabel("Bookmark label", { exact: true }),
    ).toBeFocused();
    await page
      .getByLabel("Bookmark label", { exact: true })
      .fill("Integration by parts");
    await page.getByLabel("Resource name").fill("Anton Calculus");
    await page
      .getByLabel("Page, chapter, question or timestamp")
      .fill("Page 42 · question 7");
    await page
      .getByLabel("Resource URL (optional)")
      .fill("javascript:alert(1)");
    await page
      .getByRole("button", { name: "Save bookmark", exact: true })
      .click();
    await expect(page.getByRole("alert")).toContainText("HTTP or HTTPS");
    expect((await state(page)).study.bookmarks).toHaveLength(0);
    await page
      .getByLabel("Resource URL (optional)")
      .fill("https://example.org/calculus");
    const select = page.getByRole("combobox", { name: "Bookmark subject" });
    await select.click();
    await expect(
      page.getByRole("option", { name: "Independent study", exact: true }),
    ).toBeVisible();
    await page.screenshot({
      path: `artifacts/everyday-bookmark-dropdown-${width}.png`,
      animations: "disabled",
    });
    await page.keyboard.press("Escape");
    await expect(select).toBeFocused();
    await page
      .getByRole("button", { name: "Save bookmark", exact: true })
      .click();
    await expect(
      page.getByRole("button", { name: "Save place", exact: true }),
    ).toBeFocused();
    expect((await state(page)).timer).toEqual(timer);
    await page.getByRole("button", { name: "More study actions" }).click();
    await expect(
      page.getByRole("button", { name: /Continue studying/ }),
    ).toContainText("Page 42 · question 7");
    await page.getByRole("button", { name: /Continue studying/ }).click();
    expect((await state(page)).timer).toEqual(timer);
    await page.getByRole("button", { name: "Pause", exact: true }).click();
    await settings(page, "Data & Privacy");
    const downloading = page.waitForEvent("download");
    await page.getByRole("button", { name: "Export JSON" }).click();
    const file = await (await downloading).path();
    await close(page);
    await page.reload();
    await places(page);
    await expect(
      page.getByText("Anton Calculus · Page 42 · question 7", { exact: true }),
    ).toBeVisible();
    await expect(
      page.getByRole("link", {
        name: "Open resource for Integration by parts",
      }),
    ).toHaveAttribute("href", "https://example.org/calculus");
    await page
      .getByRole("button", { name: "Edit bookmark Integration by parts" })
      .click();
    await page
      .getByLabel("Page, chapter, question or timestamp")
      .fill("Question 8");
    await page
      .getByRole("button", { name: "Save bookmark", exact: true })
      .click();
    await page
      .getByRole("button", { name: "Delete bookmark Integration by parts" })
      .click();
    await page.getByRole("button", { name: "Undo", exact: true }).click();
    expect((await state(page)).study.bookmarks).toHaveLength(1);
    expect((await state(page)).study.bookmarks[0].location).toBe("Question 8");
    await close(page);
    await settings(page, "Data & Privacy");
    const chooser = page.waitForEvent("filechooser");
    await page
      .getByRole("button", { name: "Import JSON", exact: true })
      .click();
    await (await chooser).setFiles(file!);
    await page.getByRole("button", { name: "Replace with backup" }).click();
    await page.reload();
    await places(page);
    await expect(
      page.getByText("Anton Calculus · Page 42 · question 7", { exact: true }),
    ).toBeVisible();
    const axe = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
      .analyze();
    expect(axe.violations).toEqual([]);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth > innerWidth,
      ),
    ).toBe(false);
  });
}

test("wrap-up is skippable, history edits update one session and surface its next step", async ({
  page,
}) => {
  await page.goto("/");
  await expect(page.locator(".app")).not.toHaveAttribute("inert", "");
  await page.clock.install();
  await page.getByRole("button", { name: "Start", exact: true }).click();
  await page.clock.fastForward(12000);
  await page
    .getByRole("button", { name: "Reset timer (saves partial focus)" })
    .click();
  await page.getByRole("button", { name: "Skip", exact: true }).click();
  await page
    .getByRole("button", { name: "Study history", exact: true })
    .click();
  await page.getByText("Session notes", { exact: true }).click();
  await page
    .getByLabel("What did you complete?")
    .fill("Completed 12 integration questions.");
  await page
    .getByLabel("Where will you continue?")
    .fill("Continue with integration by parts, question 7.");
  await page
    .getByRole("button", { name: "Save reflection", exact: true })
    .click();
  const original = await state(page);
  await page
    .getByLabel("What did you complete?")
    .fill("Completed 13 integration questions.");
  await page
    .getByRole("button", { name: "Save reflection", exact: true })
    .click();
  expect((await state(page)).history).toEqual(original.history);
  expect(Object.keys((await state(page)).study.reflections)).toHaveLength(1);
  await close(page);
  await expect(page.locator(".next-step")).toContainText("question 7");
  await page.getByRole("button", { name: "Start", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Pause", exact: true }),
  ).toBeVisible();
});

test("quick sound controls and focus-view bookmarks never alter the session", async ({
  page,
}) => {
  await page.goto("/");
  await expect(page.locator(".app")).not.toHaveAttribute("inert", "");
  await page.getByRole("button", { name: "Start", exact: true }).click();
  const timer = (await state(page)).timer;
  await page.getByRole("button", { name: "Quick ambience controls" }).click();
  await page.getByRole("slider", { name: "Ambience volume" }).fill("0.2");
  await page.getByRole("switch", { name: "Mute ambience" }).check();
  await close(page);
  await page.keyboard.press("f");
  await page.getByRole("button", { name: "Save place", exact: true }).click();
  await page.getByLabel("Bookmark label", { exact: true }).fill("Reading");
  await page
    .getByRole("button", { name: "Save bookmark", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Save place", exact: true }),
  ).toBeFocused();
  expect((await state(page)).timer).toEqual(timer);
});
