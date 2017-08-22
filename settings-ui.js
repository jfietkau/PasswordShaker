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
          newRadio.addEventListener("click", () => {
            ignoreFormEvents += 1;
            populateProfileArea(currentSettings, newRadio.value);
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
        value = parseInt(domElem.value);
      }
    } else if(domElem.tagName.toLowerCase() == "select") {
      value = domElem.value;
    }
    settings[elem] = value;
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

document.addEventListener("DOMContentLoaded", () => {
  loadSettings().then(() => {
    populateSettingsForm(currentSettings);
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
        parseForm(currentSettings);
      }
    });
  }

  document.getElementById("loadButton").addEventListener("click", loadSettings);
  document.getElementById("saveButton").addEventListener("click", saveSettings);
  document.getElementById("wipeButton").addEventListener("click", clearSettings);
  document.getElementById("showButton").addEventListener("click", debug_showSettings);
});