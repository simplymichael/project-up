# Project UP

[![GitHub License](https://img.shields.io/github/license/simplymichael/express-user-manager)](https://github.com/simplymichael/project-up/LICENSE.md)
[![Conventional commits](https://img.shields.io/badge/Conventional%20Commits-1.0.0-brightgreen.svg)](https://conventionalcommits.org)

Quickly setup a Node.js application by answering a few simple questions.

## Installation

Install as a global module: `npm install -g project-up`

## Usage

`project-up [OPTIONS] <PROJECT_NAME>`

If the project name is not given, it is derived from the name of the current working directory.

Remember to wrap in quotes if the project name is multi-word: `project-up "SIMPLE PROJECT"`.

## Options

- **-V**, **--version**: output version information
- **-v**, **--verbose**: enable verbose output, including output from child processes
- **-h**, **--help**: display command help

## Features

- Git setup (init + username and email configuration)
- NPM setup (init + install dependencies and dev dependencies)
- Test setup (with [Jasmine][jasmine] or [Mocha][mocha] + [chai][chai])
- Setup linting (using [ESLint][eslint] or [standard][standard])
- Setup conventional commits (using [commitizen][commitizen] and [cz-conventional-changelog][cz-conv])
- Setup coverage recording (with [nyc][nyc])
- Setup releasing (with [standard-version][standard-v])
- Setup pre-commit and pre-release hooks
- Generate sample test
- Generate basic README file (with badges)
- Generate License File (using [lice][lice])
- Can be run on an existing git or npm project



[chai]: [npm.im/chai]
[commitizen]: [npm.im/commitizen]
[cz-conv]: [npm.im/cz-conventional-changelog]
[eslint]: [npm.im/eslint]
[jasmine]: [npm.im/jasmine]
[lice]: [npm.im/lice]
[mocha]: [npm.im/mocha]
[nyc]: [npm.im/nyc]
[standard]: [npm.im/standard]
[standard-v]: [npm.im/standard-version]
