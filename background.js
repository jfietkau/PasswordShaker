
var session = {
  masterPassword: null,
  currentUrl: "",
  currentProfile: null,
  currentTabId: null
};

function activateOnPage(url, masterPassword) {
  if(currentSettings.storeMasterPassword != "never") {
    session.masterPassword = masterPassword;
  }
  if(session.currentProfile === null) {
    return;
  }
  profileSettings = currentSettings.profiles[session.currentProfile];
  var generatedPassword = null;
  if(profileSettings.profileEngine == "profileEngineDefault") {
    generatedPassword = "123";
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
    generatedPassword = pmGeneratePassword(masterPassword, url, engineSpecificSettings);
  }
  if(generatedPassword !== null) {
    browser.tabs.executeScript({file: "/injector.js"}).then(() => {
      browser.tabs.executeScript({code: "passwordshaker_fill('" + generatedPassword + "');"})
    });
 }
}

browser.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if(currentSettings.showPageAction == "when-needed" && session.currentTabId !== null) {
    browser.pageAction.hide(session.currentTabId);
  }
  if(request != null && request.masterPassword != null) {
    var currentUrl = session.currentUrl;
    activateOnPage(currentUrl, request.masterPassword);
  }
});

browser.contextMenus.create({
  id: "password-shaker",
  title: "PasswordShaker",
  contexts: ["password"],
});
browser.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId === "password-shaker") {
    session.currentProfile = 0;
    if(session.masterPassword === null) {
      browser.pageAction.show(tab.id);
      session.currentTabId = tab.id;
    } else {
      activateOnPage(info["pageUrl"], session.masterPassword);
    }
  }
});

function reactToTabChange(tabId, newUrl) {
  loadSettings().then(() => {
    session.currentUrl = newUrl;
    session.currentProfile = null;
    if(currentSettings.showPageAction == "always"
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
    reactToTabChange(tabId, tab.url);
  });
});
browser.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  reactToTabChange(tabId, changeInfo.url);
});