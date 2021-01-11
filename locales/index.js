const fs = require('fs');
const path = require('path');
const languages = {};
const files = fs.readdirSync(__dirname);

for(let i = 0, len = files.length; i < len; i++) {
  const filename = path.basename(files[i], '.js');

  // don't iclude this index.js file
  if(filename === 'index') {
    continue;
  }

  languages[filename] = require(`./${filename}`);
}

module.exports = languages;
