var storedHash = null;
var lastVisualHashEvent = null;
var lastGeneratedPasswordEvent = null;

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
  if(!settings.showVisualHash) {
    removeElementById("visualHashContainer");    
  }
  if(!settings.showGeneratedPassword) {
    removeElementById("generatedPasswordContainer");    
  }
}

function updatePopupForm(settings, onlyVerificationChanged) {
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
  if(!onlyVerificationChanged) {
    if(settings.showVisualHash) {
      var hashCanvas = document.getElementById("visualHash");
      var hashLoading = document.getElementById("visualHashLoading");
      var input = document.getElementById("masterPassword").value;
      if(input.length >= Math.max(1, settings.visualHashMinInputLength)) {
        var hash = sha3_512.update(input).update("PasswordShaker").hex();
        lastVisualHashEvent = Math.random();
        var myEventId = lastVisualHashEvent;
        hashCanvas.style.display = "none";
        hashLoading.style.display = "block";
        setTimeout(() => {
          if(myEventId == lastVisualHashEvent) {
            hashCanvas.style.display = "block";
            hashLoading.style.display = "none";
            hashCanvas.style.borderColor = "#000";
            mosaicVisualHash(hash, hashCanvas);
          }
        }, settings.visualHashDelay);
      } else {
        lastVisualHashEvent = null;
        hashCanvas.style.display = "block";
        hashLoading.style.display = "none";
        hashCanvas.style.borderColor = "#ddd";
        var size = hashCanvas.getAttribute("width");
        hashCanvas.getContext("2d").clearRect(0, 0, size, size);
      }
    }
    if(settings.showGeneratedPassword) {
      var generatedPasswordInput = document.getElementById("generatedPassword");
      var input = document.getElementById("masterPassword").value;
      if(generatedPasswordInput.value != "(click here to show)") {
        updateGeneratedPasswordInput(input);
      }
    }
  }
  document.getElementById("okButton").disabled = !noProblems;
}

function updateGeneratedPasswordInput(input) {
  var generatedPasswordInput = document.getElementById("generatedPassword");
  var currentSiteDisplay = document.getElementById("currentSite");
  if(input.length > 0) {
    generatedPasswordInput.style.fontStyle = "normal";
    generatedPasswordInput.value = ".....";
    lastGeneratedPasswordEvent = Math.random();
    var myEventId = lastGeneratedPasswordEvent;
    setTimeout(() => {
      if(myEventId == lastGeneratedPasswordEvent) {
        generatedPasswordInput.value = "DUMMY PASSWORD";
      }
    }, 500);
  } else {
    lastGeneratedPasswordEvent = null;
    generatedPasswordInput.style.fontStyle = "italic";
    generatedPasswordInput.value = "requires master password";
  }
}

document.addEventListener("DOMContentLoaded", () => {
  loadSettings().then(() => {
    browser.runtime.sendMessage(
      { getSessionVariable: "masterPassword" }
    ).then((response) => {
      if(response != null) {
        window.close();
      }
    });
    document.getElementById("confirmationIcons").style.height = document.getElementById("okButton").offsetHeight + "px";
    setupPopupForm(currentSettings);
    updatePopupForm(currentSettings, false);
    if(currentSettings.showVisualHash) {
      var container = document.getElementById("visualHashContainer");
      var targetSize = document.getElementById("mainForm").offsetHeight;
      container.style.width = (targetSize + 10) + "px";
      container.style.height = targetSize + "px";
      var hashCanvas = document.getElementById("visualHash");
      hashCanvas.setAttribute("width", 2 * (targetSize - 2));
      hashCanvas.setAttribute("height", 2 * (targetSize - 2));
    }
    if(currentSettings.showGeneratedPassword) {
      var generatedPasswordInput = document.getElementById("generatedPassword");
      generatedPasswordInput.addEventListener("click", () => {
        generatedPasswordInput.style.cursor = "auto";
        updateGeneratedPasswordInput(document.getElementById("masterPassword").value);
      });
    }
    loadStoredHash((newStoredHash) => {
      storedHash = newStoredHash;
      if(storedHash != null && storedHash.salt.length < 64) {
        storedHash = null;
      }
    });
    document.getElementById("masterPassword").focus();
  });
  document.getElementById("mainForm").addEventListener("submit", (e) => {
    e.preventDefault();
    var enteredMasterPassword = document.getElementById("masterPassword").value;
    browser.runtime.sendMessage(
      {masterPassword: enteredMasterPassword}
    ).then(() => {
      if(currentSettings.storeMasterPasswordHash && storedHash === null) {
        var newSalt = getRandomBytes(32);
        var newHash = sha3_512.update(enteredMasterPassword).update(newSalt).hex();
        saveStoredHash(newHash, arr2hex(newSalt), "sha3-512").then(() => {
          window.close();
        });
      } else {
        window.close();
      }
    });
  });
  var passwordEntries = document.getElementsByClassName("passwordEntry");
  for(var i = 0; i < passwordEntries.length; i++) {
    passwordEntries[i].addEventListener("keyup", (e) => {
      updatePopupForm(currentSettings, (e.target.id == "masterPasswordConfirmation"));
    });
  }
});
