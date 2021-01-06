const fs = require('fs');
const path = require('path');
const util = require('util');
const cp = require('child_process');
const write = require('write');
const read = require('read-file');
const inquirer = require('inquirer');
const emptyDir = require('empty-dir');
const writePackage = require('write-pkg');
const requireUncached = require('require-without-cache');
const badges = require('../badges');
const licenses = require('../licenses');
const currentYear = new Date().getFullYear();
const rootDir = path.resolve(__dirname, '..');
const SEP = path.sep;
const log = console.log;

let cwd;

module.exports = {
  setup
};


/**
 * @param opts {object} with members:
 *   - directory {string} the project directory name
 */
async function setup(projectName, opts) {
  cwd = process.cwd();

  let ownerName;
  let ownerEmail;
  let projectDesc;
  let dependencies = [];
  let devDependencies = [
    'commitizen',
    'cz-conventional-changelog',
    'ghooks',
    'nyc',
    'run-script-os',
    'standard-version'
  ];
  const splitRegex = /\s+,?\s+/;
  const { directory: projectDir } = opts;
  const gitInitialized = fs.existsSync(`${cwd}/.git`);
  const npmInitialized = fs.existsSync(`${cwd}/package.json`);

  if(npmInitialized) {
    projectDesc = requireWithoutCache(`${cwd}/package.json`).description.trim();
  }

  if(gitInitialized) {
    ownerName = await(execShellCommand('git config user.name'));
    ownerEmail = await(execShellCommand('git config user.email'));

    if(typeof ownerName === 'string') {
      ownerName = ownerName.trim();
    }

    if(typeof ownerEmail === 'string') {
      ownerEmail = ownerEmail.trim();
    }
  }

  const questions = [
    {
      type: 'input',
      name: 'description',
      message: 'Project description:',
      default: projectDesc
    },
    {
      type: 'input',
      name: 'name',
      message: 'Your name (git config user.name value):',
      when: function() {
        return !gitInitialized;
      }
    },
    {
      type: 'input',
      name: 'gh-username',
      message: 'Github username:',
    },
    {
      type: 'input',
      name: 'gh-email',
      message: 'Github email:',
      when: function() {
        return !gitInitialized;
      }
    },
    {
      type: 'list',
      name: 'license',
      message: 'License:',
      choices: ['No License'].concat(Object.values(licenses)),
      default: licenses['mit']
    },
    {
      type: 'input',
      name: 'license-owner',
      message: 'License Owner/Organization name:',
      default: function(answers) {
        return gitInitialized ? ownerName : answers['name'];
      },
      when: function(answers) {
        return answers['license'].toLowerCase() !== 'none';
      }
    },
    {
      type: 'input',
      name: 'license-year',
      message: 'License Year:',
      default: currentYear,
      when: function(answers) {
        return answers['license'].toLowerCase() !== 'none';
      }
    },
    {
      type: 'list',
      name: 'create-src-directory',
      message: 'Create source directory:',
      choices: ['yes', 'no', 'already have']
    },
    {
      type: 'input',
      name: 'src-directory',
      message: 'Specify your source directory:',
      default: 'src',
      when: function(answers) {
        const createSrcDir = answers['create-src-directory'];

        return createSrcDir === 'yes' || createSrcDir === 'already have';
      }
    },
    {
      type: 'list',
      name: 'test-framework',
      message: 'Choose a test framework:',
      choices: ['Jasmine', 'Mocha'],
      default: 'Mocha'
    },
    {
      type: 'list',
      name: 'create-test-directory',
      message: 'Create test directory:',
      choices: ['yes', 'no', 'already have']
    },
    {
      type: 'input',
      name: 'test-directory',
      message: 'Specify your test directory:',
      default: function(answers) {
        return answers['test-framework'].toLowerCase() === 'jasmine'
          ? 'spec'
          : 'tests';
      },
      when: function(answers) {
        const createTestDir = answers['create-test-directory'];

        return createTestDir === 'yes' || createTestDir === 'already have';
      }
    },
    {
      type: 'list',
      name: 'test-files-extension',
      message: 'Test files extension:',
      choices: ['spec.js', '.test.js', 'Other'],
      default: function(answers) {
        return answers['test-framework'].toLowerCase() === 'jasmine'
          ? 'spec.js'
          : '.test.js';
      }
    },
    {
      type: 'input',
      name: 'custom-test-files-extension',
      message: 'Please specify the test files extension:',
      when: function(answers) {
        return answers['test-files-extension'].toLowerCase() === 'other';
      }
    },
    {
      type: 'list',
      name: 'linter',
      message: 'Linter:',
      choices: ['ESLint', 'Standard', 'None']
    },
    {
      type: 'input',
      name: 'dependencies',
      message: 'Dependencies, separated by spaces or commas: (dep@version dep2 dep3@version):'
    },
    {
      type: 'input',
      name: 'dev-dependencies',
      message: 'Dev dependencies, separated by spaces or commas: (dep@version dep2 dep3@version):'
    },
    {
      type: 'input',
      name: 'proceed',
      message: function(answers) {
        const settings = {
          Project: {
            name: projectName,
            directory: projectDir,
            description: answers['description'],
            owner: answers['name'] || ownerName
          },
          GitHub: {
            username: answers['gh-username'],
            email: answers['gh-email'] || ownerEmail,
          },
          License: {
            name: answers['license'],
          },
          test: {
            framework: answers['test-framework'],
            extension: answers['test-files-extension'].toLowerCase() === 'other'
              ? answers['custom-test-files-extension']
              : answers['test-files-extension']
          },
          Linter: answers['linter'],
          'Dev dependencies': devDependencies
            .concat(answers['test-framework'].toLowerCase() === 'jasmine'
              ? ['jasmine'] : ['mocha', 'chai'])
            .concat([answers['linter'].toLowerCase()])
            .concat(answers['dev-dependencies'].split(splitRegex))
            .filter(el => el.length > 0)
            .sort(),
        };

        if(answers['dependencies']) {
          settings['Dependencies'] = answers['dependencies'].split(splitRegex);
        }

        if(answers['license'].toLowerCase() !== 'none') {
          settings['License']['owner'] = answers['license-owner'];
          settings['License']['year'] = answers['license-year'];
        }

        if(answers['src-directory']) {
          settings['Source directory'] = answers['src-directory'];
        }

        if(answers['test-directory']) {
          settings['test']['directory'] = answers['test-directory'];
        }

        log('Please review your selection: ');
        log(util.inspect(settings));

        return 'Proceed? [Y/n]:';
      }
    }
  ];
  const answers = await ask(questions);
  const linter = answers['linter'].toLowerCase();
  const srcDir = answers['src-directory'];
  const testDir = answers['test-directory'];
  const testFramework = answers['test-framework'].toLowerCase();
  const testFilesExtension = (
    answers['test-files-extension'].toLowerCase() === 'other'
      ? answers['custom-test-files-extension']
      : answers['test-files-extension']
  );

  if(answers['proceed'].toLowerCase() === 'n') {
    process.exit('0');
  }

  if(answers['dependencies']) {
    const userDeps = answers['dependencies'].split(splitRegex);

    dependencies = dependencies.concat(userDeps);
  }

  if(answers['dev-dependencies']) {
    const userDevDeps = answers['dev-dependencies'].split(splitRegex);

    devDependencies = devDependencies.concat(userDevDeps).sort();
  }

  if(answers['test-framework'].toLowerCase() === 'jasmine') {
    devDependencies.push('jasmine');
  } else {
    devDependencies.push('mocha', 'chai');
  }

  devDependencies.push(answers['linter'].toLowerCase());

  devDependencies = devDependencies.filter(el => el.length > 0);

  // If the directory is not a git-directory, then initialize git
  if(!gitInitialized) {
    log('Initializing git...');
    gitInit({
      github: {
        username: answers['name'],
        email: answers['gh-email']
      },
    });
    log('Initialized empty git repository');
  } else {
    log('The specified directory is a git repository... skipping "git init"');
  }

  if(!npmInitialized) {
    log('Creating package.json...');
    npmInit();
    log('package.json created');
  } else {
    log('The specified directory already contains a package.json file... skipping "npm init"');
  }

  if(srcDir && !fs.existsSync(`${cwd}${SEP}${srcDir}`)) {
    log(`Creating source directory ${srcDir}...`);
    fs.mkdirSync(`${cwd}${SEP}${srcDir}`);
    log('Source directory created');
  }

  if(testDir && !fs.existsSync(`${cwd}${SEP}${testDir}`)) {
    log(`Creating test directory ${testDir}...`);
    fs.mkdirSync(`${cwd}${SEP}${testDir}`);
    log('Test directory created');
  }

  await install(dependencies, devDependencies);

  log('Updating package.json...');
  await writePackageJson({
    description: answers['description'],
    license: getKeyByValue(licenses, answers['license']).toUpperCase(),
    testFramework: testFramework,
    testFilesExtension: testFilesExtension,
    linter: linter,
    sourceDirectory: srcDir,
    testDirectory: testDir,
  });
  log('package.json updated');

  log('Creating README file...');
  await writeReadMe(projectName, {
    description: answers['description'],
    github: {
      username: answers['gh-username'],
      projectPath: opts.directory,
    },
  });
  log('README file created');

  if(answers['license'].toLowerCase() !== 'none') {
    log(`Generating ${answers['license']} license...`);
    generateLicense(answers['license'], {
      owner: answers['license-owner'],
      year: answers['license-year']
    });
    log('License generated');
  }

  const esLintExists = fs.existsSync(`${cwd}${SEP}.eslintrc.js`)
    || fs.existsSync(`${cwd}${SEP}.eslintrc.json`)
    || fs.existsSync(`${cwd}${SEP}.eslintrc.yml`);

  const isFreshTestDir = emptyDir.sync(`${cwd}${SEP}${testDir}`, (filepath) => {
    return !/(Thumbs\.db|\.DS_Store)$/i.test(filepath);
  });

  if(linter === 'eslint' && !esLintExists) {
    log('You are almost done.');
    log('Please take a moment to setup ESLint.');
    const cmd = `${cwd}${SEP}node_modules${SEP}.bin${SEP}eslint --init`;

    cp.execSync(cmd, {
      stdio: 'inherit',
      encoding : 'utf-8'
    });
  }

  if(isFreshTestDir) {
    log('Setting up tests...');
    if(testFramework === 'jasmine') {
      cp.execSync('npx jasmine init', { encoding : 'utf-8' });
    }

    createSampleTests(testFramework, srcDir, testDir, testFilesExtension);
    log('Tests setup complete');
  }

  if(!fs.existsSync(`${cwd}${SEP}.nycrc.json`)) {
    log('Creating .nycrc.json...');
    writeCoverageConfig(srcDir, testFilesExtension);
    log('.nycrc.json created');
  }

  log('You are all set');
  log(`
    To run your tests, run "npm test"
    To run tests with coverage reporting, run "npm run test:coverage"
    To commit your changes, run "npm run commit"
    To fix linting errors, run "npm run lint:fix"
    To run your first release, run "npm run first-release"
    To run subsequent releases, run "npm run release"
    To run release dry-run, run "npm run release:dry-run"
  `);
}

