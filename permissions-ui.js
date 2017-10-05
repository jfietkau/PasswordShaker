
var thePermission = { origins: ["<all_urls>"] };

function updatePage() {
  browser.permissions.contains(thePermission).then((result) => {
    var button = document.getElementById("request");
    var status = document.getElementById("status");
    if(result) {
      status.classList.remove("notgranted");
      status.classList.add("granted");
      status.innerHTML = "<span>current status: granted</span>";
      button.value = "Revoke permission";
    } else {
      status.classList.remove("granted");
      status.classList.add("notgranted");
      status.innerHTML = "<span>current status: not granted</span>";
      button.value = "Grant permission";
    }
  });
}

document.addEventListener("DOMContentLoaded", () => {

  updatePage();
  setInterval(updatePage, 500);

  document.getElementById("request").addEventListener("click", (e) => {
    if(document.getElementById("status").classList.contains("granted")) {
      browser.permissions.remove(thePermission).then((result) => {
        updatePage();
      });
    } else {
      browser.permissions.request(thePermission).then((result) => {
        updatePage();
      });
    }
  });

});
