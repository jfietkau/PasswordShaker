var currentSettings = {};

function clearSettings() {
  currentSettings = {};
  browser.storage.local.set({settings: null}).then(() => {
    console.log("Cleared all settings!");
  });
}

function debug_showSettings() {
  console.log("Current settings: " + debug_tostr(currentSettings));
}

function debug_tostr(obj) {
  var result = [];
  for(var property in obj) {
    if(obj.hasOwnProperty(property)) {
      if(obj[property] === null) {
        result.push(property + ": null");
      } else if(typeof obj[property] === 'object') {
        result.push(property + ": " + debug_tostr(obj[property]));
      } else {
        result.push(property + ": " + obj[property]);
      }
    }
  }
  return "{" + result.join(", ") + "}";
}

function loadSettings() {
  browser.storage.local.get("settings").then((loadedSettings) => {
    console.log("Loaded: " + debug_tostr(loadedSettings));
    if(loadedSettings != null
       && loadedSettings.hasOwnProperty("settings")
       && loadedSettings["settings"] !== null) {
      currentSettings = loadedSettings["settings"];
    }
    extendObjectWith(currentSettings, getDefaultSettings());
    if(currentSettings.profiles.length == 0) {
      currentSettings.profiles = {};
    }
    for(var profile in currentSettings.profiles) {
      extendObjectWith(profile, getDefaultProfileSettings());
    }
  });
}

function saveSettings() {
  browser.storage.local.set({settings: currentSettings}).then(() => {
    console.log("Saved: " + debug_tostr(currentSettings));
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