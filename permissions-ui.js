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

var thePermission = { origins: ["<all_urls>"] };

function updatePage() {
  browser.permissions.contains(thePermission).then((result) => {
    var button = document.getElementById("request");
    var status = document.getElementById("status");
    if(result) {
      status.classList.remove("notgranted");
      status.classList.add("granted");
      status.innerHTML = "<span>current status: granted</span>";
      button.value = "Revoke permission";
    } else {
      status.classList.remove("granted");
      status.classList.add("notgranted");
      status.innerHTML = "<span>current status: not granted</span>";
      button.value = "Grant permission";
    }
  });
}

document.addEventListener("DOMContentLoaded", () => {

  updatePage();
  setInterval(updatePage, 500);

  document.getElementById("request").addEventListener("click", (e) => {
    if(document.getElementById("status").classList.contains("granted")) {
      browser.permissions.remove(thePermission).then((result) => {
        updatePage();
      });
    } else {
      browser.permissions.request(thePermission).then((result) => {
        updatePage();
      });
    }
  });

});
