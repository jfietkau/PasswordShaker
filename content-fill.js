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

// This code is injected into the active tab as a content script. It handles the
// transfer of the generated password from the add-on into the password field(s)
// in question.

// Fills in one password field and dispatches some events to simulate key presses
function fillPasswordField(passwordField, password) {
  var event = new KeyboardEvent("keydown", {});
  passwordField.dispatchEvent(event);
  event = new KeyboardEvent("keypress", {});
  passwordField.dispatchEvent(event);
  passwordField.value = password;
  var event = new Event("input", {
    target: passwordField,
    bubbles: true,
    cancelable: true,
  });
  event = new KeyboardEvent("keyup", {});
  passwordField.dispatchEvent(event);
  passwordField.dispatchEvent(event);
  event = new Event("change", {
    target: passwordField,
    bubbles: true,
    cancelable: true,
  });
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

