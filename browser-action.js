var storedHash = null;

function removeElementById(elemId) {
  var elem = document.getElementById(elemId);
  elem.parentNode.removeChild(elem);
}

function setupPopupForm(settings) {
  if(!settings.verifyMasterPassword) {
    removeElementById("masterPasswordConfirmation");
    removeElementById("equalsIcon");
  }
  if(settings.showMasterPassword) {
    var passwordFields = document.getElementsByClassName("passwordEntry");
    for(var i = 0; i < passwordFields.length; i++) {
      passwordFields[i].type = "text";
    }
  }
  if(!settings.storeMasterPasswordHash) {
    removeElementById("matchStoredIcon");    
  }
}

function updatePopupForm(settings) {
  var noProblems = true;
  if(settings.verifyMasterPassword) {
    var entered = document.getElementById("masterPassword").value;
    var enteredConf = document.getElementById("masterPasswordConfirmation").value;
    var equalsIcon = document.getElementById("equalsIcon");
    if(enteredConf.length == 0) {
      equalsIcon.src = "/icons/equals-gray.svg";
      equalsIcon.alt = "Master password confirmation not entered yet";
      noProblems = false;
    } else if(entered != enteredConf) {
      equalsIcon.src = "/icons/equals-red.svg";
      equalsIcon.alt = "Master passwords do not match!";
      noProblems = false;
    } else {
      equalsIcon.src = "/icons/equals-green.svg";
      equalsIcon.alt = "Master passwords match";
    }
    equalsIcon.title = equalsIcon.alt;
  }
  if(settings.storeMasterPasswordHash) {
    var entered = document.getElementById("masterPassword").value;
    var matchStoredIcon = document.getElementById("matchStoredIcon");
    if(entered.length == 0) {
      matchStoredIcon.src = "/icons/stored-gray.svg";
      matchStoredIcon.alt = "Master password not entered yet";
      noProblems = false;
    } else if(storedHash === null) {
      matchStoredIcon.src = "/icons/stored-yellow.svg";
      matchStoredIcon.alt = "A hash for the current master password will be saved when you click OK";
    } else {
      hashFunc = (masterPassword, salt) => { return null; }
      if(storedHash.algorithm == "sha3-512") {
        hashFunc = sha3_512;
      }
      if(hashFunc.update(entered).update(hex2arr(storedHash.salt)).hex() == storedHash.hash) {
        matchStoredIcon.src = "/icons/stored-green.svg";
        matchStoredIcon.alt = "Master password matches the stored hash";
      } else {
        matchStoredIcon.src = "/icons/stored-red.svg";
        matchStoredIcon.alt = "Master password does not match the stored hash!";
        noProblems = false;
      }
    }
    matchStoredIcon.title = matchStoredIcon.alt;
  }
  document.getElementById("okButton").disabled = !noProblems;
}

document.addEventListener("DOMContentLoaded", () => {
  loadSettings().then(() => {
    setupPopupForm(currentSettings);
    updatePopupForm(currentSettings);
    loadStoredHash((newStoredHash) => {
      storedHash = newStoredHash;
    });
  });
  document.getElementById("mainForm").addEventListener("submit", (e) => {
    e.preventDefault();
    if(storedHash === null) {
      var newSalt = getRandomBytes(32);
      var newHash = sha3_512.update(document.getElementById("masterPassword").value).update(newSalt).hex();
      saveStoredHash(newHash, arr2hex(newSalt), "sha3-512");
    }
    window.close();
  });
  var passwordEntries = document.getElementsByClassName("passwordEntry");
  for(var i = 0; i < passwordEntries.length; i++) {
    passwordEntries[i].addEventListener("keyup", () => {
      updatePopupForm(currentSettings);
    });
  }
});