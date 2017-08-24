function setupPopupForm(settings) {
  //alert(settings.verifyMasterPassword);
  if(!settings.verifyMasterPassword) {
    var confirmationElem = document.getElementById("masterPasswordConfirmation");
    confirmationElem.value = "abc";
    confirmationElem.parentNode.removeChild(confirmationElem);
  }
}

function updatePopupForm(settings) {
}

document.addEventListener("DOMContentLoaded", () => {
  loadSettings().then(() => {
    setupPopupForm(currentSettings);
    updatePopupForm(currentSettings);
  });
});