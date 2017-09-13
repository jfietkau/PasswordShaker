var storedHash = null;
var lastVisualHashEvent = null;
var lastGeneratedPasswordEvent = null;

function removeElementById(elemId) {
  var elem = document.getElementById(elemId);
  elem.parentNode.removeChild(elem);
}

function setupPopupForm(settings) {
  if(settings.profiles.length == 1) {
    removeElementById("profileSelectContainer");
  } else {
    var profileSelect = document.getElementById("profileSelect");
    profileSelect.innerHTML = "";
    for(var i = 0; i < settings.profiles.length; i++) {
      var newOption = document.createElement("option");
      newOption.value = i;
      var profileName = settings.profiles[i].profileName;
      if(profileName.length == 0) {
        if(i == 0) {
          profileName = "(default profile)";
        } else {
          profileName = "(profile " + (i + 1) + ")";
        }
      }
      newOption.appendChild(document.createTextNode(profileName));
      profileSelect.appendChild(newOption);
    }
  }
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

function updatePopupForm(settings, toUpdate) {
  toUpdate = toUpdate || {visualHash: true, generatedPassword: true};
  var noProblems = true;
  if(document.getElementById("masterPassword").value.length == 0) {
    noProblems = false;
  }
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
      var verificationSuccess = false;
      if(storedHash.algorithm == "bcrypt") {
        verificationSuccess = dcodeIO.bcrypt.compareSync(entered, storedHash.hash);
      } else if(storedHash.algorithm == "sha3-512") {
        verificationSuccess = (sha3_512.update(entered).update(hex2arr(storedHash.salt)).hex() == storedHash.hash);
      }
      if(verificationSuccess) {
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
  if(toUpdate.visualHash) {
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
  }
  if(toUpdate.generatedPassword) {
    if(settings.showGeneratedPassword) {
      var generatedPasswordInput = document.getElementById("generatedPassword");
      var masterPassword = document.getElementById("masterPassword").value;
      var profileId = document.getElementById("profileSelect") ? document.getElementById("profileSelect").value : 0;
      if(generatedPasswordInput.value != "(click here to show)") {
        updateGeneratedPasswordInput(masterPassword, profileId);
      }
    }
  }
  document.getElementById("okButton").disabled = !noProblems;
}

function updateGeneratedPasswordInput(input, profileId) {
  var generatedPasswordInput = document.getElementById("generatedPassword");
  var currentSiteDisplay = document.getElementById("currentSite");
  if(input.length > 0) {
    generatedPasswordInput.style.fontStyle = "normal";
    generatedPasswordInput.value = ".....";
    lastGeneratedPasswordEvent = Math.random();
    var myEventId = lastGeneratedPasswordEvent;
    setTimeout(() => {
      if(myEventId == lastGeneratedPasswordEvent) {
        browser.runtime.sendMessage({
          generatePassword: true,
          masterPassword: input,
          profileId: profileId,
          id: myEventId,
        }).then((message) => {
          if(message.requestId == lastGeneratedPasswordEvent) {
            var displayPassword = message.generatedPassword;
            if(typeof displayPassword == "string") {
              generatedPasswordInput.value = displayPassword;
            } else {
              generatedPasswordInput.value = "[ failed to generate ]";
            }
          }
        });
      }
    }, currentSettings.showPasswordDelay);
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
        var passwordEntries = document.getElementsByClassName("passwordEntry");
        for(var i = 0; i < passwordEntries.length; i++) {
          passwordEntries[i].value = response;
        }
        updatePopupForm(currentSettings);
      }
    });
    browser.runtime.sendMessage(
      { getCurrentTopLevelHost: true }
    ).then((response) => {
      if(response != null) {
        var currentSiteDisplay = document.getElementById("currentSite");
        currentSiteDisplay.innerHTML = response;
        document.getElementById("originalCurrentSite").value = response;
        currentSiteDisplay.addEventListener("click", (e) => {
          var siteInput = document.createElement("input");
          siteInput.type = "text";
          siteInput.id = "currentSiteInput";
          siteInput.value = e.target.innerHTML;
          e.target.parentNode.insertBefore(siteInput, e.target);
          e.target.style.display = "none";
          siteInput.focus();
          siteInput.addEventListener("blur", (e) => {
            var newSiteInput = e.target.value;
            if(newSiteInput.length == 0) {
              newSiteInput = document.getElementById("originalCurrentSite").value;
            }
            currentSiteDisplay.innerHTML = newSiteInput;
            e.target.parentNode.removeChild(e.target);
            currentSiteDisplay.style.display = "inline";
          });
        });
      }
    });
    browser.runtime.sendMessage(
      { getSessionVariable: "currentProfile" }
    ).then((response) => {
      if(response != null) {
        if(document.getElementById("profileSelect")) {
          document.getElementById("profileSelect").value = response;
        }
        updatePopupForm(currentSettings, {generatedPassword: true});
      }
    });
    document.getElementById("confirmationIcons").style.height = document.getElementById("okButton").offsetHeight + "px";
    setupPopupForm(currentSettings);
    updatePopupForm(currentSettings);
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
        if(generatedPasswordInput.style.cursor != "auto") {
          generatedPasswordInput.style.cursor = "auto";
          updateGeneratedPasswordInput(document.getElementById("masterPassword").value,
                                       document.getElementById("profileSelect") ? document.getElementById("profileSelect").value : 0);
        }
      });
    }
    loadStoredHash((newStoredHash) => {
      storedHash = newStoredHash;
      if(storedHash != null && (storedHash.salt !== undefined && storedHash.salt.length < 64)) {
        storedHash = null;
      }
    });
    document.getElementById("masterPassword").focus();
  });
  document.getElementById("mainForm").addEventListener("submit", (e) => {
    e.preventDefault();
    var enteredMasterPassword = document.getElementById("masterPassword").value;
    var enteredProfileId = document.getElementById("profileSelect") ? document.getElementById("profileSelect").value : 0;
    browser.runtime.sendMessage({
      activateOnPage: true,
      masterPassword: enteredMasterPassword,
      profileId: enteredProfileId
    }).then(() => {
      if(currentSettings.storeMasterPasswordHash && storedHash === null) {
        var newSalt = dcodeIO.bcrypt.genSaltSync(10);
        var newHash = dcodeIO.bcrypt.hashSync(enteredMasterPassword, newSalt);
        saveStoredHash(newHash, null, "bcrypt").then(() => {
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
      var toUpdate = undefined;
      if(e.target.id == "masterPasswordConfirmation") {
        toUpdate = {};
      }
      updatePopupForm(currentSettings, toUpdate);
    });
  }
  document.getElementById("profileSelect").addEventListener("change", (e) => {
    updatePopupForm(currentSettings, {generatedPassword: true});
  });
});
