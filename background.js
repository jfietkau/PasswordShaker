
var masterPassword = null;

function activateOnPage(url) {
    console.log("PasswordShaker activated on: " + url);
    browser.runtime.sendMessage({
        "generated-password": "foobar"
    });
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

