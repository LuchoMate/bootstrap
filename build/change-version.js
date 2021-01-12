#!/usr/bin/env node

/*!
 * Script to update version number references in the project.
 * Copyright 2017-2021 The Bootstrap Authors
 * Copyright 2017-2021 Twitter, Inc.
 * Licensed under MIT (https://github.com/twbs/bootstrap/blob/main/LICENSE)
 */

'use strict'

const fs = require('fs')
const path = require('path')
const sh = require('shelljs')

sh.config.fatal = true

const VERBOSE = process.argv.includes('--verbose')
const DRY_RUN = process.argv.includes('--dry') || process.argv.includes('--dry-run')

const ROOT_DIR = path.join(__dirname, '..')

// Blame TC39... https://github.com/benjamingr/RegExp.escape/issues/37
function regExpQuote(string) {
  return string.replace(/[$()*+-.?[\\\]^{|}]/g, '\\$&')
}

function regExpQuoteReplacement(string) {
  return string.replace(/\$/g, '$$')
}

function walkAsync(directory, excludedDirectories, fileCallback, errback) {
  if (excludedDirectories.has(path.parse(directory).base)) {
    return
  }

  fs.readdir(directory, (err, names) => {
    if (err) {
      errback(err)
      return
    }

    names.forEach(name => {
      const filepath = path.join(directory, name)
      fs.lstat(filepath, (err, stats) => {
        if (err) {
          process.nextTick(errback, err)
          return
        }

        if (stats.isDirectory()) {
          process.nextTick(walkAsync, filepath, excludedDirectories, fileCallback, errback)
        } else if (stats.isFile()) {
          process.nextTick(fileCallback, filepath)
        }
      })
    })
  })
}

function replaceRecursively(directory, excludedDirectories, allowedExtensions, original, replacement) {
  const updateFile = filepath => {
    if (allowedExtensions.has(path.parse(filepath).ext)) {
      if (VERBOSE) {
        console.log(`FILE: ${filepath}`)
      }

      if (DRY_RUN) {
        return
      }

      sh.sed('-i', new RegExp(regExpQuote(original), 'g'), regExpQuoteReplacement(replacement), filepath)
    } else if (VERBOSE) {
      console.log(`EXCLUDED: ${filepath}`)
    }
  }

  walkAsync(directory, excludedDirectories, updateFile, err => {
    console.error('ERROR while traversing directory!:')
    console.error(err)
    process.exit(1)
  })
}

function main(args) {
  const [oldVersion, newVersion] = args

  if (!oldVersion || !newVersion) {
    console.error('USAGE: change-version old_version new_version [--verbose] [--dry[-run]]')
    console.error('Got arguments:', args)
    process.exit(1)
  }

  const EXCLUDED_DIRS = new Set([
    '.git',
    '_gh_pages',
    'node_modules',
    'resources'
  ])
  const INCLUDED_EXTENSIONS = new Set([
    // This extensions list is how we avoid modifying binary files
    '',
    '.css',
    '.html',
    '.js',
    '.json',
    '.md',
    '.scss',
    '.txt',
    '.yml'
  ])

  replaceRecursively(ROOT_DIR, EXCLUDED_DIRS, INCLUDED_EXTENSIONS, oldVersion, newVersion)
}

main(process.argv.slice(2))
