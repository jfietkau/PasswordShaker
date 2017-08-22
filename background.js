
var masterPassword = null;

function activateOnPage(url) {
  console.log("PasswordShaker activated on: " + url);
  browser.tabs.executeScript({file: "/injector.js"}).then(
    browser.tabs.executeScript({code: "passwordshaker_fill('" + "abcdef" + "');"})
  );
}

browser.contextMenus.create({
  id: "password-shaker",
  title: "PasswordShaker",
  contexts: ["password"],
});
browser.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId === "password-shaker") {
    activateOnPage(info["pageUrl"]);
  }
});

