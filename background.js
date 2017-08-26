
var session = {};
session.masterPassword = null;
session.currentUrl = "";

function activateOnPage(url, masterPassword) {
  browser.tabs.executeScript({file: "/injector.js"}).then(() => {
    browser.tabs.executeScript({code: "passwordshaker_fill('" + masterPassword + "');"})
  });
}

browser.runtime.onMessage.addListener((request, sender, sendResponse) => {
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
    if(session.masterPassword === null) {
      browser.pageAction.show(tab.id);
    } else {
      activateOnPage(info["pageUrl"], session.masterPassword);
    }
  }
});

function reactToTabChange(tabId, newUrl) {
  loadSettings().then(() => {
    session.currentUrl = newUrl;
    console.log(session.currentUrl);
    if(currentSettings.showPageAction == "always") {
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