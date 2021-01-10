const fs = require('fs');
const path = require('path');
const util = require('util');
const cp = require('child_process');
const ora = require('ora');
const kleur = require('kleur');
const write = require('write');
const read = require('read-file');
const inquirer = require('inquirer');
const emptyDir = require('empty-dir');
const writePackage = require('write-pkg');
const emailValidator = require('email-validator');
const requireUncached = require('require-without-cache');
const i18n = require('./i18n');
const badges = require('./badges');
const licenses = require('./licenses');
const SEP = path.sep;
const { __: translate } = i18n;
const currentYear = new Date().getFullYear();
const rootDir = path.resolve(__dirname, '..');
const templatesDir = `${rootDir}${SEP}src${SEP}templates`;
const log = console.log;
const marker = {
  error: (msg) => coloredMsg(msg, 'red'),
  info: (msg) => coloredMsg(msg, 'cyan'),
  normal: (msg) => coloredMsg(msg),
  success: (msg) => coloredMsg(msg, 'green'),
  warning: (msg) => coloredMsg(msg, 'yellow'),
};

let cwd;
let processOpts = {
  encoding: 'utf-8'
};

module.exports = {
  setup
};


/**
 * @param opts {object} with members:
 *   - directory {string} the project directory name
 *   - locale {string}
 *   - verbose {boolean} true displays verbose output
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
  const { directory: projectDir, locale, verbose } = opts;
  const gitInitialized = fileExists(`${cwd}/.git`);
  const npmInitialized = fileExists(`${cwd}/package.json`);

  i18n.setLocale(locale || 'en');

  if(verbose) {
    processOpts.stdio = 'inherit';
  }

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
      message: `${translate('Project description')}:`,
      default: projectDesc
    },
    {
      type: 'input',
      name: 'name',
      message: `${translate('Your name')}:`,
      when: function() {
        return !gitInitialized;
      },
      validate: function(input) {
        if(input.length === 0) {
          return `${translate('Your name')}:`;
        }

        return true;
      }
    },
    {
      type: 'input',
      name: 'gh-username',
      message: `${translate('Github username')}:`,
      validate: function(input) {
        if(input.length === 0) {
          return `${translate('Github username')}:`;
        }

        return true;
      }
    },
    {
      type: 'input',
      name: 'gh-email',
      message: `${translate('Github email')}:`,
      when: function() {
        return !gitInitialized;
      },
      validate: function(input) {
        if(!emailValidator.validate(input)) {
          return `${translate('Enter a valid email')}:`;
        }

        return true;
      }
    },
    {
      type: 'input',
      name: 'gh-url',
      message: `${translate('Project URL')}:`,
      default: function(answers) {
        return `https://github.com/${answers['gh-username']}/${projectDir}.git`;
      }
    },
    {
      type: 'list',
      name: 'license',
      message: `${translate('License')}:`,
      choices: [translate('Unlicensed')].concat(Object.values(licenses)),
      default: licenses['mit'],
      loop: false
    },
    {
      type: 'input',
      name: 'license-owner',
      message: `${translate('License Owner')}:`,
      default: function(answers) {
        return gitInitialized ? ownerName : answers['name'];
      },
      when: function(answers) {
        return answers['license'] !== translate('Unlicensed');
      },
      validate: function(input) {
        if(input.length === 0) {
          return `${translate('License Owner')}:`;
        }

        return true;
      }
    },
    {
      type: 'input',
      name: 'license-year',
      message: `${translate('License Year')}:`,
      default: currentYear,
      when: function(answers) {
        return answers['license'] !== translate('Unlicensed');
      },
      validate: function(input) {
        if(input.length === 0) {
          return `${translate('License year')}:`;
        }

        return true;
      }
    },
    {
      type: 'list',
      name: 'create-src-directory',
      message: `${translate('Create source directory')}:`,
      choices: [
        translate('Yes'),
        translate('No'),
        translate('Already have')
      ]
    },
    {
      type: 'input',
      name: 'src-directory',
      message: `${translate('Specify source directory')}:`,
      default: 'src',
      when: function(answers) {
        const createSrcDir = answers['create-src-directory'];

        return createSrcDir === translate('Yes') ||
          createSrcDir === translate('Already have');
      },
      validate: function(input) {
        if(input.length === 0) {
          return `${translate('Specify source directory')}:`;
        }

        return true;
      }
    },
    {
      type: 'list',
      name: 'test-framework',
      message: `${translate('Choose test framework')}:`,
      choices: ['Jasmine', 'Mocha'],
      default: 'Mocha'
    },
    {
      type: 'list',
      name: 'create-test-directory',
      message: `${translate('Create test directory')}:`,
      choices: [
        translate('Yes'),
        translate('No'),
        translate('Already have')
      ]
    },
    {
      type: 'input',
      name: 'test-directory',
      message: `${translate('Specify test directory')}:`,
      default: function(answers) {
        return answers['test-framework'].toLowerCase() === 'jasmine'
          ? 'spec'
          : 'tests';
      },
      when: function(answers) {
        const createTestDir = answers['create-test-directory'];

        return createTestDir === translate('Yes') ||
          createTestDir === translate('Already have');
      },
      validate: function(input) {
        if(input.length === 0) {
          return `${translate('Specify test directory')}:`;
        }

        return true;
      }
    },
    {
      type: 'list',
      name: 'test-files-extension',
      message: `${translate('Test files extension')}:`,
      choices: ['spec.js', '.test.js', translate('Other')],
      default: function(answers) {
        return answers['test-framework'].toLowerCase() === 'jasmine'
          ? 'spec.js'
          : '.test.js';
      }
    },
    {
      type: 'input',
      name: 'custom-test-files-extension',
      message: `${translate('Other test files extension')}:`,
      when: function(answers) {
        return answers['test-files-extension'] === translate('Other');
      },
      validate: function(input) {
        if(input.length === 0) {
          return `${translate('Other test files extension')}:`;
        }

        return true;
      }
    },
    {
      type: 'list',
      name: 'linter',
      message: translate('Linter'),
      choices: ['ESLint', 'Standard', translate('None')]
    },
    {
      type: 'input',
      name: 'dependencies',
      message: `${translate('Specify dependencies')}:`
    },
    {
      type: 'input',
      name: 'dev-dependencies',
      message: `${translate('Specify dev dependencies')}:`
    },
    {
      type: 'input',
      name: 'proceed',
      message: function(answers) {
        const settings = {
          [translate('Project')]: {
            [translate('Project name')]: projectName,
            [translate('Project directory')]: projectDir,
            [translate('Project description')]: answers['description'],
            [translate('Project owner')]: answers['name'] || ownerName
          },
          [translate('GitHub')]: {
            [translate('GitHub username')]: answers['gh-username'],
            [translate('GitHub email')]: answers['gh-email'] || ownerEmail,
            [translate('GitHub url')]: answers['gh-url']
          },
          [translate('License')]: {
            [translate('LName')]: answers['license'],
          },
          [translate('Test')]: {
            [translate('Test framework')]: answers['test-framework'],
            [translate('Test extension')]: answers['test-files-extension'].toLowerCase() === 'other'
              ? answers['custom-test-files-extension']
              : answers['test-files-extension']
          },
          [translate('Linter')]: answers['linter'],
          [translate('Dev dependencies')]: devDependencies
            .concat(answers['test-framework'].toLowerCase() === 'jasmine'
              ? ['jasmine'] : ['mocha', 'chai'])
            .concat([answers['linter'].toLowerCase()])
            .concat(answers['dev-dependencies'].split(splitRegex))
            .filter(el => el.length > 0)
            .sort(),
        };

        if(answers['dependencies']) {
          settings[translate('Dependencies')] = answers['dependencies'].split(splitRegex);
        }

        if(answers['license'] !== translate('Unlicensed')) {
          settings[translate('License')][translate('LOwner')] = answers['license-owner'];
          settings[translate('License')][translate('LYear')] = answers['license-year'];
        }

        if(answers['src-directory']) {
          settings[translate('Source directory')] = answers['src-directory'];
        }

        if(answers['test-directory']) {
          settings[translate('Test')][translate('Test directory')] = answers['test-directory'];
        }

        log(marker.info(`${translate('Review selection')}`));
        log(marker.normal(util.inspect(settings)));

        return `${translate('Proceed?')} [Y/n]:`;
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
    const gitSpinner = ora(marker.info(translate(
      'Initializing git'))).start();
    gitInit({
      github: {
        username: answers['name'],
        email: answers['gh-email']
      },
    });
    gitSpinner.succeed(marker.success(translate(
      'Initialized empty git repository')));
  } else {
    log(marker.info(translate(
      'The specified directory is a git repository... skipping "git init"')));
  }

  if(!npmInitialized) {
    const npmSpinner = ora(marker.info(translate(
      'Creating package.json'))).start();
    await npmInit({
      description: answers['description'],
      license: getKeyByValue(licenses, answers['license']).toUpperCase(),
      githubUrl: answers['gh-url']
    });
    npmSpinner.succeed(marker.success(translate('package.json created')));
  } else {
    log(marker.info(translate(
      'The specified directory already contains a package.json file... skipping "npm init"'
    )));
  }

  if(srcDir && !fileExists(`${cwd}${SEP}${srcDir}`)) {
    const sdSpinner = ora(marker.info(translate(
      'Creating source directory'))).start();
    fs.mkdirSync(`${cwd}${SEP}${srcDir}`);
    sdSpinner.succeed(marker.success(translate('Source directory created')));
  }

  if(testDir && !fileExists(`${cwd}${SEP}${testDir}`)) {
    const tdSpinner = ora(marker.info(translate(
      'Creating test directory'))).start();
    fs.mkdirSync(`${cwd}${SEP}${testDir}`);
    tdSpinner.succeed(marker.success(translate('Test directory created')));
  }

  await install(dependencies, devDependencies);

  const pjSpinner = ora(marker.info(translate(
    'Updating package.json'))).start();
  await writePackageJson({
    description: answers['description'],
    license: getKeyByValue(licenses, answers['license']).toUpperCase(),
    githubUrl: answers['gh-url'],
    testFramework: testFramework,
    testFilesExtension: testFilesExtension,
    linter: linter,
    sourceDirectory: srcDir,
    testDirectory: testDir,
  });
  pjSpinner.succeed(marker.success(translate('package.json updated')));

  const readmeSpinner = ora(marker.info(translate(
    'Creating README file'))).start();
  await writeReadMe(projectName, {
    description: answers['description'],
    github: {
      username: answers['gh-username'],
      projectPath: opts.directory,
    },
    linter: linter
  });
  readmeSpinner.succeed(marker.success(translate('README file created')));

  if(answers['license'] !== translate('Unlicensed')) {
    const lcSpinner = ora(marker.info(translate('Generating license'))).start();
    generateLicense(answers['license'], {
      owner: answers['license-owner'],
      year: answers['license-year']
    });
    lcSpinner.succeed(marker.success(translate('License generated')));
  }

  const esLintExists = fileExists(`${cwd}${SEP}.eslintrc.js`)
    || fileExists(`${cwd}${SEP}.eslintrc.json`)
    || fileExists(`${cwd}${SEP}.eslintrc.yml`);

  const isFreshTestDir = emptyDir.sync(`${cwd}${SEP}${testDir}`, (filepath) => {
    return !/(Thumbs\.db|\.DS_Store)$/i.test(filepath);
  });

  if(linter === 'eslint' && !esLintExists) {
    log(marker.info(translate('You are almost done')));
    log(marker.info(translate('Take a moment to setup ESLint')));
    const cmd = `${cwd}${SEP}node_modules${SEP}.bin${SEP}eslint --init`;

    cp.execSync(cmd, {
      stdio: 'inherit',
      encoding: 'utf-8'
    });
  }

  if(isFreshTestDir) {
    const testSpinner = ora(marker.info(translate(
      'Setting up tests'))).start();
    log();
    if(testFramework === 'jasmine') {
      cp.execSync('npx jasmine init', processOpts);
    }

    createSampleTests(testFramework, srcDir, testDir, testFilesExtension);
    testSpinner.succeed(marker.success(translate('Tests setup complete')));
  }

  if(!fileExists(`${cwd}${SEP}.nycrc.json`)) {
    const nycSpinner = ora(marker.info(
      translate('Creating') + ' .nycrc.json...')).start();
    log();
    writeCoverageConfig(srcDir, testFilesExtension);
    nycSpinner.succeed(marker.success('.nycrc.json ' + translate('created')));
  }

  log(marker.success(translate('All set')));
  log(marker.info(`
    ${translate('Run tests')} ${kleur.yellow('npm test')}
    ${translate('Run coverage')} ${kleur.yellow('npm run test:coverage')}
    ${translate('Commit')} ${kleur.yellow('npm run commit')}
    ${translate('Fix linting errors')} ${kleur.yellow('npm run lint:fix')}
    ${translate('First release')} ${kleur.yellow('npm run first-release')}
    ${translate('Subsequent releases')} ${kleur.yellow('npm run release')}
    ${translate('Release dry-run')} ${kleur.yellow('npm run release:dry-run')}
  `));
}

function ask(questions) {
  return inquirer
    .prompt(questions)
    .then(answers => answers)
    .catch(error => {
      if(error.isTtyError) {
        log(marker.warn(translate(
          'Prompt cannot be rendered in the current environment')));
      } else {
        log(marker.error(translate('Something has gone wrong')));
      }
    });
}

function gitInit(opts) {
  const { github: { username, email } } = opts;

  writeIgnoreFiles();

  cp.execSync(
    `git init && git config user.name "${username}" && git config user.email ${email}`,
    processOpts
  );
}

async function npmInit(opts) {
  cp.execSync('npm init -y');

  const { description, license, githubUrl } = opts;
  const packageJson = requireWithoutCache(`${cwd}${SEP}package.json`);

  if(description && typeof description === 'string') {
    packageJson.description = description;
  }

  if(license && typeof license === 'string') {
    packageJson.license = license;
  }

  if(githubUrl) {
    const ghUrl = githubUrl.endsWith('.git')
      ? githubUrl.slice(0, -4)
      : githubUrl;

    packageJson.repository = {
      'type': 'git',
      'url': `git+${ghUrl}.git`
    };

    packageJson.bugs = {
      'url': `${ghUrl}/issues`
    };

    packageJson.homepage = `${ghUrl}#readme`;
  }

  await writePackage(packageJson);
}

/**
 * @param deps {array} optional, the dependencies
 * @param devDeps {array} optional, the dev dependencies
 */