function ask(questions) {
  return inquirer
    .prompt(questions)
    .then(answers => answers)
    .catch(error => {
      if(error.isTtyError) {
        log('Prompt cannot be rendered in the current environment');
      } else {
        log('Something has gone wrong');
      }
    });
}

function gitInit(opts) {
  const { github: { username, email } } = opts;

  writeIgnoreFiles();

  cp.execSync(
    `git init && git config user.name "${username}" && git config user.email ${email}`,
    {
      //stdio: 'inherit'
    }
  );
}

function npmInit() {
  cp.execSync('npm init -y');
}

/**
 * @param path {string} optional, the path to install to
 * @param deps {string} optional, the dependencies
 * @param devDeps {string} optional, the dev dependencies
 */
async function install(deps, devDeps) {
  const processOpts = {
    encoding: 'utf-8',
    //stdio: 'inherit'
  };
  const packageJson = requireWithoutCache(`${cwd}${SEP}package.json`);
  const installedDeps = packageJson.dependencies;
  const installedDevDeps = packageJson.devDependencies;

  if(installedDeps) {
    deps = deps.filter(dep => !Object.keys(installedDeps).includes(dep));
  }

  if(installedDevDeps) {
    devDeps = devDeps.filter(dep => !Object.keys(installedDevDeps).includes(dep));
  }

  if(Array.isArray(deps) && deps.length > 0) {
    //cp.execSync(`npm i -S ${deps.join(' ')}`, processOpts);

    /*deps.forEach(async dep => {
      await execShellCommand(`npm i -S ${dep}`, processOpts);
    }); */
    deps.sort();

    log('Installing dependencies... This might take a while...');
    for(let i = 0; i < deps.length; i++) {
      const dep = deps[i];
      log(`installing ${dep}`);
      cp.execSync(`npm i -S ${dep}`, processOpts);
      log(`${dep} installed`);
    }
    log('Dependencies installed');
  }

  if(Array.isArray(devDeps) && devDeps.length > 0) {
    //cp.execSync(`npm i -D ${devDeps.join(' ')}`, processOpts);

    /*devDeps.forEach(async dep => {
      await execShellCommand(`npm i -D ${dep}`, processOpts);
    });*/
    devDeps.sort();

    log('Installing dev dependencies... This might take a while...');
    for(let i = 0; i < devDeps.length; i++) {
      const dep = devDeps[i];
      log(`installing ${dep}`);
      cp.execSync(`npm i -D ${dep}`, processOpts);
      log(`${dep} installed`);
    }
    log('Dev dependencies installed');

    return true;
  }
}

