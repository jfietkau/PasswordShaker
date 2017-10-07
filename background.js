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

// The background script holds session variables while it's running,
// this stuff gets thrown out when the extension is unloaded
var session = {
  masterPassword: null,
  runningPageActionAnimation: false,
  currentUrl: "",
  currentProfile: null,
  currentTabId: null,
  injectedTabs: []
};

// Some things that we do upon loading

// Parse the public suffix list for hostnames, this only has to happen once while the scripts are in RAM.
publicSuffixList.parse(publicSuffixListRaw, punycode.toASCII);
// Same for the password requirement list.
passwordReqListParser.parse(passwordReqList);
// Populate the menus according to user preferences
createOrUpdateMenu();
// If there is a master password stored on disk, retrieve it
loadStoredMasterPassword();
// Check to see if we still have the same optional permissions that we had last time
checkOptionalPermissions();
// If the extension was just freshly installed, show the intro page in a tab
showAlertIfNotSeen("first-run");

// This extension can use some optional permissions. This function checks whether the user settings
// are aligning with the optional permissions. If they are not, downgrade accordingly.
function checkOptionalPermissions() {
  if(currentSettings === undefined || currentSettings.showPageAction === undefined) {
    // User settings may not be loaded yet. If so, load them and then try again.
    loadSettings().then(() => {
      checkOptionalPermissions();
    });
  } else {
    if(currentSettings.showPageAction == "when-applicable") {
      browser.permissions.contains({
        origins: ["<all_urls>"]
      }).then((result) => {
        if(!result) {
          // Permission has been revoked at some point, so we downgrade the corresponding setting
          // so it matches the actual behavior.
          currentSettings.showPageAction = "when-needed";
          saveSettings();
        }
      });
    } else {
      // If the user setting does not require the optional permission, let go of it here for
      // security reasons. When the user changes the settings we can always ask again.
      browser.permissions.remove({
        origins: ["<all_urls>"]
      });
    }
  }
}

// This function generates a password for a given input structure. Returns a promise that gets
// resolved with the resulting password. The password will be null if generation failed.
//  url: the URL that the password should be used for. Depending on the generation engine, it may
//       use just the hostname.
//  masterPassword: self-explanatory
//  profileSettings: a complete profile
//  inputTextOverride: input text that should be used instead of the one extracted from the URL.
//                     This is for when the user changes the input text by hand.
//  requestId: can be any value. This gets passed back out through the promise object to allow
//             callers to differentiate between several asynchronous requests.
function generatePasswordForProfile(url, masterPassword, profileSettings, inputTextOverride, requestId) {
  var generatedPassword = null;
  if(profileSettings.profileEngine == "profileEngineDefault") {
    var engineSpecificSettings = {
      passwordLength: profileSettings.psPasswordLength,
      charactersAlphaCap: profileSettings.psCharactersAlphaCap,
      charactersAlphaLower: profileSettings.psCharactersAlphaLower,
      charactersNumbers: profileSettings.psCharactersNumbers,
      charactersSpecial: profileSettings.psCharactersSpecial,
      charactersSpaceQuotation: profileSettings.psCharactersSpaceQuotation,
      charactersCustom: profileSettings.psCharactersCustom,
      charactersCustomList: profileSettings.psCharactersCustomList,
      hashAlgorithm: profileSettings.psHashAlgorithm,
      hashAlgorithmCoefficient: profileSettings.psAlgorithmCoefficient,
      mainSalt: profileSettings.psMainSalt,
      useSiteSpecificRequirements: profileSettings.psUseSiteSpecificRequirements,
      passwordRequirements: null,
      inputTextOverride: inputTextOverride,
    };
    if(profileSettings.psUseSiteSpecificRequirements) {
      engineSpecificSettings.passwordRequirements = passwordReqListParser.byUrl(url);
    }
    generatedPassword = psGeneratePassword(masterPassword, url, engineSpecificSettings, requestId);
  } else if(profileSettings.profileEngine == "profileEnginePasswordMaker") {
    var engineSpecificSettings = {
      charSet: (profileSettings.pmCharacterSet == "custom") ? profileSettings.pmCustomCharacterList : profileSettings.pmCharacterSet,
      hashAlgorithm: profileSettings.pmHashAlgorithm,
      whereToUseL33t: profileSettings.pmUseLeet,
      l33tLevel: profileSettings.pmLeetLevel,
      passwordLength: profileSettings.pmPasswordLength,
      userName: profileSettings.pmUsername,
      modifier: profileSettings.pmModifier,
      passwordPrefix: profileSettings.pmPasswordPrefix,
      passwordSuffix: profileSettings.pmPasswordSuffix,
      useProtocol: profileSettings.pmUseProtocol,
      useSubdomains: profileSettings.pmUseSubdomains,
      useDomain: profileSettings.pmUseDomain,
      usePath: profileSettings.pmUseOther,
      inputTextOverride: inputTextOverride,
    };
    generatedPassword = pmGeneratePassword(masterPassword, url, engineSpecificSettings, requestId);
  }
  return generatedPassword;
}

