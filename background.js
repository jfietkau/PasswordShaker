
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
    var currentUrl = "";
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
    browser.pageAction.show(tab.id);
    activateOnPage(info["pageUrl"]);
  }
});

function reactToTabChange(tabId) {
  loadSettings().then(() => {
    if(currentSettings.showPageAction == "always") {
      browser.pageAction.show(tabId);
    } else {
      browser.pageAction.hide(tabId);
    }
  });
}
browser.tabs.onActivated.addListener((activeInfo) => {
  reactToTabChange(activeInfo.tabId);
});
browser.tabs.onUpdated.addListener(reactToTabChange);