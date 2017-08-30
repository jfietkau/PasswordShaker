
(function () {

var base = typeof window === 'object' ? window : {};
var textEncoder = new TextEncoder();
var str2arr = function(str) {
  return textEncoder.encode(str);
}

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

function getRandomBytes(numberOfBytes) {
  var buffer = new ArrayBuffer(numberOfBytes);
  var uint8View = new Uint8Array(buffer);
  window.crypto.getRandomValues(uint8View);
  return uint8View;
}

function createCharSet(settings) {
  var charSet = "";
  if(settings.charactersAlphaCap) {
    charSet += "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
  }
  if(settings.charactersAlphaLower) {
    charSet += "abcdefghijklmnopqrstuvwxyz";
  }
  if(settings.charactersNumbers) {
    charSet += "0123456789";
  }
  if(settings.charactersSpecial) {
    charSet += "!#$%&()*+,-./:;<=>?@[\]^_`{|}~";
  }
  if(settings.charactersSpaceQuotation) {
    charSet += "\"' ";
  }
  if(settings.charactersCustom) {
    charSet += settings.charactersCustomList;
  }
  return charSet;
}

function extractHostName(url) {
  var parseHelper = document.createElement("a");
  parseHelper.href = url;
  var hostName = parseHelper.hostname;
  return hostName;
}

function isCompoundTld(urlPart) {
  if(urlPart.startsWith(".")) {
    urlPart = urlPart.slice(1);
  }
  // TODO
  return false;
}

function extractDomain(hostName) {
  var parts = hostName.split(".");
  if(!isNaN(parseInt(parts.slice(-1)[0]))) {
    // this is an IP address
    return hostName;
  }
  if(parts.length == 1) {
    // assumed to be a local name (no TLD)
    return hostName;
  }
  var publicSuffix = publicSuffixList.getPublicSuffix(hostName);
  // keep the public suffix plus one more name segment below that
  var result = parts.slice(-1 - publicSuffix.split(".").length);
  return result.join(".");
}

function generatePassword(masterPassword, url, settings) {
  var charSet = createCharSet(settings);
  if(charSet.length < 2) {
    return null;
  }
  var hostName = extractHostName(url);
  var domain = extractDomain(hostName);
  var generatedPassword = "";
  var thDomain = str2arr(domain);
  var thMasterPassword = str2arr(masterPassword);
  var thMainSalt = hex2arr(settings.mainSalt);
  var toHash = new Uint8Array(thDomain.length + thMasterPassword.length + thMainSalt.length);
  toHash.set(thDomain);
  toHash.set(thMasterPassword, thDomain.length);
  toHash.set(thMainSalt, thDomain.length + thMasterPassword.length);
  // Math.log( 2 ^ 32 ) = 22.1807097779 (rounded down)
  var maxCharactersPerUint = Math.floor(22.1807097779 / Math.log(charSet.length));
  while(generatedPassword.length < settings.passwordLength) {
    var hashResult = null;
    if(settings.hashAlgorithm == "sha3") {
      hashResult = sha3_512(toHash);
    } else if(settings.hashAlgorithm.startsWith("pbkdf2-hmac-sha256-")) {
      var iterations = parseInt(settings.hashAlgorithm.slice("pbkdf2-hmac-sha256-".length));
      hashResult = asmCrypto.PBKDF2_HMAC_SHA256.hex(masterPassword + domain, thMainSalt, iterations, settings.passwordLength);
    } else if(settings.hashAlgorithm.startsWith("bcrypt-")) {
      var costFactor = parseInt(settings.hashAlgorithm.slice("bcrypt-".length));
      var collapsedSalt = new Uint8Array(16);
      for(var i = 0; i < thDomain.length + thMainSalt.length; i++) {
        collapsedSalt[i % 16] = collapsedSalt[i % 16] ^ ((i < thDomain.length) ? thDomain[i] : thMainSalt[i - thDomain.length]);
      }
      var salt = "$2a$" + costFactor + "$";
      salt += base64ArrayBuffer(collapsedSalt).replace(/\+/g, ".").slice(0, 22);
      var rawHash = dcodeIO.bcrypt.hashSync(masterPassword, salt);
      hashResult = rawHash.slice(salt.length);
      hashResult = arr2hex(base64ToArrayBuffer(hashResult.replace(/\./g, "+")));
    }
    while(hashResult.length >= 8 && generatedPassword.length < settings.passwordLength) {
      var hashPart = parseInt(hashResult.slice(0, 8), 16) >>> 0;
      hashResult = hashResult.slice(8);
      for(var i = 0; i < maxCharactersPerUint; i++) {
        generatedPassword += charSet[hashPart % charSet.length];
        hashPart = Math.floor(hashPart / charSet.length);
      }
    }
    var toHashNew = new Uint8Array(toHash.length + 1);
    toHashNew.set(toHash);
    toHashNew[toHashNew.length - 1] = 0xff;
    toHash = toHashNew;
  }
  if(generatedPassword.length > settings.passwordLength) {
    generatedPassword = generatedPassword.slice(0, settings.passwordLength);
  }
  return generatedPassword;
}

// Provide the main interface for this password generation engine
base.psGeneratePassword = generatePassword;

})();
