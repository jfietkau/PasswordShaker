/**
 * PasswordShaker
 * https://github.com/jfietkau/PasswordShaker/
 *
 * Copyright (c) 2017 Julian Fietkau
 *
 *************************************************************************
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program.  If not, see <http://www.gnu.org/licenses/>.
 *
 *************************************************************************
 */

// This script provides access to the user settings including all profiles. It also provides
// facilities to persist and load settings as well as some auxiliary functions.
// This script may be loaded in different contexts (background page, page action popup,
// settings page, etc.) and different instances of the settings object are not automatically
// synchronized. Make sure to load and save the settings appropriately.

// core data structure
var currentSettings = {};

// utility function
function getRandomBytes(numberOfBytes) {
  var buffer = new ArrayBuffer(numberOfBytes);
  var uint8View = new Uint8Array(buffer);
  // fancy crypto-safe randomness
  window.crypto.getRandomValues(uint8View);
  return uint8View;
}

// helper function
function arr2hex(byteArray) {
  result = "";
  for(var i = 0; i < byteArray.length; i++) {
    result += ('0' + byteArray[i].toString(16)).slice(-2);
  }
  return result;
}

// helper function
function hex2arr(hex) {
  var buffer = new ArrayBuffer(Math.floor(hex.length / 2));
  var uint8View = new Uint8Array(buffer);
  for(var i = 0; i < uint8View.length; i++) {
    uint8View[i] = parseInt(hex.slice(i * 2, (i + 1) * 2), 16);
  }
  return uint8View;
}

// This function wipes all settings.
function clearSettings() {
  currentSettings = {};
  return browser.storage.local.remove("settings");
}

// Load settings from local storage and pre-fill with default values if anything is missing.
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

// Save settings to storage.
function saveSettings() {
  return browser.storage.local.set({settings: currentSettings});
}

// This helper function extends one object with the properties of another. It's used to
// fill an incomplete or empty settings object with any default values that are missing.
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

// Default values for the overarching settings
function getDefaultSettings() {
  return {
    verifyMasterPassword: true,
    showMasterPassword: false,
    showGeneratedPassword: true,
    showVisualHash: false,
    visualHashMinInputLength: 8,
    visualHashDelay: 800,
    storeMasterPassword: "volatile",
    storeMasterPasswordHash: false,
    showPageAction: "always",
    showPasswordDelay: 500,
    showSecurityAlerts: true,
    pageActionIconStyle: "default",
    profiles: []
  };
}

// Default values for a new profile
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
    psHashAlgorithm: "scrypt",
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

