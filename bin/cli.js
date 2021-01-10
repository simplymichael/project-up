#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const program = require('commander');
const package = require('../src');
const { setup } = package;
const log = console.log;
const options = [
  'verbose',
  'locale'
];
let projectDir = path.basename(path.resolve(process.cwd()));
let projectName = projectDir;

program
  .name('project-up')
  .version(require('../package.json').version)
  .option('-v, --verbose', 'enable verbose output')
  .option('-l --locale <locale>', 'specify locale')
  .arguments('<PROJECT_NAME>');

program.parse(process.argv);

if (program.args.length > 0) {
  projectName = program.args[0];
  projectDir = projectName.replace(/\s+/g, '-').toLowerCase();
}

if(projectName.toLowerCase() === projectDir) {
  projectName = projectName.replace(
    /[-, _](\w)/g,
    (g, c) => ' ' + c.toUpperCase()
  );
}

projectName = projectName.trim();
projectDir = projectDir.trim();

if(!fs.existsSync(projectDir)) {
  fs.mkdirSync(projectDir);
}

process.chdir(projectDir);

(async function() {
  await setup(projectName, {
    directory: projectDir,
    locale: program.locale,
    verbose: program.verbose
  });
})();
