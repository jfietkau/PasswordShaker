
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

function handleHashResult(hashResult, masterPassword, url, settings, depth, accumulator, resolve) {
  var charSet = createCharSet(settings);
  var maxCharactersPerUint = Math.floor(22.1807097779 / Math.log(charSet.length));
  while(hashResult.length >= 8 && accumulator.password.length < settings.passwordLength) {
    var hashPart = parseInt(hashResult.slice(0, 8), 16) >>> 0;
    hashResult = hashResult.slice(8);
    for(var i = 0; i < maxCharactersPerUint; i++) {
      accumulator.password += charSet[hashPart % charSet.length];
      hashPart = Math.floor(hashPart / charSet.length);
    }
  }
  var combinedSaltNew = new Uint8Array(accumulator.salt.length + 1);
  combinedSaltNew.set(accumulator.salt);
  combinedSaltNew[combinedSaltNew.length - 1] = 0xff;
  accumulator.salt = combinedSaltNew;
  generatePasswordPart(masterPassword, url, settings, depth + 1, accumulator, resolve);
}

function generatePasswordPart(masterPassword, url, settings, depth, accumulator, resolve) {
  var charSet = createCharSet(settings);
  var hostName = extractHostName(url);
  var domain = extractDomain(hostName);
  var thDomain = str2arr(domain);
  var thMainSalt = hex2arr(settings.mainSalt);
  // Math.log( 2 ^ 32 ) = 22.1807097779 (rounded down)
  if(accumulator.password.length < settings.passwordLength) {
    var hashResult = null;
    if(settings.hashAlgorithm == "pbkdf2-hmac-sha256") {
      hashResult = asmCrypto.PBKDF2_HMAC_SHA256.hex(masterPassword, accumulator.salt, settings.hashAlgorithmCoefficient, 64);
      handleHashResult(hashResult, masterPassword, url, settings, depth, accumulator, resolve);
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
        handleHashResult(hashResult, masterPassword, url, settings, depth, accumulator, resolve);
      });
    } else if(settings.hashAlgorithm == "scrypt") {
      var N = 2 ** settings.hashAlgorithmCoefficient, r = 8, p = 1;
      var dkLen = 64;
      scrypt(str2arr(masterPassword), accumulator.salt, N, r, p, dkLen, function(error, progress, key) {
        if (key) {
          handleHashResult(arr2hex(key), masterPassword, url, settings, depth, accumulator, resolve);
        } else if (error) {
          console.log("Error: " + error);
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
        for (var i = hash; i < hash + hashlen; i++) {
          hashArr.push(Module.HEAP8[i]);
        }
      } else {
        try {
          if (!err) {
            err = Module.Pointer_stringify(Module._argon2_error_message(res))
          }
        } catch (e) {}
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
      handleHashResult(arr2hex(hashArr), masterPassword, url, settings, depth, accumulator, resolve);
    }
  } else {
    accumulator.password = accumulator.password.slice(0, settings.passwordLength);
    resolve(accumulator.password);
  }
}

function generatePassword(masterPassword, url, settings) {
  var charSet = createCharSet(settings);
  if(charSet.length < 2) {
    return null;
  }
  var hostName = extractHostName(url);
  var domain = extractDomain(hostName);
  var thDomain = str2arr(domain);
  var thMainSalt = hex2arr(settings.mainSalt);
  var combinedSalt = new Uint8Array(thDomain.length + thMainSalt.length);
  combinedSalt.set(thDomain);
  combinedSalt.set(thMainSalt, thDomain.length);
  return new Promise((resolve, reject) => {
    generatePasswordPart(masterPassword, url, settings, 0, {salt: combinedSalt, password: ""}, resolve);
  });
}

// Provide the main interface for this password generation engine
base.psGeneratePassword = generatePassword;

})();
