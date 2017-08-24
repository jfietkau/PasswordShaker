function setupPopupForm(settings) {
  //alert(settings.verifyMasterPassword);
  if(!settings.verifyMasterPassword) {
    var confirmationElem = document.getElementById("masterPasswordConfirmation");
    confirmationElem.value = "abc";
    confirmationElem.parentNode.removeChild(confirmationElem);
  }
  if(settings.showMasterPassword) {
    var passwordFields = document.getElementsByClassName("passwordEntry");
    for(var i = 0; i < passwordFields.length; i++) {
      passwordFields[i].type = "text";
    }
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