
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

root = root || window;
root.passwordReqListParser = {
  "version": "1.0",
  "parse": parse,
  "byHostname": byHostname,
  "byUrl": byUrl,
};

})(this);
