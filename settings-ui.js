var ignoreFormEvents = 0;

function populateSettingsForm(settings) {
  ignoreFormEvents += 1;
  for(var property in settings) {
    if(property == "profiles") {
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
            updateExamplePassword();
            ignoreFormEvents -= 1;
          });
          document.getElementById("profiles").insertBefore(newRadio, plusTab);
          var newLabel = document.createElement("label");
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
        document.getElementById("profiles").removeChild(document.getElementById("profileTab" + superfluousTabIndex));
      }
      var profileIndex = getProfileIndex(settings);
      if(profileIndex === null) {
        document.getElementById("profileTab0").checked = true;
        populateProfileArea(settings, 0);
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
  var profileIndex = getProfileIndex(settings);
  for(var i = 0; i < settings.profiles.length; i++) {
    if(document.getElementById("profileTab" + i).checked) {
      profileIndex = i;
      break;
    }
  }
  for(var property in settings.profiles[profileIndex]) {
    if(settings.profiles[profileIndex].hasOwnProperty(property)) {
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
}

function updateExamplePassword() {
  saveSettings().then(() => {
    browser.runtime.sendMessage({wantExamplePasswordForProfile: getProfileIndex(currentSettings)}).then((message) => {
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
    });
  });
}

document.addEventListener("DOMContentLoaded", () => {
  loadSettings().then(() => {
    populateSettingsForm(currentSettings);
    updateForm();
    updateExamplePassword();
    document.getElementById("profileTabX").addEventListener("click", () => {
      addNewProfile(currentSettings);
      document.getElementById("profileTab" + (currentSettings.profiles.length - 1)).checked = true;
      populateProfileArea(currentSettings, currentSettings.profiles.length - 1);
    });
  });
  var inputs = Array.from(document.getElementsByTagName("input"));
  var selects = Array.from(document.getElementsByTagName("select"));
  var elems = inputs.concat(selects);
  for(var i = 0; i < elems.length; i++) {
    elems[i].addEventListener("change", () => {
      if(ignoreFormEvents == 0) {
        updateForm();
        parseForm(currentSettings);
        updateExamplePassword();
        createOrUpdateContextMenu();
      }
    });
  }
  for(var i = 0; i < inputs.length; i++) {
    inputs[i].addEventListener("keyup", () => {
      if(ignoreFormEvents == 0) {
        updateForm();
      }
    });
  }

  document.getElementById("wipeButton").addEventListener("click", clearSettings);
  document.getElementById("showButton").addEventListener("click", debug_showSettings);
});
