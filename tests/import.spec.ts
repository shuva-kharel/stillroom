import { test, expect, type Page } from "@playwright/test";
import { readFile } from "node:fs/promises";

async function openData(page: Page) {
  await page.getByRole("button", { name: "Settings", exact: true }).click();
  await page.getByRole("tab", { name: "Data & Privacy", exact: true }).click();
}
const state = (page: Page) =>
  page.evaluate(() => JSON.parse(localStorage.getItem("stillroom.v3")!));

for (const viewport of [
  { width: 1366, height: 768 },
  { width: 390, height: 844 },
]) {
  test(`actual exported file imports visibly and persists at ${viewport.width}px`, async ({
    page,
  }) => {
    await page.setViewportSize(viewport);
    await page.goto("/");
    await expect(page.locator(".app")).not.toHaveAttribute("inert", "");
    await page.getByLabel("Session intention").fill("From exported backup");
    await page.getByRole("button", { name: "Start", exact: true }).click();
    await openData(page);
    const downloading = page.waitForEvent("download");
    await page.getByRole("button", { name: "Export JSON" }).click();
    const file = await (await downloading).path();
    const snapshot = JSON.parse(await readFile(file!, "utf8"));
    expect(snapshot.timer.runningSince).toBeNull();
    expect((await state(page)).timer.runningSince).not.toBeNull();
    await page
      .getByRole("button", { name: "Close dialog", exact: true })
      .click();
    await page.getByRole("button", { name: "Pause", exact: true }).click();
    await page.getByLabel("Session intention").fill("Keep unless confirmed");
    await openData(page);
    const before = await state(page);
    const choose = async () => {
      const chooser = page.waitForEvent("filechooser");
      await page
        .getByRole("button", { name: "Import JSON", exact: true })
        .click();
      await (await chooser).setFiles(file!);
    };
    await choose();
    const confirmation = page.getByRole("dialog", {
      name: "Replace this room?",
      exact: true,
    });
    await expect(confirmation).toBeVisible();
    await expect(
      confirmation.getByRole("button", { name: "Replace with backup" }),
    ).toBeInViewport();
    expect(await state(page)).toEqual(before);
    await page.keyboard.press("Escape");
    await expect(confirmation).toHaveCount(0);
    await expect(
      page.getByRole("button", { name: "Import JSON", exact: true }),
    ).toBeFocused();
    expect(await state(page)).toEqual(before);
    await choose();
    await confirmation
      .getByRole("button", { name: "Replace with backup" })
      .click();
    await expect(page.getByLabel("Session intention")).toHaveValue(
      "From exported backup",
    );
    expect((await state(page)).timer).toEqual(snapshot.timer);
    await page.reload();
    await expect(page.getByLabel("Session intention")).toHaveValue(
      "From exported backup",
    );
    expect((await state(page)).timer).toEqual(snapshot.timer);
    expect((await state(page)).history).toEqual(snapshot.history);
  });
}

test("invalid import feedback is visible beside the control without replacing data", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await expect(page.locator(".app")).not.toHaveAttribute("inert", "");
  await page.getByLabel("Session intention").fill("Must survive");
  await openData(page);
  const before = await state(page);
  const chooser = page.waitForEvent("filechooser");
  await page.getByRole("button", { name: "Import JSON", exact: true }).click();
  await (
    await chooser
  ).setFiles({
    name: "broken.json",
    mimeType: "application/json",
    buffer: Buffer.from("{"),
  });
  await expect(page.getByRole("alert")).toContainText("not valid JSON");
  await expect(page.getByRole("alert")).toBeInViewport();
  await expect(page.getByRole("alert")).toBeFocused();
  expect(await state(page)).toEqual(before);
});
