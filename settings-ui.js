var ignoreFormEvents = 0;

function removeElementById(elemId) {
  var elem = document.getElementById(elemId);
  elem.parentNode.removeChild(elem);
}

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
            populateProfileArea(currentSettings, parseInt(e.target.value));
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

function addNewProfile(settings) {
  var newIndex = settings.profiles.length;
  settings.profiles.push({});
  extendObjectWith(settings.profiles[newIndex], getDefaultProfileSettings());
  populateSettingsForm(settings);
}

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
    document.getElementById("psAlgorithmCoefficient").step = 10000;
    document.getElementById("psAlgorithmCoefficient").min = 10000;
  } else {
    document.getElementById("psAlgorithmCoefficient").step = 1;
    document.getElementById("psAlgorithmCoefficient").min = (currentAlgoName == "bcrypt") ? 4 : 1;
  }
  document.getElementById("psAlgorithmCoefficientName").innerHTML = newAlgoCoefficientName + ":";
  document.getElementById("deleteProfileWarning").style.display = "none";
  document.getElementById("deleteProfile").style.display = "inline";
  ignoreFormEvents -= 1;
}

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

function parseForm(settings) {
  for(var property in settings) {
    if(property != "profiles" && settings.hasOwnProperty(property)) {
      parseSettingsElement(property, settings);
    }
  }
  if(!document.getElementById("storeMasterPasswordHash").checked) {
    clearStoredHash();
  }
  if(document.getElementById("storeMasterPassword").value != "permanent") {
    browser.runtime.sendMessage({clearStoredMasterPassword: true});
  }
  var profileIndex = getProfileIndex(settings);
  for(var i = 0; i < settings.profiles.length; i++) {
    if(document.getElementById("profileTab" + i).checked) {
      profileIndex = i;
      break;
    }
  }
  for(var property in settings.profiles[profileIndex]) {
    if(settings.profiles[profileIndex].hasOwnProperty(property)) {
      if(property == "useForHotkey" && document.getElementById(property).checked) {
        for(var i = 0; i < settings.profiles.length; i++) {
          settings.profiles[i].useForHotkey = false;
        }
      }
      parseSettingsElement(property, settings.profiles[profileIndex]);
    }
  }
}

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
        value = (domElem.value.length == 0) ? null : parseInt(domElem.value);
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

function getCurrentProfileTabTitle() {
  var currentProfileTabTitle = document.getElementById("profileName").value.trim();
  var currentProfileIndex = getProfileIndex(currentSettings);
  if(currentProfileTabTitle.length == 0) {
    if(currentProfileIndex == 0) {
      currentProfileTabTitle = "(default profile)";
    } else {
      currentProfileTabTitle = "(profile " + (currentProfileIndex + 1) + ")";
    }
  }
  return currentProfileTabTitle;
}

function updateForm() {
  var currentProfileIndex = getProfileIndex(currentSettings);
  var tabTarget = document.getElementById("profileTab" + currentProfileIndex).nextSibling;
  tabTarget.innerHTML = getCurrentProfileTabTitle();
  document.getElementById("profileName").placeholder = getCurrentProfileTabTitle();
  document.getElementById("psCharactersCustomList").disabled =
    !document.getElementById("psCharactersCustom").checked;
  document.getElementById("pmCustomCharacterListContainer").style.display =
    (document.getElementById("pmCharacterSet").value == "custom") ? "block" : "none";
  document.getElementById("pmLeetLevel").disabled =
    (document.getElementById("pmUseLeet").value == "off");
  document.getElementById("deleteProfile").disabled =
    (currentSettings.profiles.length < 2);
}

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
        if(typeof displayPassword == "string") {
          displayPassword = displayPassword.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#039;");
          document.getElementById("examplePassword").innerHTML = displayPassword;
          document.getElementById("examplePassword").style.fontWeight = "bold";
          document.getElementById("examplePassword").style.fontStyle = "normal";
        } else {
          document.getElementById("examplePassword").innerHTML = "[ failed to generate ]";
          document.getElementById("examplePassword").style.fontWeight = "normal";
          document.getElementById("examplePassword").style.fontStyle = "italic";
        }
      }
    });
  });
}

