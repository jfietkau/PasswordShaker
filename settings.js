var currentSettings = {};

function loadSettings() {
  console.log("Loading...");
  browser.storage.local.get("settings").then((loadedSettings) => {
    if(loadedSettings != null) {
      currentSettings = loadedSettings;
    }
    extendObjectWith(currentSettings, getDefaultSettings());
    if(currentSettings.profiles.length == 0) {
      currentSettings.profiles = {};
    }
    for(var profile in currentSettings.profiles) {
      extendObjectWith(profile, getDefaultProfileSettings());
    }
    console.log("Loaded: " + Object.keys(currentSettings));
  });
}

function saveSettings() {
  console.log("Saving...");
  browser.storage.local.set({settings: currentSettings}).then(() => {
    console.log("Saved: " + Object.keys(currentSettings));
  });
}

function extendObjectWith(base, extension) {
  if(base == null || extension == null) {
    return null;
  }
  for(var property in extension) {
    if(extension.hasOwnProperty(property)) {
      if(!base.hasOwnProperty(property)) {
        base[property] = extension[property];
      }
    }
  }
}

function getDefaultSettings() {
  return {
    verifyMasterPassword: true,
    showMasterPassword: false,
    storeMasterPasswordHash: false,
    storeMasterPassword: "volatile",
    profiles: []
  };
}

function getDefaultProfileSettings() {
  return {
    profileName: "",
    profileEngine: "profileEngineDefault",
    psPasswordLength: 16,
    psCharactersAlphaCap: true,
    psCharactersAlphaLower: true,
    psCharactersNumbers: true,
    psCharactersSpecial: true,
    psCharactersQuotation: false,
    psCharactersCustom: false,
    psCharactersCustomList: "",
    psHashAlgorithm: "sha256",
    psUseSiteSpecificRequirements: true,
    pmUseLeet: "off",
    pmLeetLevel: 0,
    pmHashAlgorithm: "md5",
    pmUseProtocol: false,
    pmUseSubdomains: false,
    pmUseDomain: true,
    pmUseOther: false,
    pmPasswordLength: 8,
    pmUsername: "",
    pmModifier: "",
    pmCharacterSet: "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789`~!@#$%^&*()_-+={}|[]\\:\";'<>?,./",
    pmPasswordPrefix: "",
    pmPasswordSuffix: "",
    showInContextMenu: true
  };
}