// This function takes the given parameters to calculate a site-specific password and
// then inject it into the page. See injector.js for how the actual password field is populated.
function activateOnPage(url, masterPassword, profileId, inputTextOverride) {
  if(profileId === undefined) {
    profileId = session.currentProfile;
  }
  if(profileId === null) {
    return;
  }
  var profileSettings = currentSettings.profiles[profileId];
  generatePasswordForProfile(url, masterPassword, profileSettings, inputTextOverride, null).then((generatedPassword) => {
    if(generatedPassword !== null && generatedPassword.password !== null) {
      browser.tabs.executeScript({file: "/injector.js"}).then(() => {
        browser.tabs.executeScript({code: "fillPassword('" + generatedPassword.password + "');"});
      });
    }
  });
}

// This function stores the master password in the extension's local storage.
function storeMasterPassword(masterPassword) {
  // We do some mild obfuscation in order to not just have the master password in the JSON file
  // in plain text. Yes, I am aware that this is not encryption and will not protect against an
  // attacker. This is just to protect against accidentally putting the PW on screen.
  var textEncoder = new TextEncoder();
  var masterPasswordArray = textEncoder.encode(masterPassword);
  var xorKey = getRandomBytes(masterPasswordArray.length);
  for(var i = 0; i < masterPasswordArray.length; i++) {
    masterPasswordArray[i] = xorKey[i] ^ masterPasswordArray[i];
  }
  var storedMasterPassword = {};
  storedMasterPassword.firstHalf = arr2hex(xorKey);
  storedMasterPassword.secondHalf = arr2hex(masterPasswordArray);
  return browser.storage.local.set({storedMasterPassword: storedMasterPassword});
}

// Retrieves a master password that was previously stored (if any) and put it into the session.
function loadStoredMasterPassword() {
  return browser.storage.local.get("storedMasterPassword").then((loadedMasterPassword) => {
    if(loadedMasterPassword != null
       && loadedMasterPassword.hasOwnProperty("storedMasterPassword")
       && loadedMasterPassword["storedMasterPassword"] !== null) {
      var loaded = loadedMasterPassword["storedMasterPassword"];
      loaded.firstHalf = hex2arr(loaded.firstHalf);
      loaded.secondHalf = hex2arr(loaded.secondHalf);
      var masterPasswordArray = new Uint8Array(loaded.firstHalf.length);
      for(var i = 0; i < masterPasswordArray.length; i++) {
        masterPasswordArray[i] = loaded.firstHalf[i] ^ loaded.secondHalf[i];
      }
      var textDecoder = new TextDecoder();
      session.masterPassword = textDecoder.decode(masterPasswordArray);
    }
  });
}

// Deletes any stored master password
function clearStoredMasterPassword() {
  return browser.storage.local.remove("storedMasterPassword");
}

// Saves the given master password hash into local storage.
function saveStoredHash(hash, salt, algorithm) {
  var storedHash = {};
  storedHash.hash = hash;
  if(salt) {
    storedHash.salt = salt;
  }
  storedHash.algorithm = algorithm;
  return browser.storage.local.set({ masterPasswordHash: storedHash });
}

// Retrieves a master password hash that was previously stored (if any).
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

// Deletes any stored master password hash
function clearStoredHash() {
  return browser.storage.local.remove("masterPasswordHash");
}

// This function opens the given page from the documentation in a tab for the user to read, but
// only once per alert. This is fairly intrusive, so we aim to only use it for the intro page and
// then maybe for super important security alerts.
function showAlertIfNotSeen(alertName) {
  browser.storage.local.get("pastAlerts").then((loadedPastAlerts) => {
    var pastAlerts = [];
    if(loadedPastAlerts != null
       && loadedPastAlerts.hasOwnProperty("pastAlerts")
       && loadedPastAlerts["pastAlerts"] !== null) {
      pastAlerts = loadedPastAlerts["pastAlerts"];
    }
    if(!pastAlerts.includes(alertName)) {
      browser.tabs.create({
        url: "/docs/internal/" + alertName + "/index.html"
      }).then(() => {
        pastAlerts.push(alertName);
        browser.storage.local.set({ pastAlerts: pastAlerts });
      });
    }
  });
}

