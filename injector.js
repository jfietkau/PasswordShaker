// This code is injected into the active tab as a content script.

function fillPassword(password) {
  if(typeof document.activeElement !== 'undefined' && document.activeElement !== null
     && document.activeElement.tagName.toLowerCase() == "input" && document.activeElement.type == "password") {
    // If a password field is focused, fill that one in.
    document.activeElement.value = password;
  } else {
    // Otherwise, fill in all empty password fields on the page.
    var allInputs = document.getElementsByTagName("input");
    for(var i = 0; i < allInputs.length; i++) {
      if(allInputs[i].type == "password" && allInputs[i].value.length == 0) {
        allInputs[i].value = password;
      }
    }
  }
}

function installChangeListener(tabIdPassthrough) {
  var observer = new MutationObserver(function(mutations) {
    sendNumberOfPasswordFields(tabIdPassthrough);
  });
  var config = { attributes: true, childList: true, characterData: true, subtree: true, attributeFilter: ["type"] };
  observer.observe(document.getElementsByTagName("body")[0], config);
}

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

