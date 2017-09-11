
var session = {
  masterPassword: null,
  currentUrl: "",
  currentProfile: null,
  currentTabId: null
};

// Parse the public suffix list for hostnames, this only has to happen once while the scripts are in RAM.
publicSuffixList.parse(publicSuffixListRaw, punycode.toASCII);

createOrUpdateContextMenu();

loadStoredMasterPassword();


function generatePasswordForProfile(url, masterPassword, profileSettings, requestId) {
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
      useSiteSpecificRequirements: profileSettings.psUseSiteSpecificRequirements
    };
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
      usePath: profileSettings.pmUseOther
    };
    generatedPassword = pmGeneratePassword(masterPassword, url, engineSpecificSettings, requestId);
  }
  return generatedPassword;
}

function activateOnPage(url, masterPassword, profileId) {
  if(profileId === undefined) {
    profileId = session.currentProfile;
  }
  if(profileId === null) {
    return;
  }
  var profileSettings = currentSettings.profiles[profileId];
  console.log(url + " - " + profileSettings.profileEngine);
  generatePasswordForProfile(url, masterPassword, profileSettings, null).then((generatedPassword) => {
    if(generatedPassword !== null) {
      browser.tabs.executeScript({file: "/injector.js"}).then(() => {
        browser.tabs.executeScript({code: "passwordshaker_fill('" + generatedPassword.password + "');"})
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
  if(request != null && request.getCurrentTopLevelHost !== undefined) {
    if(session != undefined && session.currentUrl != null) {
      var url = new URL(session.currentUrl);
      sendResponse(extractTopLevelHostname(url.hostname));
    } else {
      sendResponse(null);
    }
  }
  if(request != null && request.clearStoredMasterPassword !== undefined) {
    clearStoredMasterPassword();
  }
  if(request != null && request.masterPassword !== undefined) {
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
    activateOnPage(currentUrl, request.masterPassword, request.profileId);
  }
  if(request != null && request.wantExamplePasswordForProfile !== undefined) {
    loadSettings().then(() => {
      var profileSettings = currentSettings.profiles[request.wantExamplePasswordForProfile];
      generatePasswordForProfile("https://subdomain.example.com/test.html", "example master password", profileSettings, request.id).then((response) => {
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
        generatePasswordForProfile(url, request.masterPassword, profileSettings, request.id).then((response) => {
          sendResponse({generatedPassword: response.password, requestId: response.requestId});
        });
      } else {
        sendResponse({generatedPassword: null, requestId: request.id});
      }
    });
    return true;
  }
});

browser.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId.startsWith("password-shaker-context-menu-")) {
    var selectedProfile = parseInt(info.menuItemId.slice("password-shaker-context-menu-".length));
    session.currentProfile = selectedProfile;
    if(session.masterPassword === null) {
      browser.pageAction.show(tab.id);
      session.currentTabId = tab.id;
    } else {
      activateOnPage(info["pageUrl"], session.masterPassword, selectedProfile);
    }
  }
});

function reactToTabChange(tabId, newUrl) {
  loadSettings().then(() => {
    session.currentUrl = newUrl;
    session.currentProfile = null;
    if(currentSettings.showPageAction == "always"
       && typeof newUrl == "string"
       && !newUrl.startsWith("about:")
       && newUrl.length > 0) {
      browser.pageAction.show(tabId);
    } else {
      browser.pageAction.hide(tabId);
    }
  });
}
browser.tabs.onActivated.addListener((activeInfo) => {
  var tabId = activeInfo.tabId;
  browser.tabs.get(tabId).then((tab) => {
    session.currentTabId = tabId;
    reactToTabChange(tabId, tab.url);
  });
});
browser.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if(tabId == session.currentTabId && changeInfo.url !== undefined) {
    reactToTabChange(tabId, changeInfo.url);
  }
});
