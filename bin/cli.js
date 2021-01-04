#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const program = require('commander');
const package = require('../src');
const { setup } = package;
const log = console.log;
let projectDir = path.basename(path.resolve(process.cwd()));

program
  .version(require('../package.json').version)
  .arguments('<path>');

program.parse(process.argv);

if (program.args.length > 0) {
  projectDir = program.args[0]; //program.outputHelp();

  if(!fs.existsSync(projectDir)) {
    log(`Creating ${projectDir}...`);
    fs.mkdirSync(projectDir);
    log(`${projectDir} created`);
  }

  process.chdir(projectDir);
}

(async function() {
  await setup();
})();
