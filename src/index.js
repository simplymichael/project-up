const fs = require('fs');
const path = require('path');
const util = require('util');
const cp = require('child_process');
const write = require('write');
const read = require('read-file');
const inquirer = require('inquirer');
const writePackage = require('write-pkg');
const badges = require('../badges');
const licenses = require('../licenses');
const currentYear = new Date().getFullYear();
const rootDir = path.resolve(__dirname, '..');
const log = console.log;

module.exports = {
  setup
};


/**
 * @param opts {object} with members:
 *   - directory {string} the project directory name
 */
async function setup(projectName, opts) {
  const cwd = process.cwd();
  const gitInitialized = fs.existsSync(`${cwd}/.git`);
  const npmInitialized = fs.existsSync(`${cwd}/package.json`);
  let dependencies = [];
  let devDependencies = [
    'chai',
    'commitizen',
    'cz-conventional-changelog',
    'ghooks',
    'mocha',
    'nyc',
    'run-script-os',
    'standard-version'
  ];
  const questions = [
    {
      type: 'input',
      name: 'description',
      message: 'Project description:',
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
        return answers['name'];
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
      name: 'create-test-directory',
      message: 'Create test directory:',
      choices: ['yes', 'no', 'already have']
    },
    {
      type: 'input',
      name: 'test-directory',
      message: 'Specify your test directory:',
      default: '_tests',
      when: function(answers) {
        const createTestDir = answers['create-test-directory'];

        return createTestDir === 'yes' || createTestDir === 'already have';
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
        log(util.inspect(answers));

        return 'These are your settings is this ok? [Y/n]:';
      }
    }
  ];
  const answers = await ask(questions);
  const srcDir = answers['src-directory'];
  const testDir = answers['test-directory'];
  const splitRegex = /\s+,?\s+/;

  if(answers['proceed'].toLowerCase() === 'n') {
    process.exit('0');
  }

  if(answers['dependencies']) {
    const userDeps = answers['dependencies'].split(splitRegex);

    dependencies = dependencies.concat(userDeps);
  }

  if(answers['dev-dependencies']) {
    const userDevDeps = answers['dev-dependencies'].split(splitRegex);

    devDependencies = devDependencies.concat(userDevDeps);
  }

  devDependencies.push(answers['linter'].toLowerCase());

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

  if(srcDir && !fs.existsSync(`${cwd}/${srcDir}`)) {
    log('Creating source directory...');
    fs.mkdirSync(`${cwd}/${srcDir}`);
    log(`Source directory "${srcDir}" created`);
  }

  if(testDir && !fs.existsSync(`${cwd}/${testDir}`)) {
    log('Creating test directory...');
    fs.mkdirSync(`${cwd}/${testDir}`);
    log(`Test directory "${testDir}" created`);
  }

  log('Installing dependencies... This might take a while...');
  await install(dependencies, devDependencies);
  log('Dependencies installed');

  log('Updating package.json...');
  await writePackageJson({
    description: answers['description'],
    license: getKeyByValue(licenses, answers['license']).toUpperCase(),
    linter: answers['linter'].toLowerCase(),
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

  cp.execSync(
    `git init && git config user.name ${username} && git config user.email ${email}`,
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
    //stdio: 'inherit',
    encoding : 'utf8'
  };

  if(Array.isArray(deps) && deps.length > 0) {
    //cp.execSync(`npm i -S ${deps.join(' ')}`, processOpts);

    await Promise.all(deps.map(dep => {
      return execShellCommand(`npm i -S ${dep}`, processOpts);
    }));
  }

  if(Array.isArray(devDeps) && devDeps.length > 0) {
    //cp.execSync(`npm i -D ${devDeps.join(' ')}`, processOpts);

    await Promise.all(devDeps.map(dep => {
      return execShellCommand(`npm i -D ${dep}`, processOpts);
    }));
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
    testDirectory,
    sourceDirectory
  } = opts;
  const packageJson = require(`${process.cwd()}/package.json`);
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
    scripts['test:nix'] = `NODE_ENV=test mocha ${testDirectory}/"{,/**/}*.test.js"`;
    scripts['test:win32'] = `set NODE_ENV=test& mocha ${testDirectory}/"{,/**/}*.test.js"`;
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

function writeReadMe(projectName, opts) {
  const cwd = process.cwd();
  const destination = `${cwd}/README.md`;
  const tpl = read.sync(`${rootDir}${path.sep}templates${path.sep}README.tpl`, {
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

function generateLicense(license, options) {
  const year = options.year || currentYear;
  const owner = options.owner;
  const licenseKey = getKeyByValue(licenses, license);

  const cwd = process.cwd();
  const liceBin = `${rootDir}${path.sep}node_modules${path.sep}.bin${path.sep}lice`;

  cp.execSync(`${liceBin} -g -l ${licenseKey} -n "${cwd}${path.sep}LICENSE.md" -u "${owner}" -y "${year}"`, {
    encoding : 'utf8'
  });
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
