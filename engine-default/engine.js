
(function () {

var base = typeof window === 'object' ? window : {};

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
  var toHash = hostName + masterPassword + hex2arr(settings.mainSalt);
  // Math.log( 2 ^ 32 ) = 22.1807097779 (rounded down)
  var maxCharactersPerUint = Math.floor(22.1807097779 / Math.log(charSet.length));
  while(generatedPassword.length < settings.passwordLength) {
    var hashResult = sha3_512(toHash);
    while(hashResult.length >= 8 && generatedPassword.length < settings.passwordLength) {
      var hashPart = parseInt(hashResult.slice(0, 8), 16) >>> 0;
      hashResult = hashResult.slice(8);
      for(var i = 0; i < maxCharactersPerUint; i++) {
        generatedPassword += charSet[hashPart % charSet.length];
        hashPart = Math.floor(hashPart / charSet.length);
      }
    }
    toHash += String.fromCharCode(0xff);
  }
  if(generatedPassword.length > settings.passwordLength) {
    generatedPassword = generatedPassword.slice(0, settings.passwordLength);
  }
  return generatedPassword;
}

// Provide the main interface for this password generation engine
base.psGeneratePassword = generatePassword;

})();
