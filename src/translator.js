const locales = require('../locales');
const defaultLocale = 'en';
let locale = 'en';

function getValue(obj, str) {
  const parts = str.split('.');
  let clone = { ...obj };
  let value = {};

  while(parts.length) {
    const prop = parts.shift();

    value[prop] = clone[prop];
    value = value[prop];
    clone = clone[prop];
  }

  return value;
}

const translator = {
  setLocale: function(loc) {
    locale = loc;
  },

  getLocale: function() {
    return locale;
  },

  getLocales: function() {
    return Object.keys(locales);
  },

  /**
   * Usage:
   *   1. translator.translate(user.firstname);
   *   2. translator.translate(user.names.first)
   */
  translate: function(string) {
    const userLocale = translator.getLocale();
    const localeData = locales[userLocale] || locales[defaultLocale];
    const translation = getValue(localeData, string);

    return translation;
  }
};


module.exports = translator;