async function install(deps, devDeps) {
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
    deps.sort();

    const depsSpinner = ora(marker.info(
      translate('Installing dependencies') + ' ' +
      translate('This might take a while')
    )).start();
    log(); // Create a line space between log messages
    for(let i = 0; i < deps.length; i++) {
      const dep = deps[i];
      let currSpinner = ora(marker.info(
        translate('Installing') + ' ' + dep)).start();
      log();
      cp.execSync(`npm i -S ${dep}`, processOpts);
      currSpinner.succeed(marker.success(dep + ' ' + translate('installed')));
    }
    depsSpinner.succeed(marker.success(
      translate('Dependencies installed')));
  }

  if(Array.isArray(devDeps) && devDeps.length > 0) {
    devDeps.sort();

    const devDepsSpinner = ora(marker.info(
      translate('Installing dev dependencies') + ' ' +
      translate('This might take a while')
    )).start();
    log(); // Create a line space between log messages
    for(let i = 0; i < devDeps.length; i++) {
      const dep = devDeps[i];
      let currSpinner = ora(marker.info(
        translate('Installing') + ' ' + dep )).start();
      log();
      cp.execSync(`npm i -D ${dep}`, processOpts);
      currSpinner.succeed(marker.success(dep + ' ' + translate('installed')));
    }
    devDepsSpinner.succeed(marker.success(
      translate('Dev dependencies installed')));

    return true;
  }
}