/**
 * @param path {string} optional, path to the package.json file
 * @param opts {object} with members:
 *   - linter {string} eslint | markdown
 *   - sourceDirectory {string} source files directory
 *   - testDirectory {string} directory holding test files
 */
async function writePackageJson(opts) {
  const {
    description,
    license,
    linter,
    testFramework,
    testFilesExtension,
    testDirectory,
    sourceDirectory
  } = opts;
  const packageJson = requireWithoutCache(`${cwd}${SEP}package.json`);
  let lintCommand;

  if(linter === 'eslint') {
    lintCommand = './node_modules/.bin/eslint';
  } else if(linter === 'standard') {
    lintCommand = 'standard';
  }

  if(sourceDirectory) {
    lintCommand += ` ${sourceDirectory}`;
  }

  const config = {
    ...packageJson.config,
    commitizen: {
      path: 'node_modules/cz-conventional-changelog'
    },
    ghooks: {
      'pre-commit': 'npm run lint && npm run test:coverage'
    }
  };
  const scripts = {
    ...packageJson.scripts,
    'commit': 'git-cz',
    'release': 'standard-version',
    'first-release': 'npm run release -- --first-release && git push origin --tags',
    'release:dry-run': 'npm run release -- --dry-run'
  };

  if(lintCommand.length > 0) {
    scripts['pretest'] = 'npm run lint';
    scripts['lint'] = lintCommand;
    scripts['lint:fix'] = 'npm run lint -- --fix';
  }

  if(testDirectory) {
    scripts['test'] = 'run-script-os';
    scripts['test:nix'] = `NODE_ENV=test ${testFramework} ${testDirectory}/"{,/**/}*${testFilesExtension}"`;
    scripts['test:win32'] = `set NODE_ENV=test& ${testFramework} ${testDirectory}/"{,/**/}*${testFilesExtension}"`;
    scripts['test:watch'] = 'npm test -- -w';
    scripts['test:coverage'] = 'nyc npm test';
    scripts['prerelease'] = 'npm run test:coverage';
  }

  if(description && packageJson.description.trim().length === 0) {
    packageJson.description = description;
  }

  if(license && packageJson.license.trim().length === 0) {
    packageJson.license = license;
  }

  packageJson.scripts = scripts;
  packageJson.config = config;

  await writePackage(packageJson);
}

