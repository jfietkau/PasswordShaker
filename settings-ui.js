function populateSettingsForm(settings) {
  for(var property in settings) {
    if(property == "profiles") {
      for(var i = 0; i < settings.profiles.length; i++) {
        if(!document.getElementById("profileTab" + i)) {
          var plusTab = document.getElementById("profileTabX"); 
          var newRadio = document.createElement("input");
          newRadio.type = "radio";
          newRadio.name = "profileTabs";
          newRadio.id = "profileTab" + i;
          document.getElementById("profiles").insertBefore(newRadio, plusTab);
          var newLabel = document.createElement("label");
          newLabel.htmlFor = "profileTab" + i;
          var tabTitle = settings.profiles[i].profileName;
          if(tabTitle.length == 0) {
            if(i == 0) {
              tabTitle = "(default profile)";
            } else {
              tabTitle = "(profile " + i + ")";
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
      document.getElementById("profileTab0").checked = true;
      populateProfileArea(settings.profiles[0]);
    } else if(settings.hasOwnProperty(property)) {
      populateSettingsElement(property, settings[property]);
    }
  }
}

function populateProfileArea(profileSettings) {
  for(var property in profileSettings) {
    if(profileSettings.hasOwnProperty(property)) {
      populateSettingsElement(property, profileSettings[property]);
    }
  }
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
  }
}

document.addEventListener("DOMContentLoaded", () => {
  loadSettings().then(() => {
    populateSettingsForm(currentSettings);
  });
  document.getElementById("loadButton").addEventListener("click", loadSettings);
  document.getElementById("saveButton").addEventListener("click", saveSettings);
  document.getElementById("wipeButton").addEventListener("click", clearSettings);
  document.getElementById("showButton").addEventListener("click", debug_showSettings);
});