/**
 * @param opts {object} with members:
 *   - description {string}
 *   - license {string}
 *   - githubUrl {string}
 *   - linter {string} eslint | markdown
 *   - testFramework {string}
 *   - testFilesExtension {string}
 *   - sourceDirectory {string} source files directory
 *   - testDirectory {string} directory holding test files
 */
async function writePackageJson(opts) {
  const {
    description,
    license,
    githubUrl,
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

  if(githubUrl) {
    const ghUrl = githubUrl.endsWith('.git')
      ? githubUrl.slice(0, -4)
      : githubUrl;

    if(!packageJson.repository) {
      packageJson.repository = {
        'type': 'git',
        'url': `git+${ghUrl}.git`
      };
    }

    if(!packageJson.bugs) {
      packageJson.bugs = {
        'url': `${ghUrl}/issues`
      };
    }

    if(!packageJson.homepage) {
      packageJson.homepage = `${ghUrl}#readme`;
    }
  }

  packageJson.scripts = scripts;
  packageJson.config = config;

  await writePackage(packageJson);
}

function writeIgnoreFiles() {
  const destination = `${cwd}/.gitignore`;
  const tpl = read.sync(`${templatesDir}${SEP}.gitignore.tpl`, {
    encoding: 'utf8'
  });
  const output = tpl;

  const giSpinner = ora(marker.info(
    translate('Creating') + ' .gitignore' +
    translate('file') + '...'
  )).start();
  write.sync(destination, output);
  giSpinner.succeed(marker.success(
    '.gitignore ' + translate('file') + translate('created')));
}

function writeReadMe(projectName, opts) {
  const destination = `${cwd}/README.md`;
  const tpl = read.sync(`${templatesDir}${SEP}README.tpl`, {
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
      badges['license']
        .replace(/\{gh-username\}/g, opts.github.username)
        .replace(/\{project-name\}/g, opts.github.projectPath),
      badges['conventional-commits'],
      (opts.linter === 'standard' ? badges['standard'] : '')
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

  if(fileExists(`${cwd}${SEP}LICENSE`)) {
    fs.renameSync(`${cwd}${SEP}LICENSE`, `${cwd}${SEP}LICENSE.md`);
  }
}

function createSampleTests(testFramework, srcDir, testDir, testFilesExtension) {
  const stSpinner = ora(marker.info(translate(
    'Creating sample test files'))).start();
  let sampleTestSrc = '';
  const isFreshSrcDir = emptyDir.sync(`${cwd}${SEP}${srcDir}`, (filepath) => {
    return !/(Thumbs\.db|\.DS_Store)$/i.test(filepath);
  });

  if(testFramework === 'jasmine') {
    sampleTestSrc = `
    const jasmine = require('jasmine');
    const hello = require('../${srcDir}/index.example.js');

    describe('Basic test', function() {
      it(${translate('Should pass')}, function() {
        expect(hello()).toEqual('${translate('Hello world')}');
      });
    });
    `;
  } else {
    sampleTestSrc = `
    const chai = require('chai');
    const hello = require('../${srcDir}/index.example.js');
    const { expect } = chai;

    describe('Basic test', function() {
      it(${translate('Should pass')}, function() {
        expect(hello()).to.equal('${translate('Hello world')}');
      });
    });
    `;
  }

  write.sync(
    `${cwd}${SEP}${testDir}${SEP}example${testFilesExtension}`, sampleTestSrc);

  if(isFreshSrcDir) {
    const sampleSrc = `
    module.exports = function greeting() {
      return '${translate('Hello world')}';
    }
    `;

    write.sync(
      `${cwd}${SEP}${srcDir}${SEP}index.example.js`, sampleSrc);
  }

  try {
    cp.execSync('npm run lint:fix', processOpts);
  } catch(err) {
    log(marker.warn(translate(
      'There appears to be some linting errors. Run "npm run lint" to check them'
    )));
  }

  stSpinner.succeed(marker.success(translate('Sample test files created')));
}

/** Helper functions */

function coloredMsg(msg, color) {
  return color ? kleur[color](msg) : msg;
}

function getKeyByValue(object, value) {
  return Object.keys(object).find(key => object[key] === value);
}

/**
 * Executes a shell command and return it as a Promise.
 * @param cmd {string} required
 * @param options {object} optional
 * @return {Promise<string>}
 */
function execShellCommand(cmd, options) {
  return new Promise((resolve, reject) => {
    cp.exec(cmd, options, (error, stdout, stderr) => {
      if (error) {
        log(marker.error(error));
        reject(error);
      }

      resolve(stdout ? stdout : stderr);
    });
  });
}

function fileExists(file) {
  return fs.existsSync(file);
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
