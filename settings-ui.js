function populateSettingsForm(settings) {
  for(var property in settings) {
    if(settings.hasOwnProperty(property)) {
      populateSettingsElement(property, settings[property]);
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