function writeIgnoreFiles() {
  const destination = `${cwd}/.gitignore`;
  const tpl = read.sync(`${rootDir}${SEP}templates${SEP}.gitignore.tpl`, {
    encoding: 'utf8'
  });
  const output = tpl;

  log('Creting .gitignore file...');
  write.sync(destination, output);
  log('.gitignore file created');
}

function writeReadMe(projectName, opts) {
  const destination = `${cwd}/README.md`;
  const tpl = read.sync(`${rootDir}${SEP}templates${SEP}README.tpl`, {
    encoding: 'utf8'
  });
  const output = replaceTemplateTags(tpl,
    [
      'project-name',
      'description',
      'license-badge',
      'conventional-commits-badge',
      'js-style-guide-badge'
    ],
    [
      projectName,
      opts.description,
      badges['license-mit']
        .replace(/\{gh-username\}/g, opts.github.username)
        .replace(/\{project-name\}/g, opts.github.projectPath),
      badges['conventional-commits'],
      badges['js-style-guide']
    ]
  );

  write.sync(destination, output);
}

function writeCoverageConfig(srcDir, testFilesExtension) {
  const str = `
  {
    "all": true,
    "check-coverage": true,
    "include": [
      "${srcDir}/**/*.js"
    ],
    "exclude": [
      "**/*${testFilesExtension}"
    ],
    "reporter": [
      "json",
      "lcov",
      "text-summary",
      "clover"
    ],
    "branches": 100,
    "lines": 100,
    "functions": 100,
    "statements": 100
  }
  `;

  write.sync(`${cwd}${SEP}.nycrc.json`, str);
}

