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

// This thing takes a password requirement list (formatted as in password-req-list.js) and
// parses it into a data structure more suitable for fast lookups. You can think of what it
// does as taking the list of simple hostnames and using them to populate a tree with the
// hostname fragments in reverse order.
//
// Example: "amazon.com" is one of the hostnames included in the list. So when "foo.amazon.com"
// is passed in as a query, it splits it apart and climbs the tree as follows:
// "com" -> no matching record, continuing
// "amazon" -> matching the record for "amazon.com", keeping it as result candidate
// "foo" -> no matching record, sticking with the one for "amazon.com" as best result candidate
// list empty -> return best candidate
//
// This allows us to have a specific record for aws.amazon.com for example, but match all other
// subdomains to the amazon.com one. It's not as complex as it may seem at first glance.

(function(root) {

var parsed = null;

function getBlankNode() {
  return {
    children: {},
    matches: [],
  };
}

function mergeRecord(db, hostnameParts, record) {
  var suffix = hostnameParts[0];
  hostnameParts = hostnameParts.slice(1);
  if(!db.children.hasOwnProperty(suffix)) {
    db.children[suffix] = getBlankNode();
  }
  if(hostnameParts.length == 0) {
    db.children[suffix].matches.push(record);
  } else {
    mergeRecord(db.children[suffix], hostnameParts, record);
  }
}

function parse(passwordReqList) {
  if(typeof passwordReqList == "string") {
    passwordReqList = JSON.parse(passwordReqList);
  }
  parsed = getBlankNode();

  for(var property in passwordReqList) {
    if(passwordReqList.hasOwnProperty(property) && !property.startsWith("__")) {
      for(var i = 0; i < passwordReqList[property].hostnames.length; i++) {
        var hostnameParts = passwordReqList[property].hostnames[i].split(".");
        hostnameParts.reverse();
        mergeRecord(parsed, hostnameParts, passwordReqList[property]);
      }
    }
  }
}

function findMatches(db, hostnameParts, url) {
  var result = [];
  if(hostnameParts.length >= 1) {
    var suffix = hostnameParts[0];
    if(db.children.hasOwnProperty(suffix)) {
      result = result.concat(findMatches(db.children[suffix], hostnameParts.slice(1), url));
    };
    if(db.children.hasOwnProperty("*")) {
      result = result.concat(findMatches(db.children["*"], hostnameParts.slice(1), url));
    };
  }
  if(url === null) {
    result = result.concat(db.matches);
  } else {
    for(var i = 0; i < db.matches.length; i++) {
      if(!db.matches[i].hasOwnProperty("urlFilter") || url.match(new RegExp(db.matches[i].urlFilter))) {
        result.push(db.matches[i]);
      }
    }
  }
  return result;
}

// If the client queries by hostname only, any URL filters in the records are ignored.
function byHostname(hostname) {
  if(parsed === null) {
    return null;
  }
  var hostnameParts = hostname.split(".");
  hostnameParts.reverse();

  var matches = findMatches(parsed, hostnameParts, null);
  if(matches.length > 0) {
    return matches[0];
  } else {
    return null;
  }
}

// If the client queries by full URL, the hostname is extracted from it. A record is only
// returned if the URL matches any URL filter that may be present.
function byUrl(url) {
  if(parsed === null) {
    return null;
  }

  var urlSegments = new URL(url);
  var hostnameParts = urlSegments.hostname.split(".");
  hostnameParts.reverse();

  var matches = findMatches(parsed, hostnameParts, url);
  if(matches.length > 0) {
    return matches[0];
  } else {
    return null;
  }
}

// Provide an interface to use this thing
root = root || window;
root.passwordReqListParser = {
  "version": "1.0",
  "parse": parse,
  "byHostname": byHostname,
  "byUrl": byUrl,
};

})(this);
