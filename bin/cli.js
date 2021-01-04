#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const program = require('commander');
const package = require('../src');
const { setup } = package;
const log = console.log;
let projectDir = path.basename(path.resolve(process.cwd()));
let projectName = projectDir;

program
  .version(require('../package.json').version)
  .arguments('<name>');

program.parse(process.argv);

if (program.args.length > 0) {
  projectName = program.args[0];
  projectDir = projectName.replace(/\s+/g, '-').toLowerCase();

  if(projectName.toLowerCase() === projectDir) {
    projectName = projectName.replace(
      /[-, _](\w)/g,
      (g, c) => ' ' + c.toUpperCase()
    );
  }

  //program.outputHelp();

  if(!fs.existsSync(projectDir)) {
    log(`Creating ${projectDir}...`);
    fs.mkdirSync(projectDir);
    log(`${projectDir} created`);
  }

  process.chdir(projectDir);
}

(async function() {
  await setup(projectName, {
    directory: projectDir,
  });
})();
