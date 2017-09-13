var passwordReqList = 

{
  "OSNews": {
    "hostnames": ["osnews.com"],
    "name": "OSNews"
  }
}

;

passwordReqList["byHostname"] = function(hostname) {
  for(var property in this) {
    if(this.hasOwnProperty(property) && typeof this[property] == "object"
       && this[property].hasOwnProperty("hostnames")
       && this[property].hostnames.includes(hostname)) {
      return this[property];
    }
  }
  return null;
}
