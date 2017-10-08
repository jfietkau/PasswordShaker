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

// This is the default password generation engine for PasswordShaker (i.e. the one
// that's not all about PasswordMaker compatibility).

(function () {

var base = typeof window === 'object' ? window : {};
var textEncoder = new TextEncoder();
var str2arr = function(str) {
  return textEncoder.encode(str);
}

// helper function
function base64ToArrayBuffer(b64str) {
  b64str += "===";
  b64str = b64str.slice(0, b64str.length - (b64str.length % 4));

  var chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=";
  var result = new Array();

  for(var i = 0; i < b64str.length; i += 4) {
    var sub1 = chars.indexOf(b64str.charAt(i));
    var sub2 = chars.indexOf(b64str.charAt(i + 1));
    var sub3 = chars.indexOf(b64str.charAt(i + 2));
    var sub4 = chars.indexOf(b64str.charAt(i + 3));

    var bits = (sub1 << 18) | (sub2 << 12) | (sub3 << 6) | sub4;

    result.push((bits >>> 16) & 0xff);

    if(sub3 != 64) {
      result.push((bits >>> 8) & 0xff);
    }
    if(sub4 != 64) {
      result.push(bits & 0xff);
    }
  }

  return Uint8Array.from(result);
}

// helper function
function getRandomBytes(numberOfBytes) {
  var buffer = new ArrayBuffer(numberOfBytes);
  var uint8View = new Uint8Array(buffer);
  window.crypto.getRandomValues(uint8View);
  return uint8View;
}

// possible parts of the character set - we enumerate them here so we can refer to them by name in the following
var charSetSegment = {
  upper: "ABCDEFGHIJKLMNOPQRSTUVWXYZ",
  lower: "abcdefghijklmnopqrstuvwxyz",
  letter: "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz",
  digit: "0123456789",
  special: "!#$%&()*+,-./:;<=>?@[\]^_`{|}~",
  spaceQuotation: "\"' ",
};

// Constructs a character set according to the given settings.
function createCharSet(settings) {
  var charSet = "";
  if((settings.charactersAlphaCap || settings.passwordRequirements.minNumUpper > 0)
     && (!settings.passwordRequirements.hasOwnProperty("maxNumUpper") || (settings.passwordRequirements.maxNumUpper > 0))) {
    charSet += charSetSegment.upper;
  }
  if((settings.charactersAlphaLower || settings.passwordRequirements.minNumLower > 0)
     && (!settings.passwordRequirements.hasOwnProperty("maxNumLower") || (settings.passwordRequirements.maxNumLower > 0))) {
    charSet += charSetSegment.lower;
  }
  if(charSet.length == 0 && settings.passwordRequirements.minNumLetter > 0) {
    charSet += charSetSegment.letter;
  }
  if((settings.charactersNumbers || settings.passwordRequirements.minNumDigit > 0)
     && (!settings.passwordRequirements.hasOwnProperty("maxNumDigit") || (settings.passwordRequirements.maxNumDigit > 0))) {
    charSet += charSetSegment.digit;
  }
  if((settings.charactersSpecial || settings.passwordRequirements.minNumSpecial > 0)
     && (!settings.passwordRequirements.hasOwnProperty("maxNumSpecial") || (settings.passwordRequirements.maxNumSpecial > 0))) {
    charSet += charSetSegment.special;
  }
  if(settings.charactersSpaceQuotation) {
    charSet += charSetSegment.spaceQuotation;
  }
  if(settings.charactersCustom) {
    charSet += settings.charactersCustomList;
  }
  if(typeof settings.passwordRequirements.forbiddenCharacters == "string") {
    var forbidden = settings.passwordRequirements.forbiddenCharacters;
    for(var i = 0; i < forbidden.length; i++) {
      while(charSet.indexOf(forbidden[i]) > -1) {
        charSet = charSet.replace(forbidden[i], "");
      }
    }
  }
  return charSet;
}

// Get hostname from full URL
function extractHostName(url) {
  var urlObject = new URL(url);
  var hostName;
  if(urlObject.protocol == "file:") {
    hostName = "Local file";
  } else {
    hostName = urlObject.hostname;
  }
  return hostName;
}

// Extract the public suffix from a hostname
function extractTopLevelHostname(hostName) {
  var parts = hostName.split(".");
  if(!isNaN(parseInt(parts.slice(-1)[0]))) {
    // this is an IP address
    return hostName;
  }
  if(parts.length == 1) {
    // assumed to be a local name (no TLD)
    return hostName;
  }
  // access the public suffix list that's been set up in the background script
  var publicSuffix = publicSuffixList.getPublicSuffix(hostName);
  // keep the public suffix plus one more name segment below that
  var result = parts.slice(-1 - publicSuffix.split(".").length);
  return result.join(".");
}

// Count the number of appearances of characters from alphabet in data
function countNumberOf(alphabet, data) {
  var count = 0;
  for(var i = 0; i < alphabet.length; i++) {
    count += data.split(alphabet[i]).length - 1;
  }
  return count;
}

// Swap out one character in a string
function replaceAt(str, index, char) {
  return str.substr(0, index) + char + str.substr(index + 1);
}

// Try to put a certain number of characters from the given alphabet into a string
function forceInto(alphabet, data, number, seedInt) {
  var offsetCandidates = [7, 37, 71, 103, 139, 181];
  while(number > 0) {
    number--;
    var offset = offsetCandidates[offsetCandidates.length - 1];
    while(alphabet.indexOf(data[offset % data.length]) > -1) {
      offset += offsetCandidates[(offset + seedInt) % offsetCandidates.length];
    }
    data = replaceAt(data, offset % data.length, alphabet[offset % alphabet.length]);
  }
  return data;
}

// Count the distinct characters in a string
function countDistinct(str) {
  var chars = "";
  for(var i = 0; i < str.length; i++) {
    if(chars.indexOf(str[i]) == -1) {
      chars += str[i];
    }
  }
  return chars.length;
}

// Checks if the given password fulfills the given invariant. The invariant comes from the site-specific
// password requirements and can cover things such as "at least one special character or number".
// Worth noting is that we don't actually parse these invariants as cleanly as you would expect. Because
// they cover only a small subset of all possible boolean expressions, we take a lot of very rude shortcuts,
// such as ignoring parentheses entirely.
function fulfillsInvariant(password, invariant) {
  invariant = invariant.replace(/ /g, "");
  var fulfills;
  if(invariant.indexOf("||") > -1) {
    fulfills = false;
    var segments = invariant.split("||");
    for(var i = 0; i < segments.length; i++) {
      fulfills = fulfills || fulfillsInvariant(password, segments[i]);
    }
  } else if(invariant.indexOf("&&") > -1) {
    fulfills = true;
    var segments = invariant.split("&&");
    for(var i = 0; i < segments.length; i++) {
      fulfills = fulfills && fulfillsInvariant(password, segments[i]);
    }
  } else {
    invariant = invariant.replace(/\(/g, "");
    invariant = invariant.replace(/\)/g, "");
    var charClasses = ["Upper", "Lower", "Letter", "Digit", "Special"];
    for(var i = 0; i < charClasses.length; i++) {
      invariant = invariant.replace(new RegExp("num" + charClasses[i], 'g'), countNumberOf(charSetSegment[charClasses[i].toLowerCase()], password));
    }
    var prevStep = null;
    while(invariant != prevStep) {
      prevStep = invariant;
      if(invariant.match(/[0-9]+\+[0-9]+/) != null) {
        var match = invariant.match(/[0-9]+\+[0-9]+/)[0];
        var replacement = match.split("+");
        replacement = parseInt(replacement[0], 10) + parseInt(replacement[1], 10);
        invariant = invariant.split(match).join(replacement);
      }
      if(invariant.match(/[0-9]+-[0-9]+/) != null) {
        var match = invariant.match(/[0-9]+-[0-9]+/)[0];
        var replacement = match.split("-");
        replacement = parseInt(replacement[0], 10) - parseInt(replacement[1], 10);
        invariant = invariant.split(match).join(replacement);
      }
    }
    if(invariant.indexOf(">=") > -1) {
      var sides = invariant.split(">=");
      fulfills = parseInt(sides[0], 10) >= parseInt(sides[1], 10);
    } else if(invariant.indexOf("<=") > -1) {
      var sides = invariant.split("<=");
      fulfills = parseInt(sides[0], 10) <= parseInt(sides[1], 10);
    } else if(invariant.indexOf("==") > -1) {
      var sides = invariant.split("==");
      fulfills = parseInt(sides[0], 10) == parseInt(sides[1], 10);
    } else if(invariant.indexOf(">") > -1) {
      var sides = invariant.split(">");
      fulfills = parseInt(sides[0], 10) > parseInt(sides[1], 10);
    } else if(invariant.indexOf("<") > -1) {
      var sides = invariant.split("<");
      fulfills = parseInt(sides[0], 10) < parseInt(sides[1], 10);
    }
  }
  return fulfills;
}

// Some of the hash algorithms are async, so this whole password generation process here is a bit convoluted.
// This function gets called basically when there is a new hash result ready to be processed to become part of
// the password. handleHashResult() and generatePasswordPart() call each other recursively until the password
// fulfills the length requirement.
function handleHashResult(hashResult, masterPassword, url, settings, depth, accumulator, resolve, requestId) {
  var charSet = createCharSet(settings);
  // The idea here is to calculate how many characters of the given charset we can extract from 32 bits.
  // Think of it as a base conversion from binary into (charSet.length)-ary.
  var maxCharactersPerUint = Math.floor(22.1807097779 / Math.log(charSet.length));
  var desiredPasswordLength = settings.passwordLength;
  if(settings.passwordRequirements.minLength) {
    desiredPasswordLength = Math.max(desiredPasswordLength, settings.passwordRequirements.minLength);
  }
  if(settings.passwordRequirements.maxLength) {
    desiredPasswordLength = Math.min(desiredPasswordLength, settings.passwordRequirements.maxLength);
  }
  // Look at 4 bytes at a time
  while(hashResult.length >= 8 && accumulator.password.length < desiredPasswordLength) {
    var hashPart = parseInt(hashResult.slice(0, 8), 16) >>> 0;
    hashResult = hashResult.slice(8);
    for(var i = 0; i < maxCharactersPerUint; i++) {
      accumulator.password += charSet[hashPart % charSet.length];
      hashPart = Math.floor(hashPart / charSet.length);
    }
  }
  // Assuming the password is not long enough yet, for the next round of hashing we append a byte
  // to our salt to get a different hash output
  var combinedSaltNew = new Uint8Array(accumulator.salt.length + 1);
  combinedSaltNew.set(accumulator.salt);
  combinedSaltNew[combinedSaltNew.length - 1] = 0xff;
  accumulator.salt = combinedSaltNew;
  generatePasswordPart(masterPassword, url, settings, depth + 1, accumulator, resolve, requestId);
}

// This is the "main" password generation function. It prepares the data and hands things off to the
// specific algorithm, which then goes on to handleHashResult(), and from there it's recursive. However,
// this function handles the end of the loop when the password is long enough.
function generatePasswordPart(masterPassword, url, settings, depth, accumulator, resolve, requestId) {
  var charSet = createCharSet(settings);
  var hostName = extractHostName(url);
  var domain = extractTopLevelHostname(hostName);
  if(settings.passwordRequirements && settings.passwordRequirements.hasOwnProperty("hostnames")) {
    domain = settings.passwordRequirements.hostnames[0];
  }
  if(settings.inputTextOverride) {
    domain = settings.inputTextOverride;
  }
  var thDomain = str2arr(domain);
  var thMainSalt = hex2arr(settings.mainSalt);
  // Math.log( 2 ^ 32 ) = 22.1807097779 (rounded down)
  var desiredPasswordLength = settings.passwordLength;
  if(settings.passwordRequirements.minLength) {
    desiredPasswordLength = Math.max(desiredPasswordLength, settings.passwordRequirements.minLength);
  }
  if(settings.passwordRequirements.maxLength) {
    desiredPasswordLength = Math.min(desiredPasswordLength, settings.passwordRequirements.maxLength);
  }
  if(accumulator.password.length < desiredPasswordLength) {
    var hashResult = null;
    // Here is where we actually dive into the respective algorithms. They all come from different libraries
    // and as such are handled differently.
    if(settings.hashAlgorithm == "pbkdf2-sha256") {
      pbkdf2WebCrypto(str2arr(masterPassword), accumulator.salt, settings.hashAlgorithmCoefficient, 64).then((hashResult) => {
        handleHashResult(arr2hex(hashResult), masterPassword, url, settings, depth, accumulator, resolve, requestId);
      });
    } else if(settings.hashAlgorithm == "bcrypt") {
      var collapsedSalt = new Uint8Array(16);
      for(var i = 0; i < thDomain.length + thMainSalt.length; i++) {
        collapsedSalt[i % 16] = collapsedSalt[i % 16] ^ ((i < thDomain.length) ? thDomain[i] : thMainSalt[i - thDomain.length]);
      }
      var saltPart = "" + settings.hashAlgorithmCoefficient;
      if(settings.hashAlgorithmCoefficient < 10) {
        saltPart = "0" + saltPart;
      }
      var salt = "$2a$" + saltPart + "$";
      salt += base64ArrayBuffer(collapsedSalt).replace(/\+/g, ".").slice(0, 22);
      dcodeIO.bcrypt.hash(masterPassword, salt, function(err, rawHash) {
        hashResult = rawHash.slice(salt.length);
        hashResult = arr2hex(base64ToArrayBuffer(hashResult.replace(/\./g, "+")));
        handleHashResult(hashResult, masterPassword, url, settings, depth, accumulator, resolve, requestId);
      });
    } else if(settings.hashAlgorithm == "scrypt") {
      var N = 2 ** settings.hashAlgorithmCoefficient, r = 8, p = 1;
      var dkLen = 64;
      scrypt(str2arr(masterPassword), accumulator.salt, N, r, p, dkLen, function(error, progress, key) {
        if(key) {
          handleHashResult(arr2hex(key), masterPassword, url, settings, depth, accumulator, resolve, requestId);
        } else if(error) {
          console.log("scrypt error: " + error);
        }
      });
    } else if(settings.hashAlgorithm == "argon2") {
      var t_cost = 2 ** settings.hashAlgorithmCoefficient;
      var m_cost = 1024;
      var parallelism = 1;
      var pwd = Module.allocate(Module.intArrayFromString(masterPassword), 'i8', Module.ALLOC_NORMAL);
      var pwdlen = masterPassword.length;
      var salt = Module.allocate(accumulator.salt, 'i8', Module.ALLOC_NORMAL);
      var saltlen = accumulator.salt.length;
      var hash = Module.allocate(new Array(64), 'i8', Module.ALLOC_NORMAL);
      var hashlen = 64;
      var encoded = Module.allocate(new Array(512), 'i8', Module.ALLOC_NORMAL);
      var encodedlen = 512;
      var argon2_type = 0;
      var version = 0x13;
      var err;
      try {
        var res = Module._argon2_hash(t_cost, m_cost, parallelism, pwd, pwdlen, salt, saltlen,
                    hash, hashlen, encoded, encodedlen,
                    argon2_type, version);
      } catch (e) {
        err = e;
      }
      if (res === 0 && !err) {
        var hashArr = [];
        for(var i = hash; i < hash + hashlen; i++) {
          hashArr.push(Module.HEAP8[i]);
        }
      } else {
        try {
          if(!err) {
            err = Module.Pointer_stringify(Module._argon2_error_message(res))
          }
        } catch(e) {}
        console.log('Argon2 error: ' + res + (err ? ': ' + err : ''));
      }
      try {
        Module._free(pwd);
        Module._free(salt);
        Module._free(hash);
        Module._free(encoded);
      } catch (e) {}
      // hashArr comes back as signed bytes, so fix to unsigned
      for(var i = 0; i < hashArr.length; i++) {
        if(hashArr[i] < 0) {
          hashArr[i] += 256;
        }
      }
      handleHashResult(arr2hex(hashArr), masterPassword, url, settings, depth, accumulator, resolve, requestId);
    }
  } else {
    // At this point, the password generation from hashes is finished, but we may still need
    // to force in some site-specific requirements.
    accumulator.password = accumulator.password.slice(0, desiredPasswordLength);
    var charClasses = ["Upper", "Lower", "Letter", "Digit", "Special"];
    var seedInts = [0, 5, 11, 17, 23];
    for(var i = 0; i < charClasses.length; i++) {
      if(settings.passwordRequirements.hasOwnProperty("minNum" + charClasses[i])) {
        if(countNumberOf(charSetSegment[charClasses[i].toLowerCase()], accumulator.password) < settings.passwordRequirements["minNum" + charClasses[i]]) {
          accumulator.password = forceInto(charSetSegment[charClasses[i].toLowerCase()], accumulator.password,
                                           settings.passwordRequirements["minNum" + charClasses[i]] - 
                                             countNumberOf(charSetSegment[charClasses[i].toLowerCase()], accumulator.password),
                                           seedInts[i]);
        }
      }
    }
    if(settings.passwordRequirements.hasOwnProperty("minDistinctCharacters")) {
      var offset = 151;
      while(countDistinct(accumulator.password) < settings.passwordRequirements.minDistinctCharacters) {
        accumulator.password = replaceAt(accumulator.password, offset % accumulator.password.length, charSet[offset % charSet.length]);
        offset += 151;
        if(offset < 0) {
          offset = 0;
        }
      }
    }
    if(settings.passwordRequirements.hasOwnProperty("invariant")) {
      var offset = 0;
      var mentioned = [];
      for(var i = 0; i < charClasses.length; i++) {
        if(settings.passwordRequirements.invariant.indexOf("num" + charClasses[i]) > -1) {
          mentioned.push(charClasses[i]);
        }
      }
      var maxIter = 1000;
      while(maxIter-- > 0 && !fulfillsInvariant(accumulator.password, settings.passwordRequirements.invariant)) {
        // In practice, the invariant will probably always be used for minimum occurrances of whatever
        // character class. So we make the naive assumption here that we can eventually fulfill it by
        // increasing each character class mentioned in it in turn. Assuming the password itself is
        // long enough, this should fulfill the invariant almost immediately. If the invariant itself
        // is impossible or highly unlikely to fulfill at the given length, we just give up.
        accumulator.password = forceInto(charSetSegment[mentioned[maxIter % mentioned.length].toLowerCase()], accumulator.password,
                                         1,
                                         seedInts[maxIter % seedInts.length]);
      }
      if(maxIter == 0) {
        accumulator.password = null;
      }
    }
    resolve({
      password: accumulator.password,
      inputText: domain,
      requestId: requestId,
    });
  }
}

// The outside interface for the main password generation function.
function generatePassword(masterPassword, url, settings, requestId) {
  settings.passwordRequirements = settings.passwordRequirements || {};

  var hostName = extractHostName(url);
  var domain = extractTopLevelHostname(hostName);
  if(settings.passwordRequirements.hasOwnProperty("hostnames")) {
    domain = settings.passwordRequirements.hostnames[0];
  }
  if(settings.inputTextOverride) {
    domain = settings.inputTextOverride;
  }

  var charSet = createCharSet(settings);
  if(charSet.length < 2) {
    // if the character set is too short, fail immediately
    return new Promise((resolve, reject) => {
      resolve({
        password: null,
        inputText: domain,
        requestId: requestId
      });
    });
  }

  var thDomain = str2arr(domain);
  var thMainSalt = hex2arr(settings.mainSalt);
  var combinedSalt = new Uint8Array(thDomain.length + thMainSalt.length);
  combinedSalt.set(thDomain);
  combinedSalt.set(thMainSalt, thDomain.length);
  return new Promise((resolve, reject) => {
    generatePasswordPart(masterPassword, url, settings, 0, {salt: combinedSalt, password: ""}, resolve, requestId);
  });
}

// Provide the main interface for this password generation engine
base.psGeneratePassword = generatePassword;

})();
