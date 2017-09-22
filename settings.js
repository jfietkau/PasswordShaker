var currentSettings = {};

function getRandomBytes(numberOfBytes) {
  var buffer = new ArrayBuffer(numberOfBytes);
  var uint8View = new Uint8Array(buffer);
  window.crypto.getRandomValues(uint8View);
  return uint8View;
}

function arr2hex(byteArray) {
  result = "";
  for(var i = 0; i < byteArray.length; i++) {
    result += ('0' + byteArray[i].toString(16)).slice(-2);
  }
  return result;
}

function hex2arr(hex) {
  var buffer = new ArrayBuffer(Math.floor(hex.length / 2));
  var uint8View = new Uint8Array(buffer);
  for(var i = 0; i < uint8View.length; i++) {
    uint8View[i] = parseInt(hex.slice(i * 2, (i + 1) * 2), 16);
  }
  return uint8View;
}

function clearSettings() {
  currentSettings = {};
  return browser.storage.local.remove("settings");
}

function loadSettings() {
  return browser.storage.local.get("settings").then((loadedSettings) => {
    if(loadedSettings != null
       && loadedSettings.hasOwnProperty("settings")
       && loadedSettings["settings"] !== null) {
      currentSettings = loadedSettings["settings"];
    }
    extendObjectWith(currentSettings, getDefaultSettings());
    if(currentSettings.profiles.length === 0) {
      currentSettings.profiles.push({});
    }
    for(i = 0; i < currentSettings.profiles.length; i++) {
      extendObjectWith(currentSettings.profiles[i], getDefaultProfileSettings());
    }
  });
}

function saveSettings() {
  return browser.storage.local.set({settings: currentSettings});
}

function loadStoredHash(callback) {
  return browser.storage.local.get("masterPasswordHash").then((loadedHash) => {
    var result;
    if(loadedHash != null
       && loadedHash.hasOwnProperty("masterPasswordHash")
       && loadedHash["masterPasswordHash"] !== null) {
      loadedHash = loadedHash["masterPasswordHash"];
    }
    if(loadedHash == null
       || !loadedHash.hasOwnProperty("algorithm")
       || !loadedHash.hasOwnProperty("hash")) {
      result = null;
    } else {
      result = loadedHash;
    }
    callback(result);
  });
}

function saveStoredHash(hash, salt, algorithm) {
  var storedHash = {};
  storedHash.hash = hash;
  if(salt) {
    storedHash.salt = salt;
  }
  storedHash.algorithm = algorithm;
  return browser.storage.local.set({masterPasswordHash: storedHash});
}

function clearStoredHash() {
  return browser.storage.local.remove("masterPasswordHash");
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
    showGeneratedPassword: false,
    showVisualHash: true,
    visualHashMinInputLength: 8,
    visualHashDelay: 800,
    storeMasterPassword: "volatile",
    storeMasterPasswordHash: false,
    showPageAction: "always",
    showPasswordDelay: 500,
    showSecurityAlerts: true,
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
    psCharactersSpaceQuotation: false,
    psCharactersCustom: false,
    psCharactersCustomList: "",
    psHashAlgorithm: "argon2",
    psAlgorithmCoefficient: 3,
    psMainSalt: "22a1968a9e2d8ea28e6c6a3c5e2be6c52e2a39941fdbc980da15b6c3ca05fd21b63a63d426a210546e4ac4ddc3c987f78142afa5a011bcf69c4e368139b12336",
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
    pmCustomCharacterList: "",
    pmPasswordPrefix: "",
    pmPasswordSuffix: "",
    showInContextMenu: true,
    useForHotkey: false
  };
}

function createOrUpdateMenu() {
  loadSettings().then(() => {
    browser.runtime.getBrowserInfo().then((info) => {
      var onPre56Firefox = (info.vendor == "Mozilla" && info.name == "Firefox" && parseInt(info.version, 10) < 56);
      browser.menus.removeAll().then(() => {
        var numberOfMenuEntries = 0;
        for(var i = 0; i < currentSettings.profiles.length; i++) {
          if(currentSettings.profiles[i].showInContextMenu) {
            numberOfMenuEntries++;
          }
        }
        for(var i = 0; i < currentSettings.profiles.length; i++) {
          var profileName = currentSettings.profiles[i].profileName;
          var itemTitle;
          if(profileName.length == 0) {
            if(i == 0) {
              profileName = "(default profile)";
            } else {
              profileName = "(profile " + (i + 1) + ")";
            }
          }
          if(numberOfMenuEntries == 1) {
            itemTitle = "PasswordShaker";
          } else {
            itemTitle = profileName;
          }
          if(currentSettings.profiles[i].showInContextMenu) {
            browser.menus.create({
              id: "password-shaker-menu-profile-" + i,
              title: itemTitle,
              contexts: ["password"],
            });
          }
          if(!onPre56Firefox) {
            browser.menus.create({
              id: "password-shaker-tools-profile-" + i,
              title: profileName,
              contexts: ["tools_menu"],
            });
          }
        }
        if(!onPre56Firefox) {
          browser.menus.create({
            id: "password-shaker-tools-separator",
            type: "separator",
            contexts: ["tools_menu"],
          });
          browser.menus.create({
            id: "password-shaker-tools-settings",
            title: "Settings",
            contexts: ["tools_menu"],
          });
          browser.menus.create({
            id: "password-shaker-tools-documentation",
            title: "Documentation",
            contexts: ["tools_menu"],
          });
        }
      });
    });
  });
}

