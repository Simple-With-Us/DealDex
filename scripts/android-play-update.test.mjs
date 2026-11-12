import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { test } from "node:test";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

function read(rel) {
  return readFileSync(join(ROOT, rel), "utf8");
}

function shouldOffer({ updateAvailable, flexibleAllowed, availableVersionCode, skippedVersionCode }) {
  if (!updateAvailable) return false;
  if (!flexibleAllowed) return false;
  if (skippedVersionCode > 0 && availableVersionCode <= skippedVersionCode) return false;
  return true;
}

test("Play update offer is skippable and silent when current or unavailable", () => {
  assert.equal(
    shouldOffer({
      updateAvailable: true,
      flexibleAllowed: true,
      availableVersionCode: 3,
      skippedVersionCode: 0,
    }),
    true,
  );
  assert.equal(
    shouldOffer({
      updateAvailable: false,
      flexibleAllowed: true,
      availableVersionCode: 3,
      skippedVersionCode: 0,
    }),
    false,
  );
  assert.equal(
    shouldOffer({
      updateAvailable: true,
      flexibleAllowed: false,
      availableVersionCode: 3,
      skippedVersionCode: 0,
    }),
    false,
  );
  assert.equal(
    shouldOffer({
      updateAvailable: true,
      flexibleAllowed: true,
      availableVersionCode: 3,
      skippedVersionCode: 3,
    }),
    false,
    "Not Now skips this Play version code",
  );
});

test("Android on-open Play check uses flexible In-App Updates, not a force gate", () => {
  const gradle = read("apps/android/app/build.gradle.kts");
  assert.match(gradle, /com\.google\.android\.play:app-update/);
  assert.match(gradle, /com\.google\.android\.play:app-update-ktx/);

  const prompt = read("apps/android/app/src/main/java/me/grok/dealdex/PlayUpdatePrompt.kt");
  assert.match(prompt, /fun shouldOffer/);
  assert.match(prompt, /Update Available/);
  assert.match(prompt, /Not Now/);
  assert.match(prompt, /You can keep using this one/);
  assert.doesNotMatch(prompt, /IMMEDIATE|minVersion|force-update|coordinator|owner/i);

  const activity = read("apps/android/app/src/main/java/me/grok/dealdex/MainActivity.kt");
  assert.match(activity, /AppUpdateManagerFactory/);
  assert.match(activity, /AppUpdateType\.FLEXIBLE/);
  assert.match(activity, /UpdateAvailability\.UPDATE_AVAILABLE/);
  assert.match(activity, /addOnFailureListener/);
  assert.match(activity, /PlayUpdatePrompt\.shouldOffer/);
  assert.match(activity, /checkPlayUpdate/);
  assert.match(activity, /onResume/);
  assert.doesNotMatch(activity, /AppUpdateType\.IMMEDIATE/);
  assert.doesNotMatch(activity, /Toast\.makeText/);
  assert.doesNotMatch(activity, /coordinator|Jay|owner/i);

  const strings = read("apps/android/app/src/main/res/values/strings.xml");
  assert.match(strings, /play_update_title/);
  assert.match(strings, /play_update_not_now/);
});
