var currentSettings = {test: 1234};

function loadSettings() {
  console.log("Loading...");
  browser.storage.local.get("settings").then((loadedSettings) => {
    currentSettings = loadedSettings;
    console.log("Loaded: " + currentSettings);
  });
}

function saveSettings() {
  console.log("Saving...");
  browser.storage.local.set({settings: currentSettings}).then(() => {
    console.log("Saved: " + currentSettings);
  });
}