// Given any hostname, returns the "top level hostname" that'll be used to determine
// which website the user is currently on.
function extractTopLevelHostname(hostName) {
  var parts = hostName.split(".");
  if(!isNaN(parseInt(parts.slice(-1)[0]))) {
    // this is an IP address
    return hostName;
  }
  if(parts.length == 1) {
    // assumed to be a local name (no TLD)
    return hostName;
  }
  var publicSuffix = publicSuffixList.getPublicSuffix(hostName);
  // keep the public suffix plus one more name segment below that
  var result = parts.slice(-1 - publicSuffix.split(".").length);
  return result.join(".");
}

// Activate a specific profile for a given URL using the current session variables for context.
// If the master password is already cached, generate a password. If the master password has not
// been supplied yet, jiggle the page action icon to call attention to the fact that we need it.
function activateProfile(profileId, url) {
  session.currentProfile = profileId;
  if(session.masterPassword === null) {
    if(session.currentTabId !== null && !session.runningPageActionAnimation) {
      browser.pageAction.show(session.currentTabId);
      // We can't have an animated icon for the page action, but we _can_ change between several
      // static ones really quickly. ;)
      // Yeah this is pretty cheeky, but it works well and I hope it's not forbidden.
      var animation = [
        "l1:30", "l2:30", "l3:45", "l2:30", "l1:30", "b:30",
        "r1:30", "r2:30", "r3:45", "r2:30", "r1:30", "b:30",
        "l1:30", "l2:45", "l1:30", "b:30",
        "r1:30", "r2:45", "r1:30", "b:30",
        "l1:40", "b:30",
        "r1:40", "b:30",
      ];
      animatePageAction(animation, session.currentTabId);
    }
  } else {
    activateOnPage(url, session.masterPassword, profileId, null);
  }
}

// This function animates the page action icon on a specific tab according to a given
// animation script. The script is a list of frames, each consisting of a filename suffix
// and a duration. See activateProfile() for an example.
function animatePageAction(script, tabId) {
  // make sure we only run one animation at a time
  session.runningPageActionAnimation = true;
  if(script.length == 0) {
    // Animation has finished!
    session.runningPageActionAnimation = false;
    return;
  }
  // Display the first frame of the given script
  var frame = script[0].split(":");
  browser.pageAction.setIcon({
    path: "/icons/logo-" + frame[0] + ".svg",
    tabId: tabId
  });
  // Wait for the specified delay, then recurse to the rest of the script
  window.setTimeout(() => {
    animatePageAction(script.slice(1), tabId);
  }, parseInt(frame[1], 10));
}

