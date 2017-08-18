
function activateOnField(info) {
    console.log("test");
    console.log(info);
}

browser.browserAction.onClicked.addListener(activateOnField);

browser.contextMenus.create({
    id: "password-shaker",
    title: "PasswordShaker",
    contexts: ["password"],
});
browser.contextMenus.onClicked.addListener((info, tab) => {
    if (info.menuItemId === "password-shaker") {
        activateOnField(info);
    }
});

