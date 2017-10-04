
var session = {
  masterPassword: null,
  runningPageActionAnimation: false,
  currentUrl: "",
  currentProfile: null,
  currentTabId: null,
  injectedTabs: []
};

// Parse the public suffix list for hostnames, this only has to happen once while the scripts are in RAM.
publicSuffixList.parse(publicSuffixListRaw, punycode.toASCII);
// Same for the password requirement list.
passwordReqListParser.parse(passwordReqList);

createOrUpdateMenu();

loadStoredMasterPassword();

showAlertIfNotSeen("first-run");


function generatePasswordForProfile(url, masterPassword, profileSettings, hostnameOverride, requestId) {
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
      hostnameOverride: hostnameOverride,
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
    };
    generatedPassword = pmGeneratePassword(masterPassword, url, engineSpecificSettings, requestId);
  }
  return generatedPassword;
}

function activateOnPage(url, masterPassword, profileId, hostnameOverride) {
  if(profileId === undefined) {
    profileId = session.currentProfile;
  }
  if(profileId === null) {
    return;
  }
  var profileSettings = currentSettings.profiles[profileId];
  generatePasswordForProfile(url, masterPassword, profileSettings, hostnameOverride, null).then((generatedPassword) => {
    if(generatedPassword !== null && generatedPassword.password !== null) {
      browser.tabs.executeScript({file: "/injector.js"}).then(() => {
        browser.tabs.executeScript({code: "fillPassword('" + generatedPassword.password + "');"});
      });
    }
  });
}

function storeMasterPassword(masterPassword) {
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

function clearStoredMasterPassword() {
  return browser.storage.local.remove("storedMasterPassword");
}

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

browser.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if(request != null && request.getSessionVariable !== undefined) {
    if(session != undefined) {
      sendResponse(session[request.getSessionVariable]);
    } else {
      sendResponse(null);
    }
  }
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
  if(request != null && request.clearStoredMasterPassword !== undefined) {
    clearStoredMasterPassword();
  }
  if(request != null && request.activateOnPage !== undefined) {
    loadSettings().then(() => {
      if(currentSettings.storeMasterPassword != "never") {
        session.masterPassword = request.masterPassword;
        if(currentSettings.storeMasterPassword == "permanent") {
          storeMasterPassword(request.masterPassword);
        }
      }
    });
    if(currentSettings.showPageAction == "when-needed" && session.currentTabId !== null) {
      browser.pageAction.hide(session.currentTabId);
    }
    var currentUrl = session.currentUrl;
    activateOnPage(currentUrl, request.masterPassword, request.profileId, request.hostnameOverride);
  }
  if(request != null && request.wantExamplePasswordForProfile !== undefined) {
    loadSettings().then(() => {
      var profileSettings = currentSettings.profiles[request.wantExamplePasswordForProfile];
      generatePasswordForProfile("https://subdomain.example.com/test.html", "example master password", profileSettings, null, request.id).then((response) => {
        sendResponse({examplePassword: response.password, requestId: response.requestId});
      });
    });
    return true;
  }
  if(request != null && request.generatePassword !== undefined) {
    loadSettings().then(() => {
      if(request.profileId !== undefined || session.currentProfile != null) {
        var profileId = (request.profileId !== undefined) ? request.profileId : session.currentProfile;
        var profileSettings = currentSettings.profiles[profileId];
        var url = (request.url !== undefined) ? request.url : session.currentUrl;
        generatePasswordForProfile(url, request.masterPassword, profileSettings, request.hostnameOverride, request.id).then((response) => {
          sendResponse({generatedPassword: response.password, requestId: response.requestId});
        });
      } else {
        sendResponse({generatedPassword: null, requestId: request.id});
      }
    });
    return true;
  }
  if(request != null && request.numberOfPasswordFields !== undefined && currentSettings.showPageAction == "when-applicable") {
    if(request.numberOfPasswordFields > 0) {
      browser.pageAction.show(request.tabId);
    } else {
      browser.pageAction.hide(request.tabId);
    }
  }
});

function activateProfile(profileId, url) {
  session.currentProfile = profileId;
  if(session.masterPassword === null) {
    if(session.currentTabId !== null && !session.runningPageActionAnimation) {
      browser.pageAction.show(session.currentTabId);
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

browser.menus.onClicked.addListener((info, tab) => {
  if (info.menuItemId.startsWith("password-shaker-menu-profile-") || info.menuItemId.startsWith("password-shaker-tools-profile-")) {
    if(!info["pageUrl"].startsWith("about:")) {
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

function animatePageAction(script, tabId) {
  session.runningPageActionAnimation = true;
  if(script.length == 0) {
    session.runningPageActionAnimation = false;
    return;
  }
  var frame = script[0].split(":");
  browser.pageAction.setIcon({
    path: "/icons/logo-" + frame[0] + ".svg",
    tabId: tabId
  });
  window.setTimeout(() => {
    animatePageAction(script.slice(1), tabId);
  }, parseInt(frame[1], 10));
}

function reactToTabChange(tabId, newUrl) {
  loadSettings().then(() => {
    session.currentUrl = newUrl;
    session.currentProfile = null;
    if(currentSettings.showPageAction == "always"
       && typeof newUrl == "string"
       && !newUrl.startsWith("about:")
       && newUrl.length > 0) {
      browser.pageAction.show(tabId);
    } else if(currentSettings.showPageAction == "when-needed") {
      browser.pageAction.hide(tabId);
    }
  });
}
browser.tabs.onActivated.addListener((activeInfo) => {
  var tabId = activeInfo.tabId;
  browser.tabs.get(tabId).then((tab) => {
    if(currentSettings.showPageAction == "when-applicable" && !tab.url.startsWith("about:")) {
      if(!session.injectedTabs.includes(tabId)) {
        session.injectedTabs.push(tabId);
        browser.tabs.executeScript({file: "/injector.js"}).then(() => {
          browser.tabs.executeScript({code: "sendNumberOfPasswordFields(" + tabId + "); installChangeListener(" + tabId + ");"});
        });
      }
    }
    session.currentTabId = tabId;
    reactToTabChange(tabId, tab.url);
  });
});
browser.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if(tabId == session.currentTabId && changeInfo.url !== undefined) {
    reactToTabChange(tabId, changeInfo.url);
    if(currentSettings.showPageAction == "when-applicable") {
      browser.tabs.executeScript({file: "/injector.js"}).then(() => {
        browser.tabs.executeScript({code: "sendNumberOfPasswordFields(" + tabId + "); installChangeListener(" + tabId + ");"});
        if(!session.injectedTabs.includes(tabId)) {
          session.injectedTabs.push(tabId);
        }
      });
    }
  }
});
