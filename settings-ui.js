/**
 * PasswordShaker
 * https://github.com/jfietkau/PasswordShaker/
 *
 * Copyright (c) 2017-2019 Julian Fietkau
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

// This script contains all the UI stuff, including the populating and parsing of the forms,
// for the settings page. It's mostly pretty boring.

// We use this as a sort-of semaphore to detect whether a change to an input element's value
// is because of the user, or because we changed it ourselves. Basically, increment this variable
// before any automated form change, decrement it afterwards. If a change event is fired while it
// is 0, it must be caused by the user.
var ignoreFormEvents = 0;

// Because we refer to it in a few places, here's where our optional permission is encoded.
var theOptionalPermission = { origins: ["<all_urls>"] };

// helper functions
function removeElementById(elemId) {
  var elem = document.getElementById(elemId);
  elem.parentNode.removeChild(elem);
}

// Take a complete settings structure and populate the form accordingly
function populateSettingsForm(settings) {
  ignoreFormEvents += 1;
  for(var property in settings) {
    if(property == "profiles") {
      var checkedTabValue = 0;
      var oldIndex = 0;
      while(document.getElementById("profileTab" + oldIndex) != undefined) {
        if(document.getElementById("profileTab" + oldIndex).checked) {
          checkedTabValue = oldIndex;
        }
        removeElementById("profileTab" + oldIndex);
        removeElementById("profileTabLabel" + oldIndex);
        oldIndex++;
      }
      checkedTabValue = Math.min(checkedTabValue, settings.profiles.length - 1);
      for(var i = 0; i < settings.profiles.length; i++) {
        if(!document.getElementById("profileTab" + i)) {
          var plusTab = document.getElementById("profileTabX"); 
          var newRadio = document.createElement("input");
          newRadio.type = "radio";
          newRadio.name = "profileTabs";
          newRadio.id = "profileTab" + i;
          newRadio.value = i;
          newRadio.addEventListener("click", (e) => {
            ignoreFormEvents += 1;
            populateProfileArea(currentSettings, parseInt(e.target.value, 10));
            updateForm();
            updateSecurityAlerts();
            updateExamplePassword();
            ignoreFormEvents -= 1;
          });
          document.getElementById("profiles").insertBefore(newRadio, plusTab);
          var newLabel = document.createElement("label");
          newLabel.id = "profileTabLabel" + i;
          newLabel.htmlFor = "profileTab" + i;
          var tabTitle = settings.profiles[i].profileName;
          if(tabTitle.length == 0) {
            if(i == 0) {
              tabTitle = "(default profile)";
            } else {
              tabTitle = "(profile " + (i + 1) + ")";
            }
          }
          var labelContent = document.createTextNode(tabTitle);
          newLabel.appendChild(labelContent);
          document.getElementById("profiles").insertBefore(newLabel, plusTab);
        }
      }
      // Don't forget to delete profile tabs that aren't in use anymore
      var superfluousTabIndex = settings.profiles.length;
      while(document.getElementById("profileTab" + superfluousTabIndex)) {
        removeElementbyId("profileTab" + superfluousTabIndex);
        superfluousTabIndex++;
      }
      var profileIndex = getProfileIndex(settings);
      if(profileIndex === null) {
        document.getElementById("profileTab" + checkedTabValue).checked = true;
        populateProfileArea(settings, checkedTabValue);
      }
    } else if(settings.hasOwnProperty(property)) {
      populateSettingsElement(property, settings[property]);
    }
  }
  ignoreFormEvents -= 1;
}

// Add a new profile (filled with default settings) to the given overall settings.
function addNewProfile(settings) {
  var newIndex = settings.profiles.length;
  settings.profiles.push({});
  extendObjectWith(settings.profiles[newIndex], getDefaultProfileSettings());
  populateSettingsForm(settings);
}

// Populate the profile area of the form with the settings from the given profile
function populateProfileArea(settings, profileIndex) {
  ignoreFormEvents += 1;
  for(var property in settings.profiles[profileIndex]) {
    if(settings.profiles[profileIndex].hasOwnProperty(property)) {
      populateSettingsElement(property, settings.profiles[profileIndex][property]);
    }
  }
  var currentAlgoName = document.getElementById("psHashAlgorithm").value;
  var newAlgoCoefficientName = getCoefficientNameByAlgorithm(currentAlgoName);
  if(currentAlgoName.startsWith("pbkdf2-")) {
    document.getElementById("psAlgorithmCoefficient").step = 25000;
    document.getElementById("psAlgorithmCoefficient").min = 25000;
  } else {
    document.getElementById("psAlgorithmCoefficient").step = 1;
    document.getElementById("psAlgorithmCoefficient").min = (currentAlgoName == "bcrypt") ? 4 : 1;
  }
  document.getElementById("psAlgorithmCoefficientName").innerHTML = "";
  document.getElementById("psAlgorithmCoefficientName").appendChild(document.createTextNode(newAlgoCoefficientName + ":"));
  document.getElementById("deleteProfileWarning").style.display = "none";
  document.getElementById("deleteProfile").style.display = "inline";
  ignoreFormEvents -= 1;
}

// Populate an individual form element
function populateSettingsElement(elem, value) {
  if(document.getElementById(elem)) {
    var domElem = document.getElementById(elem);
    if(domElem.tagName.toLowerCase() == "input") {
      if(domElem.type == "checkbox") {
        domElem.checked = Boolean(value);
      } else if(domElem.type == "text") {
        domElem.value = value;
      } else if(domElem.type == "number") {
        domElem.value = value;
      }
    } else if(domElem.tagName.toLowerCase() == "select") {
      domElem.value = value;
      if(domElem.id == "psHashAlgorithm") {
        var separatorIndex = undefined;
        var usingAdditionalAlgorithm = false;
        var options = domElem.getElementsByTagName("option");
        for(var i = 0; i < options.length; i++) {
          options[i].style.display = "";
          if(options[i].id == "psHashAlgorithmAdditionalDivider") {
            separatorIndex = i;
            usingAdditionalAlgorithm = (domElem.selectedIndex > separatorIndex);
          }
          if(separatorIndex !== undefined) {
            if(!usingAdditionalAlgorithm || (options[i].id != "psHashAlgorithmAdditionalDivider" && options[i].value != value)) {
              // Apparently hiding <option> elements doesn't work cross-browser, but it works in Firefox
              options[i].style.display = "none";
            }
          }
        }
      }
    }
  } else if(document.getElementsByName(elem).length > 0) {
    var radios = document.getElementsByName(elem);
    for(var i = 0; i < radios.length; i++) {
      if(radios[i].value == value) {
        radios[i].checked = true;
        break;
      }
    }
  }
}

// Find out which profile is currently displayed in the settings page
function getProfileIndex(settings) {
  var profileIndex = null;
  for(var i = 0; i < settings.profiles.length; i++) {
    if(document.getElementById("profileTab" + i).checked) {
      profileIndex = i;
      break;
    }
  }
  return profileIndex;
}

// Parse the current form contents and act on them accordingly
function parseForm(settings) {
  for(var property in settings) {
    if(property != "profiles" && settings.hasOwnProperty(property)) {
      parseSettingsElement(property, settings);
    }
  }
  // If a master password hash is no longer desired to be stored, delete any that we may have.
  if(!document.getElementById("storeMasterPasswordHash").checked) {
    browser.runtime.sendMessage({ clearStoredHash: true });
  }
  // Same for the stored master password.
  if(document.getElementById("storeMasterPassword").value != "permanent") {
    browser.runtime.sendMessage({ clearStoredMasterPassword: true });
    // One step further: If the user opts not to cache the master password at all,
    // delete it if it has already been cached this session.
    if(document.getElementById("storeMasterPassword").value == "never") {
      browser.runtime.sendMessage({ clearSessionVariable: "masterPassword" });
    }
  }
  var profileIndex = getProfileIndex(settings);
  for(var property in settings.profiles[profileIndex]) {
    if(settings.profiles[profileIndex].hasOwnProperty(property)) {
      // Only one profile may have the "use hotkey for this" setting checked.
      if(property == "useForHotkey" && document.getElementById(property).checked) {
        for(var i = 0; i < settings.profiles.length; i++) {
          settings.profiles[i].useForHotkey = false;
        }
      }
      parseSettingsElement(property, settings.profiles[profileIndex]);
    }
  }
}

// Parse a single form element
function parseSettingsElement(elem, settings) {
  if(document.getElementById(elem)) {
    var domElem = document.getElementById(elem);
    var value = null;
    if(domElem.tagName.toLowerCase() == "input") {
      if(domElem.type == "checkbox") {
        value = domElem.checked;
      } else if(domElem.type == "text") {
        value = domElem.value;
      } else if(domElem.type == "number") {
        value = (domElem.value.length == 0) ? null : parseInt(domElem.value, 10);
      }
    } else if(domElem.tagName.toLowerCase() == "select") {
      value = domElem.value;
    }
    if(value !== null) {
      settings[elem] = value;
    }
  } else if(document.getElementsByName(elem).length > 0) {
    var radios = document.getElementsByName(elem);
    for(var i = 0; i < radios.length; i++) {
      if (radios[i].checked) {
        settings[elem] = radios[i].value;
        break;
      }
    }
  }
}

// Get a suitable title for the current profile tab.
function getCurrentProfileTabTitle() {
  var currentProfileTabTitle = document.getElementById("profileName").value.trim();
  var currentProfileIndex = getProfileIndex(currentSettings);
  if(currentProfileTabTitle.length == 0) {
    // If the profile doesn't have a custom name, use the same placeholder names we use everywhere.
    if(currentProfileIndex == 0) {
      currentProfileTabTitle = "(default profile)";
    } else {
      currentProfileTabTitle = "(profile " + (currentProfileIndex + 1) + ")";
    }
  }
  return currentProfileTabTitle;
}

// Update the form based on the latest changes to its contents. Just some minor UI things.
function updateForm() {
  var currentProfileIndex = getProfileIndex(currentSettings);
  var tabTarget = document.getElementById("profileTab" + currentProfileIndex).nextSibling;
  tabTarget.innerHTML = "";
  tabTarget.appendChild(document.createTextNode(getCurrentProfileTabTitle()));
  document.getElementById("profileName").placeholder = getCurrentProfileTabTitle();
  document.getElementById("psCharactersCustomList").disabled =
    !document.getElementById("psCharactersCustom").checked;
  document.getElementById("pmCustomCharacterListContainer").style.display =
    (document.getElementById("pmCharacterSet").value == "custom") ? "block" : "none";
  document.getElementById("pmLeetLevel").disabled =
    (document.getElementById("pmUseLeet").value == "off");
  document.getElementById("deleteProfile").disabled =
    (currentSettings.profiles.length < 2);
  document.getElementById("optionalPermissionPane").style.display =
    (document.getElementById("showPageAction").value == "when-applicable") ? "flex" : "none";
  // The keyboard shortcut combo can be changed by the user via the Firefox settings at any
  // point. Updating the displayed key combination on the settings page through a constantly
  // running timer seems like overkill, but whenever we're updating the form anyway we might
  // as well update the key combination just in case it's been changed.
  browser.commands.getAll().then((commands) => {
    if(commands.length > 0 && commands[0].name == "activate") {
      document.getElementById("hotkeyCombo").textContent = commands[0].shortcut;
    }
  });
  // Also make sure that the optional permission panel is up to date.
  browser.permissions.contains(theOptionalPermission).then((result) => {
    var button = document.getElementById("optionalPermissionRequest");
    var pane = document.getElementById("optionalPermissionPane");
    if(result) {
      pane.classList.remove("notgranted");
      pane.classList.add("granted");
      document.getElementById("optionalPermissionNotGranted").style.display = "none";
      document.getElementById("optionalPermissionGranted").style.display = "block";
      button.value = "Revoke permission";
    } else {
      pane.classList.remove("granted");
      pane.classList.add("notgranted");
      document.getElementById("optionalPermissionNotGranted").style.display = "block";
      document.getElementById("optionalPermissionGranted").style.display = "none";
      button.value = "Grant permission";
    }
  });
}

// Keep track of the last request for an example password that we send. If the form contents
// change quickly, such as when the user adjusts the password length, multiple example
// password requests may go out very quickly before the first one returns. We only ever want
// to display the last one.
var lastRequestId = null;

function updateExamplePassword() {
  document.getElementById("loadingIcon").style.display = "block";
  var myRequestId = Math.random();
  lastRequestId = myRequestId;
  saveSettings().then(() => {
    browser.runtime.sendMessage({
      wantExamplePasswordForProfile: getProfileIndex(currentSettings),
      id: myRequestId,
    }).then((message) => {
      if(message.requestId == lastRequestId) {
        document.getElementById("loadingIcon").style.display = "none";
        var displayPassword = message.examplePassword;
        var displayPasswordElem = document.getElementById("examplePassword");
        if(typeof displayPassword == "string") {
          displayPassword = displayPassword.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#039;");
          displayPasswordElem.innerHTML = "";
          displayPasswordElem.appendChild(document.createTextNode(displayPassword));
          displayPasswordElem.style.fontWeight = "bold";
          displayPasswordElem.style.fontStyle = "normal";
        } else {
          displayPasswordElem.innerHTML = "[ failed to generate ]";
          displayPasswordElem.style.fontWeight = "normal";
          displayPasswordElem.style.fontStyle = "italic";
        }
      }
    });
  });
}

// List of all possibly security alerts
var alertMessages = {
  no_protection_against_master_password_typos:
    "You currently have no way of detecting typos in your master password as you enter it.",
  master_password_stored_permanently:
    "You have set your master password to be saved permanently. This means that other software on your device can easily steal it.",
  show_master_password_in_plain_text:
    "You have set your master password to be displayed in plain text. This makes you vulnerable to over-the-shoulder attacks as well as malicious screengrabbers.",
  short_minimum_input_for_the_visual_hash:
    "You have set the visual hash to appear for very short master password fragments. This makes it much easier for over-the-shoulder attackers and screen recorders to reconstruct your master password.",
  short_delay_for_the_visual_hash:
    "You have set the visual hash to render very quickly. This may make it easier for over-the-shoulder attackers and screen recorders to reconstruct your master password if you type slowly.",
  requested_use_of_the_passwordmaker_engine:
    "You have chosen the legacy PasswordMaker engine for this profile. The algorithms it can use are older and much more vulnerable to attacks.",
  short_generated_password_length:
    "The length of generated passwords for this profile is very short. They are likely to leave you vulnerable to attacks.",
  short_password_character_set:
    "You have selected a small number of characters for your generated passwords. This makes them more vulnerable to attacks.",
  low_algorithmic_cost_parameter:
    "You have set the algorithm cost parameter to a low value. This makes your master password more susceptible to brute force attacks.",
};
// These are just the ones that apply per profile
var profileSpecificAlertMessages = [
  "requested_use_of_the_passwordmaker_engine",
  "short_generated_password_length",
  "short_password_character_set",
  "low_algorithmic_cost_parameter"
];

// Generate all possible security alerts for all profiles in advance. Most of these will be hidden.
function populateSecurityAlerts() {
  document.getElementById("securityAlerts").innerHTML = "";
  var newAlertLi = document.createElement("li");
  newAlertLi.id = "alert_none";
  newAlertLi.innerHTML = "No issues found.";
  document.getElementById("securityAlerts").appendChild(newAlertLi);
  for(var property in alertMessages) {
    if(alertMessages.hasOwnProperty(property) && !profileSpecificAlertMessages.includes(property)) {
      var newAlertLi = document.createElement("li");
      newAlertLi.id = "alert_" + property;
      newAlertLi.innerHTML = "";
      newAlertLi.appendChild(document.createTextNode(" " + alertMessages[property] + " "));
      // Special case for highest severity formatting
      if(property == "master_password_stored_permanently") {
        newAlertLi.style.fontWeight = "bold";
      }
      var readMoreLink = document.createElement("a");
      readMoreLink.href = "/docs/internal/security-alerts/index.html#" + property.replace(/_/g, "-");
      readMoreLink.target = "_blank";
      readMoreLink.appendChild(document.createTextNode("read more..."));
      newAlertLi.appendChild(readMoreLink);
      document.getElementById("securityAlerts").appendChild(newAlertLi);
    }
  }
  for(var i = 0; i < currentSettings.profiles.length; i++) {
    for(var property in alertMessages) {
      if(alertMessages.hasOwnProperty(property) && profileSpecificAlertMessages.includes(property)) {
        var newAlertLi = document.createElement("li");
        var profileName = currentSettings.profiles[i].profileName;
        if(profileName.length == 0) {
          if(i == 0) {
            profileName = "(default profile)";
          } else {
            profileName = "(profile " + (i + 1) + ")";
          }
        }
        newAlertLi.id = "alert_" + property + i;
        newAlertLi.innerHTML = "";
        var profileNameElem = document.createElement("strong");
        profileNameElem.appendChild(document.createTextNode(profileName + ":"));
        newAlertLi.appendChild(profileNameElem);
        newAlertLi.appendChild(document.createTextNode(" " + alertMessages[property] + " "));
        var readMoreLink = document.createElement("a");
        readMoreLink.href = "/docs/internal/security-alerts/index.html#" + property.replace(/_/g, "-");
        readMoreLink.target = "_blank";
        readMoreLink.appendChild(document.createTextNode("read more..."));
        newAlertLi.appendChild(readMoreLink);
        document.getElementById("securityAlerts").appendChild(newAlertLi);
      }
    }
  }
}

// Check the current settings for security weaknesses and unhide the corresponding security alerts.
function updateSecurityAlerts() {
  function setDisplay(alertId, visible) {
    document.getElementById("alert_" + alertId).style.display = visible ? "block" : "none";
  }
  var severity = 0;
  if(!currentSettings.verifyMasterPassword
     && !currentSettings.showMasterPassword
     && !currentSettings.storeMasterPasswordHash
     && !currentSettings.showVisualHash) {
    setDisplay("no_protection_against_master_password_typos", true);
    severity = Math.max(1, severity);
  } else {
    setDisplay("no_protection_against_master_password_typos", false);
  }
  if(currentSettings.showMasterPassword) {
    setDisplay("show_master_password_in_plain_text", true);
    severity = Math.max(1, severity);
  } else {
    setDisplay("show_master_password_in_plain_text", false);
  }
  if(currentSettings.storeMasterPassword == "permanent") {
    setDisplay("master_password_stored_permanently", true);
    severity = Math.max(2, severity);
  } else {
    setDisplay("master_password_stored_permanently", false);
  }
  if(currentSettings.visualHashMinInputLength < 6) {
    setDisplay("short_minimum_input_for_the_visual_hash", true);
    severity = Math.max(1, severity);
  } else {
    setDisplay("short_minimum_input_for_the_visual_hash", false);
  }
  if(currentSettings.visualHashDelay < 500) {
    setDisplay("short_delay_for_the_visual_hash", true);
    severity = Math.max(1, severity);
  } else {
    setDisplay("short_delay_for_the_visual_hash", false);
  }
  for(var profileId = 0; profileId < currentSettings.profiles.length; profileId++) {
    var profileSettings = currentSettings.profiles[profileId];
    if(profileSettings.profileEngine == "profileEnginePasswordMaker") {
      setDisplay("requested_use_of_the_passwordmaker_engine" + profileId, true);
      severity = Math.max(1, severity);
    } else {
      setDisplay("requested_use_of_the_passwordmaker_engine" + profileId, false);
    }
    if((profileSettings.profileEngine == "profileEngineDefault" && profileSettings.psPasswordLength < 12)
       || (profileSettings.profileEngine == "profileEnginePasswordMaker" && profileSettings.pmPasswordLength < 12)) {
      setDisplay("short_generated_password_length" + profileId, true);
      severity = Math.max(1, severity);
    } else {
      setDisplay("short_generated_password_length" + profileId, false);
    }
    var charSetLength = 0;
    if(profileSettings.profileEngine == "profileEngineDefault") {
      charSetLength += profileSettings.psCharactersAlphaCap ? 26 : 0;
      charSetLength += profileSettings.psCharactersAlphaLower ? 26 : 0;
      charSetLength += profileSettings.psCharactersNumbers ? 10 : 0;
      charSetLength += profileSettings.psCharactersSpecial ? 29 : 0;
      charSetLength += profileSettings.psCharactersSpaceQuotation ? 3 : 0;
      charSetLength += profileSettings.psCharactersCustom ? profileSettings.psCharactersCustomList.length : 0;
    }
    if(profileSettings.profileEngine == "profileEnginePasswordMaker") {
      charSetLength += profileSettings.pmCharacterSet.length;
      charSetLength += profileSettings.pmCustomCharacterList.length;
    }
    if(charSetLength < 55) {
      setDisplay("short_password_character_set" + profileId, true);
      severity = Math.max(1, severity);
    } else {
      setDisplay("short_password_character_set" + profileId, false);
    }
    function getCoefficientWarningMinimum(algo) {
      var result = null;
      if(algo == "scrypt") {
        result = 13;
      } else if(algo == "bcrypt") {
        result = 10;
      } else if(algo == "pbkdf2-sha256") {
        result = 75000;
      }
      return result;
    }
    if(profileSettings.profileEngine == "profileEngineDefault" && profileSettings.psAlgorithmCoefficient < getCoefficientWarningMinimum(profileSettings.psHashAlgorithm)) {
      setDisplay("low_algorithmic_cost_parameter" + profileId, true);
      severity = Math.max(1, severity);
    } else {
      setDisplay("low_algorithmic_cost_parameter" + profileId, false);
    }
  }
  setDisplay("none", severity == 0);
  var alertBox = document.getElementById("securityAlertsContainer");
  if(severity == 0) {
    alertBox.classList.add("green");
    alertBox.classList.remove("yellow");
    alertBox.classList.remove("red");
  } else if(severity == 1) {
    alertBox.classList.remove("green");
    alertBox.classList.add("yellow");
    alertBox.classList.remove("red");
  } else if(severity == 2) {
    alertBox.classList.remove("green");
    alertBox.classList.remove("yellow");
    alertBox.classList.add("red");
  }
}

// These things are named differently depending on the algorithm
function getCoefficientNameByAlgorithm(algo) {
  var name = "Algorithm coefficient";
  if(algo == "scrypt") {
    name = "Cost parameter";
  } else if(algo == "bcrypt") {
    name = "Cost parameter";
  } else if(algo == "pbkdf2-sha256") {
    name = "Iteration count";
  }
  return name;
}

// helper function
function isDescendantOf(descendant, ancestor) {
  if(typeof descendant === "string") {
    descendant = document.getElementById(descendant);
  }
  if(typeof ancestor === "string") {
    ancestor = document.getElementById(ancestor);
  }
  var foundElem = descendant;
  while (foundElem = foundElem.parentElement) {
    if (foundElem == ancestor) {
      return true;
    }
  }
  return false;
}

// We delegate the management of menu items to the background script.
function createOrUpdateMenu() {
  return browser.runtime.sendMessage({ createOrUpdateMenu: true });
}

// And here is where everything gets put together for the settings page.
document.addEventListener("DOMContentLoaded", () => {

  loadSettings().then(() => {
    populateSettingsForm(currentSettings);
    populateSecurityAlerts();
    updateForm();
    updateSecurityAlerts();
    updateExamplePassword();
    document.getElementById("profileTabX").addEventListener("click", () => {
      addNewProfile(currentSettings);
      document.getElementById("profileTab" + (currentSettings.profiles.length - 1)).checked = true;
      populateProfileArea(currentSettings, currentSettings.profiles.length - 1);
      populateSecurityAlerts();
      saveSettings().then(() => {
        createOrUpdateMenu();
      });
    });
    if(currentSettings.showSecurityAlerts) {
      document.getElementById("securityAlertsContainer").style.display = "block";
    } else {
      document.getElementById("securityAlertsReplacement").style.display = "block";
    }
  });

  document.getElementById("optionalPermissionRequest").addEventListener("click", (e) => {
    if(document.getElementById("optionalPermissionPane").classList.contains("granted")) {
      browser.permissions.remove(theOptionalPermission).then((result) => {
        updateForm();
      });
    } else {
      browser.permissions.request(theOptionalPermission).then((result) => {
        updateForm();
      });
    }
  });

  var inputs = Array.from(document.getElementsByTagName("input"));
  var selects = Array.from(document.getElementsByTagName("select"));
  var elems = inputs.concat(selects);

  for(var i = 0; i < elems.length; i++) {
    elems[i].addEventListener("change", (e) => {
      if(ignoreFormEvents == 0) {
        if(e.target.id == "psHashAlgorithm") {
          ignoreFormEvents += 1;
          var newAlgo = e.target.value;
          var newAlgoCoefficient = 0;
          var newAlgoCoefficientStepSize = 1;
          var newAlgoCoefficientMinimum = 1;
          if(newAlgo == "scrypt") {
            newAlgoCoefficient = 15;
          } else if(newAlgo == "bcrypt") {
            newAlgoCoefficient = 11;
            newAlgoCoefficientMinimum = 4;
          } else if(newAlgo == "pbkdf2-sha256") {
            newAlgoCoefficient = 100000;
            newAlgoCoefficientStepSize = 25000;
            newAlgoCoefficientMinimum = 25000;
          }
          document.getElementById("psAlgorithmCoefficient").value = newAlgoCoefficient;
          document.getElementById("psAlgorithmCoefficient").step = newAlgoCoefficientStepSize;
          document.getElementById("psAlgorithmCoefficient").min = newAlgoCoefficientMinimum;
          var newAlgoCoefficientName = getCoefficientNameByAlgorithm(newAlgo);
          var algoCoefficientElem = document.getElementById("psAlgorithmCoefficientName");
          algoCoefficientElem.innerHTML = "";
          algoCoefficientElem.appendChild(document.createTextNode(newAlgoCoefficientName + ":"));
          ignoreFormEvents -= 1;
        }
        updateForm();
        parseForm(currentSettings);
        updateSecurityAlerts();
        if((isDescendantOf(e.target, "profiles") || isDescendantOf(e.target, "profileContent"))
           && e.target.id != "profileName" && e.target.id != "showInContextMenu" && e.target.id != "useForHotkey") {
          updateExamplePassword();
        } else {
          saveSettings().then(() => {
            createOrUpdateMenu();
          });
        }
      }
    });
  }
  for(var i = 0; i < inputs.length; i++) {
    inputs[i].addEventListener("keyup", () => {
      if(ignoreFormEvents == 0) {
        updateForm();
        updateSecurityAlerts();
      }
    });
  }

  document.getElementById("showSecurityAlerts").addEventListener("click", () => {
    document.getElementById("securityAlertsContainer").style.display = "block";
    document.getElementById("securityAlertsReplacement").style.display = "none";
    currentSettings.showSecurityAlerts = true;
    saveSettings();
  });
  document.getElementById("hideSecurityAlerts").addEventListener("click", () => {
    document.getElementById("securityAlertsContainer").style.display = "none";
    document.getElementById("securityAlertsReplacement").style.display = "block";
    currentSettings.showSecurityAlerts = false;
    saveSettings();
  });

  document.getElementById("deleteProfileWarning").style.display = "none";
  document.getElementById("deleteProfileCancel").style.width = (document.getElementById("deleteProfile").offsetWidth) + "px";
  document.getElementById("deleteProfile").addEventListener("click", () => {
    document.getElementById("deleteProfileWarning").style.display = "inline-block";
    document.getElementById("deleteProfile").style.display = "none";
  });
  document.getElementById("deleteProfileCancel").addEventListener("click", () => {
    document.getElementById("deleteProfileWarning").style.display = "none";
    document.getElementById("deleteProfile").style.display = "inline";
  });
  document.getElementById("deleteProfileConfirm").addEventListener("click", () => {
    var currentProfileIndex = getProfileIndex(currentSettings);
    currentSettings.profiles.splice(currentProfileIndex, 1);
    saveSettings().then(() => {
      populateSettingsForm(currentSettings);
      updateForm();
      populateSecurityAlerts();
      updateSecurityAlerts();
      updateExamplePassword();
      createOrUpdateMenu();
    });
  });
  var disableSaveButton = () => {
    document.getElementById("saveSettings").removeAttribute("disabled");
    document.getElementById("textEditor").style.color = "#111";
  };
  document.getElementById("textEditor").addEventListener("keyup", disableSaveButton);
  document.getElementById("textEditor").addEventListener("change", disableSaveButton);
  document.getElementById("openTextEditor").addEventListener("click", () => {
    var json = JSON.stringify(currentSettings, null, 4);
    document.getElementById("textEditor").value = json;
    document.getElementById("saveSettings").setAttribute("disabled", "");
    document.getElementById("textEditorPane").style.display = "block";
  });
  document.getElementById("saveSettings").addEventListener("click", () => {
    var newSettings;
    try {
      newSettings = JSON.parse(document.getElementById("textEditor").value);
    } catch(e) {
      newSettings = undefined;
      document.getElementById("textEditor").style.color = "#f00";
    };
    if(newSettings !== undefined) {
      browser.runtime.sendMessage({
        overwriteSettings: true,
        newSettings: newSettings
      });
      document.getElementById("saveSettings").setAttribute("disabled", "");
      document.getElementById("cancelSettings").setAttribute("disabled", "");
      // Give the new settings a little bit of time to propagate before we reload the form
      setTimeout(() => {
        location.reload();
      }, 400);
    }
  });
  document.getElementById("cancelSettings").addEventListener("click", () => {
    document.getElementById("textEditorPane").style.display = "none";
  });

});
