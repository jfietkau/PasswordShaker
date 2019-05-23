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

// This code is injected into the active tab as a content script. It can count
// the current number of password fields on the page and listen for changes.

// Holds the current number of password fields, so that we can make sure only to send an
// update after it has actually changed.
var lastScannedNumberOfPasswordFields = undefined;

// Installs a mutation listener that updates the backend if password fields are added or removed.
function installChangeListener(tabIdPassthrough) {
  var observer = new MutationObserver(function(mutations) {
    updateNumberOfPasswordFields(tabIdPassthrough);
  });
  var config = { attributes: true, childList: true, characterData: true, subtree: true, attributeFilter: ["type"] };
  observer.observe(document.getElementsByTagName("body")[0], config);
}

// Counts the password fields on the current page.

// Sends the current number of password fields on the page to the backend.
function updateNumberOfPasswordFields(tabIdPassthrough) {
  var number = 0;
  var inputs = document.getElementsByTagName("input");
  for(var i = 0; i < inputs.length; i++) {
    if(inputs[i].type == "password") {
      number++;
    }
  }
  if(number != lastScannedNumberOfPasswordFields) {
    browser.runtime.sendMessage({
      numberOfPasswordFields: number,
      tabId: tabIdPassthrough,
      url: window.location.href
    });
  }
  lastScannedNumberOfPasswordFields = number;
}

