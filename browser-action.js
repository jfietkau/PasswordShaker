var storedHash = null;
var lastVisualHashEvent = null;
var lastGeneratedPasswordEvent = null;
var clickEventInProgress = false;
var currentPasswordReq = null;

function removeElementById(elemId) {
  var elem = document.getElementById(elemId);
  elem.parentNode.removeChild(elem);
}
/**
 * PasswordShaker
 * https://github.com/jfietkau/PasswordShaker/
 *
 * Copyright (c) 2017 Julian Fietkau
 *
 *************************************************************************
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program.  If not, see <http://www.gnu.org/licenses/>.
 *
 *************************************************************************
 */

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
    removeElementById("generatedPasswordForm");    
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
      var profileId = getSelectedProfile();
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
        var hostnameOverride = undefined;
        if(document.getElementById("currentSiteCustom").value.length > 0) {
          hostnameOverride = document.getElementById("currentSiteCustom").value;
        } else if(document.getElementById("currentSiteOriginal").value.length > 0) {
          hostnameOverride = document.getElementById("currentSiteOriginal").value;
        }
        browser.runtime.sendMessage({
          generatePassword: true,
          masterPassword: input,
          profileId: profileId,
          hostnameOverride: hostnameOverride,
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

function updateCurrentSite(siteText) {
  document.getElementById("currentSiteArea").classList.remove("verified");
  var siteTextOriginal = document.getElementById("currentSiteOriginal").value;
  if(siteText.length == 0) {
    siteText = siteTextOriginal;
  }
  if(siteText == siteTextOriginal) {
    document.getElementById("currentSiteCustom").value = "";
    var siteTextFancy = siteText;
    if(currentPasswordReq != null) {
      siteTextFancy = currentPasswordReq.name;
    }
    document.getElementById("currentSite").innerHTML = siteTextFancy;
    if(siteTextFancy != siteText) {
      document.getElementById("currentSiteArea").classList.add("verified");
    }
  } else {
    document.getElementById("currentSiteCustom").value = siteText;
    document.getElementById("currentSite").innerHTML = siteText;
  }
}

function getSelectedProfile() {
  return document.getElementById("profileSelect") ? parseInt(document.getElementById("profileSelect").value, 10) : 0;
}

function reactToCurrentSiteClick(evt) {
  if(clickEventInProgress) {
    return;
  }
  clickEventInProgress = true;
  document.getElementById("currentSiteArea").removeEventListener("click", reactToCurrentSiteClick);
  setTimeout(() => {
    clickEventInProgress = false;
  }, 500);
  var currentSiteDisplay = document.getElementById("currentSite");
  var currentSiteArea = document.getElementById("currentSiteArea");
  var siteInput = document.createElement("input");
  siteInput.type = "text";
  siteInput.id = "currentSiteInput";
  if(currentSiteArea.classList.contains("verified")) {
    siteInput.value = document.getElementById("currentSiteOriginal").value;
  } else {
    siteInput.value = currentSiteDisplay.innerHTML;
  }
  currentSiteArea.classList.remove("verified");
  currentSiteArea.insertBefore(siteInput, document.getElementById("currentSite"));
  currentSiteDisplay.style.display = "none";
  siteInput.focus();
  siteInput.addEventListener("blur", (e) => {
    updateCurrentSite(e.target.value);
    e.target.parentNode.removeChild(e.target);
    currentSiteDisplay.style.display = "inline-block";
    document.getElementById("currentSiteArea").addEventListener("click", reactToCurrentSiteClick);
    updatePopupForm(currentSettings, {generatedPassword: true});
  });
}

function initializeCurrentSiteDisplay(settings) {
  browser.runtime.sendMessage({
    getCurrentUrlDetails: true
  }).then((response) => {
    if(response != null) {
      var currentSiteDisplay = document.getElementById("currentSite");
      if(settings.profiles[getSelectedProfile()].profileEngine == "profileEngineDefault"
         && settings.profiles[getSelectedProfile()].psUseSiteSpecificRequirements) {
        document.getElementById("currentSiteIntro").innerHTML = "Password for:";
        currentSiteDisplay.style.display = "inline";
        var canonicalHostname = response.publicSuffix;
        if(response.passwordReq != null) {
          canonicalHostname = response.passwordReq.hostnames[0];
        }
        currentPasswordReq = response.passwordReq;
        document.getElementById("currentSiteOriginal").value = canonicalHostname;
        updateCurrentSite(canonicalHostname);
        document.getElementById("currentSiteArea").addEventListener("click", reactToCurrentSiteClick);
      } else {
        currentSiteArea.classList.remove("verified");
        document.getElementById("currentSiteOriginal").value = "";
        document.getElementById("currentSiteCustom").value = "";
        document.getElementById("currentSiteArea").removeEventListener("click", reactToCurrentSiteClick);
        currentSiteDisplay.innerHTML = response.publicSuffix;
        if(settings.profiles[getSelectedProfile()].profileEngine == "profileEngineDefault") {
          currentSiteDisplay.style.display = "inline";
          document.getElementById("currentSiteIntro").innerHTML = "Password for:";
        } else {
          currentSiteDisplay.style.display = "none";
          document.getElementById("currentSiteIntro").innerHTML = "Password for this site:";
        }
      }
    }
  });
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
    initializeCurrentSiteDisplay(currentSettings);
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
      var targetSize = document.getElementById("forms").offsetHeight;
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
          updateGeneratedPasswordInput(document.getElementById("masterPassword").value, getSelectedProfile());
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
  document.getElementById("generatedPasswordForm").addEventListener("submit", (e) => {
    e.preventDefault();
    if(document.getElementById("currentSiteInput")) {
      document.getElementById("currentSiteInput").blur();
    }
  });
  document.getElementById("mainForm").addEventListener("submit", (e) => {
    e.preventDefault();
    var enteredMasterPassword = document.getElementById("masterPassword").value;
    var enteredProfileId = getSelectedProfile();
    var hostnameOverride = undefined;
    if(document.getElementById("currentSiteCustom").value.length > 0) {
      hostnameOverride = document.getElementById("currentSiteCustom").value;
    } else if(document.getElementById("currentSiteOriginal").value.length > 0) {
      hostnameOverride = document.getElementById("currentSiteOriginal").value;
    }
    browser.runtime.sendMessage({
      activateOnPage: true,
      masterPassword: enteredMasterPassword,
      profileId: enteredProfileId,
      hostnameOverride: hostnameOverride,
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
    initializeCurrentSiteDisplay(currentSettings);
    updatePopupForm(currentSettings, {generatedPassword: true});
  });
});
