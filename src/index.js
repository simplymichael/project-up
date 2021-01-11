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
const translator = require('./translator');
const badges = require('./badges');
const licenses = require('./licenses');
const SEP = path.sep;
const { setLocale, translate } = translator;
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

  setLocale(locale || 'en');

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
      message: `${translate('questions.projectDesc')}:`,
      default: projectDesc
    },
    {
      type: 'input',
      name: 'name',
      message: `${translate('questions.github.configName')}:`,
      when: function() {
        return !gitInitialized;
      },
      validate: function(input) {
        if(input.length === 0) {
          return `${translate('questions.github.configName')}:`;
        }

        return true;
      }
    },
    {
      type: 'input',
      name: 'gh-username',
      message: `${translate('questions.github.username')}:`,
      validate: function(input) {
        if(input.length === 0) {
          return `${translate('questions.github.username')}:`;
        }

        return true;
      }
    },
    {
      type: 'input',
      name: 'gh-email',
      message: `${translate('questions.github.email')}:`,
      when: function() {
        return !gitInitialized;
      },
      validate: function(input) {
        if(!emailValidator.validate(input)) {
          return `${translate('questions.github.validEmailPrompt')}:`;
        }

        return true;
      }
    },
    {
      type: 'input',
      name: 'gh-url',
      message: `${translate('questions.github.url')}:`,
      default: function(answers) {
        return `https://github.com/${answers['gh-username']}/${projectDir}.git`;
      }
    },
    {
      type: 'list',
      name: 'license',
      message: `${translate('questions.license.titler')}:`,
      choices: [translate('answers.unlicensed')].concat(Object.values(licenses)),
      default: licenses['mit'],
      loop: false
    },
    {
      type: 'input',
      name: 'license-owner',
      message: `${translate('questions.license.owner')}:`,
      default: function(answers) {
        return gitInitialized ? ownerName : answers['name'];
      },
      when: function(answers) {
        return answers['license'] !== translate('answers.unlicensed');
      },
      validate: function(input) {
        if(input.length === 0) {
          return `${translate('questions.license.owner')}:`;
        }

        return true;
      }
    },
    {
      type: 'input',
      name: 'license-year',
      message: `${translate('questions.license.year')}:`,
      default: currentYear,
      when: function(answers) {
        return answers['license'] !== translate('answers.unlicensed');
      },
      validate: function(input) {
        if(input.length === 0) {
          return `${translate('questions.license.year')}:`;
        }

        return true;
      }
    },
    {
      type: 'list',
      name: 'create-src-directory',
      message: `${translate('questions.createSrcDir')}:`,
      choices: [
        translate('answers.yes'),
        translate('answers.no'),
        translate('answers.alreadyHave')
      ]
    },
    {
      type: 'input',
      name: 'src-directory',
      message: `${translate('questions.specifySrcDir')}:`,
      default: 'src',
      when: function(answers) {
        const createSrcDir = answers['create-src-directory'];

        return createSrcDir === translate('answers.yes') ||
          createSrcDir === translate('answers.alreadyHave');
      },
      validate: function(input) {
        if(input.length === 0) {
          return `${translate('questions.specifySrcDir')}:`;
        }

        return true;
      }
    },
    {
      type: 'list',
      name: 'test-framework',
      message: `${translate('questions.tests.framework')}:`,
      choices: ['Jasmine', 'Mocha'],
      default: 'Mocha'
    },
    {
      type: 'list',
      name: 'create-test-directory',
      message: `${translate('questions.tests.createDir')}:`,
      choices: [
        translate('answers.yes'),
        translate('answers.no'),
        translate('answers.alreadyHave')
      ]
    },
    {
      type: 'input',
      name: 'test-directory',
      message: `${translate('questions.tests.specifyDir')}:`,
      default: function(answers) {
        return answers['test-framework'].toLowerCase() === 'jasmine'
          ? 'spec'
          : 'tests';
      },
      when: function(answers) {
        const createTestDir = answers['create-test-directory'];

        return createTestDir === translate('answers.yes') ||
          createTestDir === translate('answers.alreadyHave');
      },
      validate: function(input) {
        if(input.length === 0) {
          return `${translate('questions.tests.specifyDir')}:`;
        }

        return true;
      }
    },
    {
      type: 'list',
      name: 'test-files-extension',
      message: `${translate('questions.tests.filesExt')}:`,
      choices: ['spec.js', '.test.js', translate('answers.other')],
      default: function(answers) {
        return answers['test-framework'].toLowerCase() === 'jasmine'
          ? 'spec.js'
          : '.test.js';
      }
    },
    {
      type: 'input',
      name: 'custom-test-files-extension',
      message: `${translate('questions.tests.unlistedFilesExt')}:`,
      when: function(answers) {
        return answers['test-files-extension'] === translate('answers.other');
      },
      validate: function(input) {
        if(input.length === 0) {
          return `${translate('questions.tests.unlistedFilesExt')}:`;
        }

        return true;
      }
    },
    {
      type: 'list',
      name: 'linter',
      message: translate('questions.linter'),
      choices: ['ESLint', 'Standard', translate('answers.none')]
    },
    {
      type: 'input',
      name: 'dependencies',
      message: `${translate('questions.dependencies')}:`
    },
    {
      type: 'input',
      name: 'dev-dependencies',
      message: `${translate('questions.devDependencies')}:`
    },
    {
      type: 'input',
      name: 'proceed',
      message: function(answers) {
        const settings = {
          [translate('questions.choices.project.header')]: {
            [translate('questions.choices.project.name')]: projectName,
            [translate('questions.choices.project.directory')]: projectDir,
            [translate('questions.choices.project.description')]: answers['description'],
            [translate('questions.choices.project.owner')]: answers['name'] || ownerName
          },
          [translate('questions.choices.github.header')]: {
            [translate('questions.choices.github.username')]: answers['gh-username'],
            [translate('questions.choices.github.email')]: answers['gh-email'] || ownerEmail,
            [translate('questions.choices.github.url')]: answers['gh-url']
          },
          [translate('questions.choices.license.header')]: {
            [translate('questions.choices.license.name')]: answers['license'],
          },
          [translate('questions.choices.tests.header')]: {
            [translate('questions.choices.tests.framework')]: answers['test-framework'],
            [translate('questions.choices.tests.extension')]: answers['test-files-extension'] === translate('answers.other')
              ? answers['custom-test-files-extension']
              : answers['test-files-extension']
          },
          [translate('questions.choices.linter')]: answers['linter'],
          [translate('questions.choices.devDependencies')]: devDependencies
            .concat(answers['test-framework'].toLowerCase() === 'jasmine'
              ? ['jasmine'] : ['mocha', 'chai'])
            .concat([answers['linter'].toLowerCase()])
            .concat(answers['dev-dependencies'].split(splitRegex))
            .filter(el => el.length > 0)
            .sort(),
        };

        if(answers['dependencies']) {
          settings[translate('questions.choices.dependencies')] = answers['dependencies'].split(splitRegex);
        }

        if(answers['license'] !== translate('answers.unlicensed')) {
          settings[translate('questions.choices.license.header')][translate('questions.choices.license.owner')] = answers['license-owner'];
          settings[translate('questions.choices.license.header')][translate('questions.choices.license.year')] = answers['license-year'];
        }

        if(answers['src-directory']) {
          settings[translate('questions.choices.srcDir')] = answers['src-directory'];
        }

        if(answers['test-directory']) {
          settings[translate('questions.choices.tests.header')][translate('questions.choices.tests.directory')] = answers['test-directory'];
        }

        log();
        log(marker.info(`${translate('questions.choices.review')}:`));
        log(marker.normal(util.inspect(settings)));
        log();
        return `${translate('questions.choices.proceed')} [Y/n]:`;
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
      'setup.git.initializing'))).start();
    gitInit({
      github: {
        username: answers['name'],
        email: answers['gh-email']
      },
    });
    gitSpinner.succeed(marker.success(translate(
      'setup.git.initialized')));
  } else {
    log(marker.info(
      translate('setup.git.isRepo') + ' ' +
      translate('setup.git.isSkipping')
    ));
  }

  if(!npmInitialized) {
    const npmSpinner = ora(marker.info(
      translate('setup.npm.initializing'))).start();
    await npmInit({
      description: answers['description'],
      license: getKeyByValue(licenses, answers['license']).toUpperCase(),
      githubUrl: answers['gh-url']
    });
    npmSpinner.succeed(marker.success(translate('setup.npm.initialized')));
  } else {
    log(marker.info(
      translate('setup.npm.hasPackageJson') + ' ' +
      translate('setup.npm.isSkipping')
    ));
  }

  if(srcDir && !fileExists(`${cwd}${SEP}${srcDir}`)) {
    const sdSpinner = ora(marker.info(
      translate('setup.directories.creatingSrcDir'))).start();
    fs.mkdirSync(`${cwd}${SEP}${srcDir}`);
    sdSpinner.succeed(marker.success(
      translate('setup.directories.srcDirCreated')));
  }

  if(testDir && !fileExists(`${cwd}${SEP}${testDir}`)) {
    const tdSpinner = ora(marker.info(
      translate('setup.directories.creatingTestDir'))).start();
    fs.mkdirSync(`${cwd}${SEP}${testDir}`);
    tdSpinner.succeed(marker.success(
      translate('setup.directories.testDirCreated')));
  }

  await install(dependencies, devDependencies);

  const pjSpinner = ora(marker.info(translate('setup.npm.updating'))).start();
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
  pjSpinner.succeed(marker.success(translate('setup.npm.updated')));

  const readmeSpinner = ora(marker.info(
    translate('setup.files.creatingReadme'))).start();
  await writeReadMe(projectName, {
    description: answers['description'],
    github: {
      username: answers['gh-username'],
      projectPath: opts.directory,
    },
    linter: linter
  });
  readmeSpinner.succeed(marker.success(translate('setup.files.readmeCreated')));

  if(answers['license'] !== translate('answers.unlicensed')) {
    const lcSpinner = ora(marker.info(
      translate('setup.files.generatingLicense'))).start();
    generateLicense(answers['license'], {
      owner: answers['license-owner'],
      year: answers['license-year']
    });
    lcSpinner.succeed(marker.success(translate('setup.files.licenseGenerated')));
  }

  const esLintExists = fileExists(`${cwd}${SEP}.eslintrc.js`)
    || fileExists(`${cwd}${SEP}.eslintrc.json`)
    || fileExists(`${cwd}${SEP}.eslintrc.yml`);

  const isFreshTestDir = emptyDir.sync(`${cwd}${SEP}${testDir}`, (filepath) => {
    return !/(Thumbs\.db|\.DS_Store)$/i.test(filepath);
  });

  if(linter === 'eslint' && !esLintExists) {
    log(marker.info(translate('setup.finalize.almostDone')));
    log(marker.info(translate('setup.finalize.setupEslint')));
    const cmd = `${cwd}${SEP}node_modules${SEP}.bin${SEP}eslint --init`;

    cp.execSync(cmd, {
      stdio: 'inherit',
      encoding: 'utf-8'
    });
  }

  if(isFreshTestDir) {
    const testSpinner = ora(marker.info(translate('setup.tests.settingUp'))).start();
    log();
    if(testFramework === 'jasmine') {
      cp.execSync('npx jasmine init', processOpts);
    }

    createSampleTests(testFramework, srcDir, testDir, testFilesExtension);
    testSpinner.succeed(marker.success(translate('setup.tests.setupComplete')));
  }

  if(!fileExists(`${cwd}${SEP}.nycrc.json`)) {
    const nycSpinner = ora(marker.info(
      translate('setup.creating') + ' .nycrc.json...')).start();
    log();
    writeCoverageConfig(srcDir, testFilesExtension);
    nycSpinner.succeed(marker.success(
      '.nycrc.json ' + translate('setup.created')));
  }

  log(marker.success(translate('setup.finalize.allSet')));
  log(marker.info(`
    ${translate('setup.finalize.runTests')} ${kleur.yellow('npm test')}
    ${translate('setup.finalize.runCoverage')} ${kleur.yellow('npm run test:coverage')}
    ${translate('setup.finalize.commit')} ${kleur.yellow('npm run commit')}
    ${translate('setup.finalize.fixLintingErrors')} ${kleur.yellow('npm run lint:fix')}
    ${translate('setup.finalize.firstRelease')} ${kleur.yellow('npm run first-release')}
    ${translate('setup.finalize.subsequentRelease')} ${kleur.yellow('npm run release')}
    ${translate('setup.finalize.releaseDryRun')} ${kleur.yellow('npm run release:dry-run')}
  `));
}

