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

// This script gets loaded into the page action popup and handles all the UI stuff there.

// storedHash starts out as undefined (semantics: stored hash has not finished being loaded).
// If it is null, that means that loading the stored hash _has_ finished, but it was empty.
var storedHash = undefined;

// Only show the last/latest visual hash
var lastVisualHashEvent = null;

// Same for the generated password
var lastGeneratedPasswordEvent = null;

// Ran into a problem where an element was supposed to disappear upon a click, but it was
// possible to click twice to outrace the event handled. This is just to make sure that if
// there was already a click event, subsequent ones are ignored.
var clickEventInProgress = false;

// If the current site has known password requirements, use the metadata (site name, mostly)
// for slightly fancier display.
var currentPasswordReq = null;

// We keep track of the current URL so we can update the popup if the active tab's URL
// changes while the popup is open (e.g. through a timed redirect).
var currentUrlDetails = null;

// helper function
function removeElementById(elemId) {
  var elem = document.getElementById(elemId);
  elem.parentNode.removeChild(elem);
}

// Set up the form elements etc. according to the given settings.
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

// Update the popup form with changed settings. The second parameter can be a list
// of parts of the form that need to be updated. This makes it possible to avoid
// recalculating the visual hash or the generated password if no pertinent data
// has changed.
function updatePopupForm(settings, toUpdate) {
  toUpdate = toUpdate || {visualHash: true, generatedPassword: true};
  // only allow OK button to be clicked if everything checks out
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
    if(entered.length == 0 || storedHash === undefined) {
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
        setTimeout(() => {
          // Would like to do this immediately, but there's a visual text
          // rendering bug that manifests (on Windows only) that I *think*
          // is triggered by the animated SVG being rendered while the
          // popup is still opening. This seems to be a reliable workaround.
          hashCanvas.style.display = "none";
          hashLoading.style.display = "block";
        }, 100);
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

// If the user configures it, the popup can display the generated password. This
// function retrieves it from the background script.
function updateGeneratedPasswordInput(input, profileId) {
  var generatedPasswordInput = document.getElementById("generatedPassword");
  if(input.length > 0) {
    generatedPasswordInput.style.fontStyle = "normal";
    generatedPasswordInput.value = ".....";
    lastGeneratedPasswordEvent = Math.random();
    var myEventId = lastGeneratedPasswordEvent;
    setTimeout(() => {
      console.log("foo");
      console.log(myEventId);
      console.log(lastGeneratedPasswordEvent);
      if(myEventId == lastGeneratedPasswordEvent) {
        console.log("bar");
        var inputTextOverride = undefined;
        if(document.getElementById("currentSiteCustom").value.length > 0) {
          inputTextOverride = document.getElementById("currentSiteCustom").value;
        } else if(document.getElementById("currentSiteOriginal").value.length > 0) {
          inputTextOverride = document.getElementById("currentSiteOriginal").value;
        }
        console.log("bar2");
        browser.runtime.sendMessage({
          generatePassword: true,
          masterPassword: input,
          profileId: profileId,
          inputTextOverride: inputTextOverride,
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

function fitTextInto(text, element, width) {
  element.innerHTML = "";
  var shorteningCondition = false;
  if(width == "auto") {
    var boundRect = element.getBoundingClientRect();
    var bestPosition = { x: boundRect.x, y: boundRect.y };
    element.appendChild(document.createTextNode(text));
    boundRect = element.getBoundingClientRect();
    shorteningCondition = (boundRect.x != bestPosition.x || boundRect.y != bestPosition.y);
  } else {
    element.appendChild(document.createTextNode(text));
    var currentWidth = element.getBoundingClientRect().width;
    shorteningCondition = (currentWidth >= width);
  }
  while(shorteningCondition && text.length > 0) {
    element.innerHTML = "";
    text = text.slice(0, -1);
    element.appendChild(document.createTextNode(text + "…"));
    currentWidth = element.getBoundingClientRect().width;
    if(width == "auto") {
      boundRect = element.getBoundingClientRect();
      shorteningCondition = (boundRect.x != bestPosition.x || boundRect.y != bestPosition.y);
    } else {
      shorteningCondition = (currentWidth >= width);
    }
  }
}

// Given a specific input text, update the display of the current site.
function updateCurrentSite(siteText) {
  // This is a tiny bit unwieldy, but we have the hostname for verified websites
  // stored in a hidden input field while we put the fancy text into the displayed span.
  document.getElementById("currentSiteArea").classList.remove("verified");
  var siteTextOriginal = document.getElementById("currentSiteOriginal").value;
  if(siteText.length == 0) {
    siteText = siteTextOriginal;
  }
  var currentSiteElem = document.getElementById("currentSite");
  currentSiteElem.innerHTML = "";
  if(siteText == siteTextOriginal) {
    // given site text is the original one
    document.getElementById("currentSiteCustom").value = "";
    var siteTextFancy = siteText;
    if(currentPasswordReq != null) {
      siteTextFancy = currentPasswordReq.name;
    }
    fitTextInto(siteTextFancy, currentSiteElem, "auto");
    if(siteTextFancy != siteText) {
      document.getElementById("currentSiteArea").classList.add("verified");
    }
  } else {
    // given site text has been changed frm the original
    document.getElementById("currentSiteCustom").value = siteText;
    fitTextInto(siteText, currentSiteElem, "auto");
  }
}

// helper function
function getSelectedProfile() {
  return document.getElementById("profileSelect") ? parseInt(document.getElementById("profileSelect").value, 10) : 0;
}

// This is what happens when the user clicks on the current site name. It replaces the span with a text input
// and makes sure it works smoothly.
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
  if(document.getElementById("currentSiteCustom").value.length > 0) {
    siteInput.value = document.getElementById("currentSiteCustom").value;
  } else if(document.getElementById("currentSiteOriginal").value.length > 0) {
    siteInput.value = document.getElementById("currentSiteOriginal").value;
  } else {
    siteInput.value = currentSiteDisplay.innerHTML;
  }
  currentSiteArea.classList.remove("verified");
  currentSiteArea.insertBefore(siteInput, document.getElementById("currentSite"));
  currentSiteDisplay.style.display = "none";
  siteInput.focus();
  siteInput.addEventListener("blur", (e) => {
    e.target.parentNode.removeChild(e.target);
    currentSiteDisplay.style.display = "inline";
    updateCurrentSite(e.target.value);
    document.getElementById("currentSiteArea").addEventListener("click", reactToCurrentSiteClick);
    updatePopupForm(currentSettings, {generatedPassword: true});
  });
}

// Set up the portion of the popup that displays the current site, depending on the settings.
function initializeCurrentSiteDisplay(settings, forceRefresh = false) {
  currentPasswordReq = null;
  browser.runtime.sendMessage({
    getCurrentUrlDetails: true
  }).then((response) => {
    if(response != null &&
        (forceRefresh || currentUrlDetails === null || currentUrlDetails.url !== response.url ||
        currentUrlDetails.hostname !== response.hostname || currentUrlDetails.publicSuffix !== response.publicSuffix)
       ) {
      currentUrlDetails = response;
      var currentSiteDisplay = document.getElementById("currentSite");
      if(settings.profiles[getSelectedProfile()].profileEngine == "profileEngineDefault") {
        document.getElementById("currentSiteArea").addEventListener("click", reactToCurrentSiteClick);
        if(settings.profiles[getSelectedProfile()].psUseSiteSpecificRequirements) {
          // Only if we use the site-specific things at all can there be verified websites.
          var canonicalHostname = response.publicSuffix;
          if(response.passwordReq != null) {
            canonicalHostname = response.passwordReq.hostnames[0];
          }
          currentPasswordReq = response.passwordReq;
          document.getElementById("currentSiteOriginal").value = canonicalHostname;
          updateCurrentSite(canonicalHostname);
        } else {
          currentSiteArea.classList.remove("verified");
          document.getElementById("currentSiteOriginal").value = "";
          document.getElementById("currentSiteCustom").value = "";
          currentSiteDisplay.innerHTML = "";
          currentSiteDisplay.appendChild(document.createTextNode(response.publicSuffix));
        }
      } else { // using the PasswordMaker engine
        currentSiteArea.classList.remove("verified");
        document.getElementById("currentSiteOriginal").value = "";
        document.getElementById("currentSiteCustom").value = "";
        currentSiteDisplay.innerHTML = "";
        // It's a bit inelegant that we fire a generate password request just to find out
        // what the engine will use as the input text, but the PasswordMaker algorithms
        // are all so near-instant that the wasted calculation shouldn't matter.
        browser.runtime.sendMessage({
          generatePassword: true,
          masterPassword: "dummy request",
          profileId: getSelectedProfile(),
          inputTextOverride: null,
          id: null,
        }).then((response) => {
          document.getElementById("currentSiteOriginal").value = response.inputText;
          updateCurrentSite(response.inputText);
        });
      }
      // update generated password because of the new URL
      updatePopupForm(currentSettings, {generatedPassword: true});
    }
  });
}

// Install event listeners and do things etc.
document.addEventListener("DOMContentLoaded", () => {
  loadSettings().then(() => {
    // If a master password is already cached this session, put it into the field(s)
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
    // If there are multiple profiles and one has already been selected this session, stick with it
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
    // See if there is a stored master password hash for us to use
    browser.runtime.sendMessage({ loadStoredHash: true }).then((response) => {
      storedHash = response;
      if(storedHash != null && (storedHash.salt !== undefined && storedHash.salt.length < 64)) {
        storedHash = null;
      }
      updatePopupForm(currentSettings, {});
    });

    initializeCurrentSiteDisplay(currentSettings, true);
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
    // This is where the user is going to want to type (or press enter to submit)
    document.getElementById("masterPassword").focus();
  });
  document.getElementById("masterPassword").addEventListener("blur", (e) => {
    browser.runtime.sendMessage({
      cacheMasterPassword: true,
      masterPassword: e.target.value,
    });
  });
  document.getElementById("generatedPasswordForm").addEventListener("submit", (e) => {
    // The generated password form actually doesn't have a submit button, but if the
    // user presses enter while the current site input is focused, we want to trigger
    // the blur event to finalize the changes
    e.preventDefault();
    if(document.getElementById("currentSiteInput")) {
      document.getElementById("currentSiteInput").blur();
    }
  });
  document.getElementById("mainForm").addEventListener("submit", (e) => {
    e.preventDefault();
    var enteredMasterPassword = document.getElementById("masterPassword").value;
    var enteredProfileId = getSelectedProfile();
    var inputTextOverride = undefined;
    if(document.getElementById("currentSiteCustom").value.length > 0) {
      inputTextOverride = document.getElementById("currentSiteCustom").value;
    } else if(document.getElementById("currentSiteOriginal").value.length > 0) {
      inputTextOverride = document.getElementById("currentSiteOriginal").value;
    }
    browser.runtime.sendMessage({
      activateOnPage: true,
      masterPassword: enteredMasterPassword,
      profileId: enteredProfileId,
      inputTextOverride: inputTextOverride,
    }).then(() => {
      if(currentSettings.storeMasterPasswordHash && storedHash === null) {
        // Initially we used to do this as a plain SHA3 hash, but since we have
        // more suitable algorithms right there, why not use one.
        var newSalt = dcodeIO.bcrypt.genSaltSync(10);
        var newHash = dcodeIO.bcrypt.hashSync(enteredMasterPassword, newSalt);
        browser.runtime.sendMessage({
          saveStoredHash: true,
          hash: newHash,
          salt: null,
          algorithm: "bcrypt",
        }).then(() => {
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
    initializeCurrentSiteDisplay(currentSettings, true);
    updatePopupForm(currentSettings, {generatedPassword: true});
  });
  setInterval(() => {
    initializeCurrentSiteDisplay(currentSettings);
  }, 350);
});