function generateLicense(license, options) {
  const year = options.year || currentYear;
  const owner = options.owner;
  const licenseKey = getKeyByValue(licenses, license);

  const liceBin = `${rootDir}${SEP}node_modules${SEP}.bin${SEP}lice`;

  cp.execSync(`${liceBin} -g -l ${licenseKey} -n "${cwd}${SEP}LICENSE.md" -u "${owner}" -y "${year}"`, {
    encoding : 'utf8'
  });

  if(fs.existsSync(`${cwd}${SEP}LICENSE`)) {
    fs.renameSync(`${cwd}${SEP}LICENSE`, `${cwd}${SEP}LICENSE.md`);
  }
}

function createSampleTests(testFramework, srcDir, testDir, testFilesExtension) {
  log('Creating sample test files...');
  let sampleTestSrc = '';
  const isFreshSrcDir = emptyDir.sync(`${cwd}${SEP}${srcDir}`, (filepath) => {
    return !/(Thumbs\.db|\.DS_Store)$/i.test(filepath);
  });

  if(testFramework === 'jasmine') {
    sampleTestSrc = `
    const jasmine = require('jasmine');
    const hello = require('../${srcDir}/index.example.js');

    describe('Basic test', function() {
      it('should pass', function() {
        expect(hello()).toEqual('hello world');
      });
    });
    `;
  } else {
    sampleTestSrc = `
    const chai = require('chai');
    const hello = require('../${srcDir}/index.example.js');
    const { expect } = chai;

    describe('Basic test', function() {
      it('should pass', function() {
        expect(hello()).to.equal('hello world');
      });
    });
    `;
  }

  write.sync(
    `${cwd}${SEP}${testDir}${SEP}example${testFilesExtension}`, sampleTestSrc);

  if(isFreshSrcDir) {
    const sampleSrc = `
    module.exports = function greeting() {
      return 'hello world';
    }
    `;

    write.sync(
      `${cwd}${SEP}${srcDir}${SEP}index.example.js`, sampleSrc);
  }

  cp.execSync('npm run lint:fix', { encoding: 'utf-8' });
  log('Sample test files created');
}

// credits: https://stackoverflow.com/a/28191966/1743192
function getKeyByValue(object, value) {
  return Object.keys(object).find(key => object[key] === value);
}

/**
 * Executes a shell command and return it as a Promise.
 * @param cmd {string}
 * @return {Promise<string>}
 *
 * @credits: https://ali-dev.medium.com/how-to-use-promise-with-exec-in-node-js-a39c4d7bbf77
 */
function execShellCommand(cmd, options) {
  //const exec = require('child_process').exec;
  return new Promise((resolve, reject) => {
    cp.exec(cmd, options, (error, stdout, stderr) => {
      if (error) {
        console.warn(error);
        reject(error);
      }

      resolve(stdout? stdout : stderr);
    });
  });
}

function replaceTemplateTags(source, tagNames, replacements) {
  return tagNames.reduce((src, tagName, index) => {
    return replaceTemplateTag(src, tagName, replacements[index]);
  }, source);
}

function replaceTemplateTag(source, tagName, replacement) {
  return source.replace(
    new RegExp(`\\{\\s*${tagName}\\s*\\}`, 'gmi'), replacement
  );
}

function requireWithoutCache(module) {
  return requireUncached(module, require);
}