function ask(questions) {
  return inquirer
    .prompt(questions)
    .then(answers => answers)
    .catch(error => {
      if(error.isTtyError) {
        log(marker.warn(translate('info.promptNotSupported')));
      } else {
        log(marker.error(translate('info.somethingWrong')));
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
      translate('setup.npm.installingDeps') + ' ' +
      translate('setup.delayedOp')
    )).start();
    log(); // Create a line space between log messages
    for(let i = 0; i < deps.length; i++) {
      const dep = deps[i];
      let currSpinner = ora(marker.info(
        translate('setup.installing') + ' ' + dep)).start();
      log();
      cp.execSync(`npm i -S ${dep}`, processOpts);
      currSpinner.succeed(marker.success(dep + ' ' + translate('setup.installed')));
    }
    depsSpinner.succeed(marker.success(
      translate('setup.npm.depsInstalled')));
  }

  if(Array.isArray(devDeps) && devDeps.length > 0) {
    devDeps.sort();

    const devDepsSpinner = ora(marker.info(
      translate('setup.npm.installingDevDeps') + ' ' +
      translate('setup.delayedOp')
    )).start();
    log(); // Create a line space between log messages
    for(let i = 0; i < devDeps.length; i++) {
      const dep = devDeps[i];
      let currSpinner = ora(marker.info(
        translate('setup.installing') + ' ' + dep )).start();
      log();
      cp.execSync(`npm i -D ${dep}`, processOpts);
      currSpinner.succeed(marker.success(dep + ' ' + translate('setup.installed')));
    }
    devDepsSpinner.succeed(marker.success(translate('setup.npm.devDepsInstalled')));

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
    translate('setup.git.creatingIgnoreFile'))).start();
  write.sync(destination, output);
  giSpinner.succeed(marker.success(translate('setup.git.ignoreFileCreated')));
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
  const stSpinner = ora(marker.info(
    translate('setup.tests.creatingSamples'))).start();
  let sampleTestSrc = '';
  const isFreshSrcDir = emptyDir.sync(`${cwd}${SEP}${srcDir}`, (filepath) => {
    return !/(Thumbs\.db|\.DS_Store)$/i.test(filepath);
  });

  if(testFramework === 'jasmine') {
    sampleTestSrc = `
    const jasmine = require('jasmine');
    const hello = require('../${srcDir}/index.example.js');

    describe('Basic test', function() {
      it('${translate('setup.tests.shouldPass')}', function() {
        expect(hello()).toEqual('${translate('setup.tests.helloWorld')}');
      });
    });
    `;
  } else {
    sampleTestSrc = `
    const chai = require('chai');
    const hello = require('../${srcDir}/index.example.js');
    const { expect } = chai;

    describe('Basic test', function() {
      it('${translate('setup.tests.shouldPass')}', function() {
        expect(hello()).to.equal('${translate('setup.tests.helloWorld')}');
      });
    });
    `;
  }

  write.sync(
    `${cwd}${SEP}${testDir}${SEP}example${testFilesExtension}`, sampleTestSrc);

  if(isFreshSrcDir) {
    const sampleSrc = `
    module.exports = function greeting() {
      return '${translate('setup.tests.helloWorld')}';
    }
    `;

    write.sync(
      `${cwd}${SEP}${srcDir}${SEP}index.example.js`, sampleSrc);
  }

  try {
    cp.execSync('npm run lint:fix', processOpts);
  } catch(err) {
    log(marker.warn(
      translate('setup.finalize.lintingErrors') +
      translate('setup.finalize.checkLintingErrors')
    ));
  }

  stSpinner.succeed(marker.success(translate('setup.tests.samplesCreated')));
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
