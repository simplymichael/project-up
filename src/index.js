const cp = require('child_process');
const inquirer = require('inquirer');
const writePackage = require('write-pkg');
//const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm';

module.exports = {
  ask,
  gitInit: initGit,
  npmInit: initNpm,
  install,
  writePackageJson
};


function ask(questions) {
  return inquirer
    .prompt(questions)
    .then(answers => answers)
    .catch(error => {
      if(error.isTtyError) {
        console.log('Prompt cannot be rendered in the current environment');
      } else {
        console.log('Something has gone wrong');
      }
    });
}

function initGit(opts) {
  const { github: { username, email } } = opts;

  cp.execSync(
    `git init && git config user.name ${username} && git config user.email ${email}`,
    {
      //stdio: 'inherit'
    }
  );
}

function initNpm() {
  cp.execSync('npm init -y');
}

/**
 * @param path {string} optional, the path to install to
 * @param deps {string} optional, the dependencies
 * @param devDeps {string} optional, the dev dependencies
 */
function install(deps, devDeps) { console.log('Installing dependencies');
  const processOpts = {
    //stdio: 'inherit',
    encoding : 'utf8'
  };

  if(Array.isArray(deps) && deps.length > 0) {
    const result = cp.execSync(`npm i -S ${deps.join(' ')}`, processOpts);
    console.log(result.stdout);
  }

  if(Array.isArray(devDeps) && devDeps.length > 0) {
    const result2 = cp.execSync(`npm i -D ${devDeps.join(' ')}`, processOpts);
    console.log(result2.stdout);
  }
}

/**
 * @param path {string} optional, path to the package.json file
 * @param opts {object} with members:
 *   - linter {string} eslint | markdown
 *   - useMarkdownViewer {boolean}
 */
async function writePackageJson(opts) {
  const { linter, useMarkdownViewer } = opts;

  let lintCommand;

  if(linter === 'elsint') {
    lintCommand = './node_modules/.bin/eslint ./src';
  } else if(linter === 'standard') {
    lintCommand = 'standard ./src';
  }

  const scripts = {
    'pretest': 'npm run lint',
    'test': 'run-script-os',
    'test:nix': 'NODE_ENV=test mocha _tests/"{,/**/}*.test.js"',
    'test:win32': 'set NODE_ENV=test& mocha _tests/"{,/**/}*.test.js"',
    'test:watch': 'npm test -- -w',
    'test:coverage': 'nyc npm test',
    'commit': 'git-cz',
    'lint': lintCommand,
    'lint:fix': 'npm run lint -- --fix',
    'prerelease': 'npm run test:coverage',
    'release': 'standard-version',
    'first-release': 'npm run release -- --first-release && git push origin --tags',
    'release:dry-run': 'npm run release -- --dry-run',
    'first-release:dry-run': 'npm run first-release -- --dry-run',
  };

  if(useMarkdownViewer) {
    scripts['view-readme'] = './node_modules/.bin/markdown-viewer -b';
    scripts['view-license'] = './node_modules/.bin/markdown-viewer -f LICENSE.md -b';
  }

  await writePackage({
    scripts,
  });

  await writePackage({
    config: {
      commitizen: {
        path: 'node_modules/cz-conventional-changelog'
      },
      ghooks: {
        'pre-commit': 'npm run lint && npm run test:coverage'
      }
    }
  });
}