var alertMessages = {
  no_protection_against_master_password_typos:
    "You currently have no way of detecting typos in your master password as you enter it.",
  master_password_stored_permanently:
   "<strong>You have set your master password to be saved permanently. This means that other software on your device can easily steal it.</strong>",
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
var profileSpecificAlertMessages = [
  "requested_use_of_the_passwordmaker_engine",
  "short_generated_password_length",
  "short_password_character_set",
  "low_algorithmic_cost_parameter"
];

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
      var readMore = " <a href=\"/docs/internal/security-alerts/index.html#" + property.replace(/_/g, "-") + "\" target=\"_blank\">read more...</a>";
      newAlertLi.innerHTML = alertMessages[property] + readMore;
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
        var readMore = " <a href=\"/docs/internal/security-alerts/index.html#" + property.replace(/_/g, "-") + "\" target=\"_blank\">read more...</a>";
        newAlertLi.innerHTML = "<strong>" + profileName + ":</strong> " + alertMessages[property] + readMore;
        document.getElementById("securityAlerts").appendChild(newAlertLi);
      }
    }
  }
}

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
      if(algo == "argon2") {
        result = 2;
      } else if(algo == "scrypt") {
        result = 9;
      } else if(algo == "bcrypt") {
        result = 9;
      } else if(algo == "pbkdf2-hmac-sha256") {
        result = 30000;
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

function getCoefficientNameByAlgorithm(algo) {
  var name = "Algorithm coefficient";
  if(algo == "argon2") {
    name = "Execution time exponent";
  } else if(algo == "scrypt") {
    name = "Cost parameter";
  } else if(algo == "bcrypt") {
    name = "Cost parameter";
  } else if(algo == "pbkdf2-hmac-sha256") {
    name = "Iteration count";
  }
  return name;
}

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
          if(newAlgo == "argon2") {
            newAlgoCoefficient = 3;
          } else if(newAlgo == "scrypt") {
            newAlgoCoefficient = 10;
          } else if(newAlgo == "bcrypt") {
            newAlgoCoefficient = 10;
            newAlgoCoefficientMinimum = 4;
          } else if(newAlgo == "pbkdf2-hmac-sha256") {
            newAlgoCoefficient = 50000;
            newAlgoCoefficientStepSize = 10000;
            newAlgoCoefficientMinimum = 10000;
          }
          document.getElementById("psAlgorithmCoefficient").value = newAlgoCoefficient;
          document.getElementById("psAlgorithmCoefficient").step = newAlgoCoefficientStepSize;
          document.getElementById("psAlgorithmCoefficient").min = newAlgoCoefficientMinimum;
          var newAlgoCoefficientName = getCoefficientNameByAlgorithm(newAlgo);
          document.getElementById("psAlgorithmCoefficientName").innerHTML = newAlgoCoefficientName + ":";
          ignoreFormEvents -= 1;
        }
        if(e.target.id == "showPageAction") {
          if(e.target.value == "when-applicable") {
            // currently blocked by https://bugzilla.mozilla.org/show_bug.cgi?id=1382953
            browser.permissions.request({
              origins: ["<all_urls>"],
            }).then((result) => {
              console.log(result);
            });
          }
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

  browser.runtime.getBrowserInfo().then((info) => {
    if(info.vendor == "Mozilla" && info.name == "Firefox") {
      var showPageAction = document.getElementById("showPageAction");
      var whenApplicable = showPageAction.getElementsByTagName('option')[1];
      whenApplicable.innerHTML += " (coming soon!)";
      whenApplicable.disabled = true;
    }
  });

});
