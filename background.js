
function activateOnField(info) {
    console.log("PasswordShaker activated on: " + info);
}

browser.contextMenus.create({
    id: "password-shaker",
    title: "PasswordShaker",
    contexts: ["all"],
});
browser.contextMenus.onClicked.addListener((info, tab) => {
    if (info.menuItemId === "password-shaker") {
        activateOnField(info['pageUrl']);
    }
});

