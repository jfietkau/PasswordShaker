// This code is injected into the active tab when the extension is activated.

function passwordshaker_fill(password) {
  if(typeof document.activeElement !== 'undefined' && document.activeElement !== null
     && document.activeElement.tagName.toLowerCase() == "input" && document.activeElement.type == "password") {
    // If a password field is focused, fill that one in.
    document.activeElement.value = password;
  } else {
    // Otherwise, fill in all empty password fields on the page.
    var allInputs = document.getElementsByTagName("input");
    console.log(allInputs);
    for(var i = 0; i < allInputs.length; i++) { 
      if(allInputs[i].type == "password" && allInputs[i].value.length == 0) {
        allInputs[i].value = password;
      }
    }
  }
}