// This function populates the context menu and, on Firefox >= 56, the tools menu.
function createOrUpdateMenu() {
  loadSettings().then(() => {
    browser.runtime.getBrowserInfo().then((info) => {
      // Gotta check what version we're on, because before v56 Firefox did not support additions to the Tools menu
      var onPre56Firefox = (info.vendor == "Mozilla" && info.name == "Firefox" && parseInt(info.version, 10) < 56);
      browser.menus.removeAll().then(() => {
        // The user can set for each profile whether it should appear in the context menu. So the number
        // of needed context menu entries can be 0, 1, or higher.
        var numberOfContextMenuEntries = 0;
        for(var i = 0; i < currentSettings.profiles.length; i++) {
          if(currentSettings.profiles[i].showInContextMenu) {
            numberOfContextMenuEntries++;
          }
        }
        for(var i = 0; i < currentSettings.profiles.length; i++) {
          var profileName = currentSettings.profiles[i].profileName;
          var itemTitle;
          var hasCustomName = true;
          // If the user hasn't given the profile a name, come up with a placeholder name
          if(profileName.length == 0) {
            var hasCustomName = false;
            if(i == 0) {
              profileName = "(default profile)";
            } else {
              profileName = "(profile " + (i + 1) + ")";
            }
          }
          // If there is only one profile that should appear in the context menu and it does
          // not have a given name, use the name of the extension instead of the placeholder
          // name of the profile
          if(numberOfContextMenuEntries == 1 && !hasCustomName) {
            itemTitle = "PasswordShaker";
          } else {
            itemTitle = profileName;
          }
          // Add profile to context menu if desired
          if(currentSettings.profiles[i].showInContextMenu) {
            browser.menus.create({
              id: "password-shaker-menu-profile-" + i,
              title: itemTitle,
              contexts: ["password"],
            });
          }
          // Add profile to tools menu (all profiles, but only if supported)
          if(!onPre56Firefox) {
            browser.menus.create({
              id: "password-shaker-tools-profile-" + i,
              title: profileName,
              contexts: ["tools_menu"],
            });
          }
        }
        // Add some more general items to the tools menu
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

// Here's where we react to clicked menu items.
browser.menus.onClicked.addListener((info, tab) => {
  if (info.menuItemId.startsWith("password-shaker-menu-profile-") || info.menuItemId.startsWith("password-shaker-tools-profile-")) {
    // Clicked a profile item. Unless we're on a browser-internal page, activate here.
    if(!info["pageUrl"].startsWith("about:") && !info["pageUrl"].startsWith("moz-extension:")) {
      var selectedProfile = parseInt(info.menuItemId.split("-")[4]);
      session.currentTabId = tab.id;
      activateProfile(selectedProfile, info["pageUrl"]);
    }
  }
  if (info.menuItemId == "password-shaker-tools-settings") {
    browser.runtime.openOptionsPage();
  }
  if (info.menuItemId == "password-shaker-tools-documentation") {
    browser.tabs.create({
      url: "/docs/index.html"
    });
  }
});

// The background script has a fair number of tasks that the page action popup, the options page or
// other components may use at various times. This is sort of our central "switchboard" for message passing.
browser.runtime.onMessage.addListener((request, sender, sendResponse) => {
  // Client is asking to retrieve a current session variable
  if(request != null && request.getSessionVariable !== undefined) {
    if(session != undefined) {
      sendResponse(session[request.getSessionVariable]);
    } else {
      sendResponse(null);
    }
  }
  // Client is asking to clear a current session variable
  if(request != null && request.clearSessionVariable !== undefined) {
    if(session != undefined) {
      session[request.clearSessionVariable] = null;
    }
  }
  // Client is asking to get details on the current URL. This includes a full URL object, its hostname, the
  // public suffix, as well as any site-specific password requirements that may exist.
  if(request != null && request.getCurrentUrlDetails !== undefined) {
    if(session != undefined && session.currentUrl != null) {
      var url = new URL(session.currentUrl);
      var publicSuffix;
      if(url.protocol == "file:") {
        publicSuffix = "Local file";
      } else {
        publicSuffix = extractTopLevelHostname(url.hostname);
      }
      var response = {
        url: url,
        hostname: url.hostname,
        passwordReq: passwordReqListParser.byUrl(session.currentUrl),
        publicSuffix: publicSuffix,
      };
      sendResponse(response);
    } else {
      sendResponse(null);
    }
  }
  // Client signals that the stored master password should be deleted now.
  if(request != null && request.clearStoredMasterPassword !== undefined) {
    clearStoredMasterPassword();
  }
  // Client sends a master password hash that should be stored.
  if(request != null && request.saveStoredHash !== undefined) {
    saveStoredHash(request.hash, request.salt, request.algorithm);
  }
  // Client requests the stored master password hash.
  if(request != null && request.loadStoredHash !== undefined) {
    loadStoredHash((loadedHash) => {
      sendResponse(loadedHash);
    });
    return true;
  }
  // Client signals that the stored master password hash should be deleted now.
  if(request != null && request.clearStoredHash !== undefined) {
    clearStoredHash();
  }
  // Client signals that the menu items should be recreated because pertinent settings have changed.
  if(request != null && request.createOrUpdateMenu !== undefined) {
    createOrUpdateMenu();
  }
  // Client signals that PasswordShaker should be activated right now and
  // supplies a full request including the master password that should be used.
  if(request != null && request.activateOnPage !== undefined) {
    loadSettings().then(() => {
      if(currentSettings.storeMasterPassword != "never") {
        // cache master password in RAM if desired
        session.masterPassword = request.masterPassword;
        if(currentSettings.storeMasterPassword == "permanent") {
          // also save master password on disk if desired
          storeMasterPassword(request.masterPassword);
        }
      }
    });
    if(currentSettings.showPageAction == "when-needed" && session.currentTabId !== null) {
      // Since the master password has been provided along with this request, we donÄt need the icon anymore
      browser.pageAction.hide(session.currentTabId);
    }
    var currentUrl = session.currentUrl;
    activateOnPage(currentUrl, request.masterPassword, request.profileId, request.inputTextOverride);
  }
  // Client requests an example password for the given profile.
  if(request != null && request.wantExamplePasswordForProfile !== undefined) {
    loadSettings().then(() => {
      var profileSettings = currentSettings.profiles[request.wantExamplePasswordForProfile];
      generatePasswordForProfile("https://subdomain.example.com/test.html", "example master password", profileSettings, null, request.id).then((response) => {
        sendResponse({examplePassword: response.password, inputText: response.inputText, requestId: response.requestId});
      });
    });
    return true;
  }
  // Client requests the generated password for the current page.
  if(request != null && request.generatePassword !== undefined) {
    loadSettings().then(() => {
      // Generate a password according to the request, or send null if there is no current page
      if(request.profileId !== undefined || session.currentProfile != null) {
        var profileId = (request.profileId !== undefined) ? request.profileId : session.currentProfile;
        var profileSettings = currentSettings.profiles[profileId];
        var url = (request.url !== undefined) ? request.url : session.currentUrl;
        generatePasswordForProfile(url, request.masterPassword, profileSettings, request.inputTextOverride, request.id).then((response) => {
          sendResponse({generatedPassword: response.password, inputText: response.inputText, requestId: response.requestId});
        });
      } else {
        sendResponse({generatedPassword: null, inputText: null, requestId: request.id});
      }
    });
    return true;
  }
  // Client sends  the current number of password fields on the page in a specific tab. We only use this
  // if the show page action setting requires it.
  if(request != null && request.numberOfPasswordFields !== undefined && currentSettings.showPageAction == "when-applicable") {
    if(request.numberOfPasswordFields > 0) {
      browser.pageAction.show(request.tabId);
    } else {
      browser.pageAction.hide(request.tabId);
    }
  }
});

// React to the keyboard shortcut if it has been assigned to a profile.
browser.commands.onCommand.addListener(function(command) {
  if(command == "activate") {
    loadSettings().then(() => {
      var hotkeyProfile = null;
      for(var i = 0; i < currentSettings.profiles.length; i++) {
        if(currentSettings.profiles[i].useForHotkey) {
          hotkeyProfile = i;
          break;
        }
      }
      if(hotkeyProfile !== null) {
        browser.tabs.get(session.currentTabId).then((tab) => {
          activateProfile(hotkeyProfile, tab.url);
        });
      }
    });
  }
});

// This function gets called when we have either switched tabs, or the current tab has updated.
function reactToTabChange(tabId, newUrl) {
  // Mainly what we do here is figure out if the page action icon should be displayed right now,
  // and act accordingly.
  loadSettings().then(() => {
    session.currentUrl = newUrl;
    session.currentProfile = null;
    if(currentSettings.showPageAction == "always"
       && typeof newUrl == "string"
       && !newUrl.startsWith("about:")
       && !newUrl.startsWith("moz-extension:")
       && newUrl.length > 0) {
      browser.pageAction.show(tabId);
    } else if(currentSettings.showPageAction == "when-applicable") {
      browser.permissions.contains({
        origins: ["<all_urls>"]
      }).then((result) => {
        if(!result) {
          browser.pageAction.hide(tabId);
        }
      });
    } else if(currentSettings.showPageAction == "when-needed") {
      browser.pageAction.hide(tabId);
    }
  });
}

// When a tab is activated, check if the page action icon should be displayed.
browser.tabs.onActivated.addListener((activeInfo) => {
  var tabId = activeInfo.tabId;
  browser.tabs.get(tabId).then((tab) => {
    if(currentSettings.showPageAction == "when-applicable" && !tab.url.startsWith("about:") && !tab.url.startsWith("moz-extension:")) {
      browser.permissions.contains({
        origins: ["<all_urls>"]
      }).then((result) => {
        // Only if we haven't done it yet for this tab and its current page, find out the number of password
        // fields and watch for changes.
        if(result && !session.injectedTabs.includes(tabId)) {
          session.injectedTabs.push(tabId);
          browser.tabs.executeScript({file: "/injector.js"}).then(() => {
            browser.tabs.executeScript({code: "sendNumberOfPasswordFields(" + tabId + "); installChangeListener(" + tabId + ");"});
          });
        }
      });
    }
    session.currentTabId = tabId;
    reactToTabChange(tabId, tab.url);
  });
});

// When a tab is updated (new URL -> new page), same as above.
browser.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if(tabId == session.currentTabId && changeInfo.url !== undefined) {
    if(currentSettings.showPageAction == "when-applicable" && !changeInfo.url.startsWith("about:") && !changeInfo.url.startsWith("moz-extension:")) {
      browser.permissions.contains({
        origins: ["<all_urls>"]
      }).then((result) => {
        // Only if we haven't done it yet for this tab and its current page, find out the number of password
        // fields and watch for changes.
        browser.tabs.executeScript({file: "/injector.js"}).then(() => {
          browser.tabs.executeScript({code: "sendNumberOfPasswordFields(" + tabId + "); installChangeListener(" + tabId + ");"});
          if(!session.injectedTabs.includes(tabId)) {
            session.injectedTabs.push(tabId);
          }
        });
      });
    }
    reactToTabChange(tabId, changeInfo.url);
  }
});

