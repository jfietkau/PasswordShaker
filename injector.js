// This code is injected into the active tab as a content script.

// Fills in one password field and dispatches some events to simulate key presses
function fillPasswordField(passwordField, password) {
  var event = new KeyboardEvent("keydown", {});
  passwordField.dispatchEvent(event);
  event = new KeyboardEvent("keypress", {});
  passwordField.dispatchEvent(event);
  event = new KeyboardEvent("keyup", {});
  passwordField.dispatchEvent(event);
  passwordField.value = password;
  event = document.createEvent("HTMLEvents");
  event.initEvent("change", false, true);
  passwordField.dispatchEvent(event);
}

// Fills in either the currently focused password field or all password fields on the page
function fillPassword(password) {
  if(typeof document.activeElement !== 'undefined' && document.activeElement !== null
     && document.activeElement.tagName.toLowerCase() == "input" && document.activeElement.type == "password") {
    // If a password field is focused, fill that one in.
    fillPasswordField(document.activeElement, password);
  } else {
    // Otherwise, fill in all empty password fields on the page.
    var allInputs = document.getElementsByTagName("input");
    for(var i = 0; i < allInputs.length; i++) {
      if(allInputs[i].type == "password" && allInputs[i].value.length == 0) {
        fillPasswordField(allInputs[i], password);
      }
    }
  }
}

// Installs a mutation listener that updates the backend if password fields are added or removed.
function installChangeListener(tabIdPassthrough) {
  var observer = new MutationObserver(function(mutations) {
    sendNumberOfPasswordFields(tabIdPassthrough);
  });
  var config = { attributes: true, childList: true, characterData: true, subtree: true, attributeFilter: ["type"] };
  observer.observe(document.getElementsByTagName("body")[0], config);
}

// Sends the current number of password fields on the page to the backend.
function sendNumberOfPasswordFields(tabIdPassthrough) {
  var number = 0;
  var inputs = document.getElementsByTagName("input");
  for(var i = 0; i < inputs.length; i++) {
    if(inputs[i].type == "password") {
      number++;
    }
  }
  browser.runtime.sendMessage({
    numberOfPasswordFields: number,
    tabId: tabIdPassthrough,
    url: window.location.href
  });
}

