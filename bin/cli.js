#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const program = require('commander');
const package = require('../src');
const { ask, gitInit, npmInit, install, writePackageJson } = package;
const devDependencies = [
  'chai',
  'commitizen',
  'cz-conventional-changelog',
  'ghooks',
  'mocha',
  'nyc',
  'run-script-os',
  'standard-version'
];
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

run(projectDir);

async function run(path) {

  const answers = await ask([
    {
      type: 'input',
      name: 'is-fresh',
      message: 'Fresh project? (No git init yet)',
      choices: ['yes', 'no'],
      default: 'yes'
    },
    {
      type: 'input',
      name: 'gh-username',
      message: 'Github username (git config user.name value)',
      when: function(answers) {
        return answers['is-fresh'] === 'yes';
      }
    },
    {
      type: 'input',
      name: 'gh-email',
      message: 'Github email (git config user.email value)',
      when: function(answers) {
        return answers['is-fresh'] === 'yes';
      }
    },
    {
      type: 'input',
      name: 'test-directory',
      message: 'Specify your test directory: (will be created if it does not exist)'
    },
    {
      type: 'list',
      name: 'linter',
      message: 'Select a linter',
      choices: ['ESLint', 'Standard']
    },
    {
      type: 'list',
      name: 'markdown-viewer',
      message: 'Install markdown-viewer? (https://npmjs.com/package/markdown-viewer)',
      choices: ['yes', 'no']
    }
  ]);

  devDependencies.push(answers['linter'].toLowerCase());

  if(answers['markdown-viewer'] === 'yes') {
    devDependencies.push('markdown-viewer');
  }

  // If the directory is not a git-directory, then initialize git
  if(answers['is-fresh'] === 'yes') {

    if(!fs.existsSync(`${path}/.git`)) {
      log('Initializing git...');
      gitInit({
        github: {
          username: answers['gh-username'],
          email: answers['gh-email']
        },
      });
      console.log('Initialized empty git repository');
    } else {
      log('The specified directory is a git repository... skipping "git init"');
    }

    if(!fs.existsSync(`${path}/package.json`)) {
      log('Creating package.json...');
      npmInit({});
      log('package.json created');
    } else {
      log('The specified directory is already contains a package.json file... skipping "npm init"');
    }
  }


  install([], devDependencies);

  await writePackageJson({
    linter: answers['linter'].toLowerCase(),
  });
}
