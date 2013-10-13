/**
 * @fileOverview This file contains the functions used in the async.series for
 * the run file run github functionality. The functions exported here are used
 * WorkerRunFile.js and WorkerRunGithub.js.
 */
'use strict';
var fs = require('fs');
var inspect = require('util').inspect;
var mkdirp = require('mkdirp');
var debug = require('debug')('sc:worker:run:file');

/**
 * make the temp directory
 * @param {String} dir The directory where the file will go.
 * @param {Function} cb The callback function.
 */
exports.makeDir = function(dir, cb) {
  mkdirp(dir, function (err) {
    if (err) {
      debug('mkdirp '+inspect(err));
      return cb('mkdirp '+inspect(err));
    }
    cb(null);
  });
};

/**
 * write the file to the temp dir
 * @param {Object} task The object describing the task (file)
 * @param {Function} cb The callback function
 */
exports.writeFile = function(task, cb) {
  fs.writeFile(task.fileName, task.file, function (err) {
    if (err)  {
      debug('runFile, could not write file: '+err.message);
      return cb('runFile, could not write file: '+err.message);
    }
    cb(null);
  });
};

/**
 * delete the temporary file
 * @param {Object} task An object describing the task (file)
 * @param {Function} cb The callback function.
 */
exports.unlink = function(task, cb) {
  if (task.doNotDelete)  return cb(null);
  fs.unlink(task.fileName, function (status) {
    if (!status)
      debug('Successfully deleted '+task.fileName);
    else
      debug('Error: failed to delete '+task.fileName);
    cb();
  });
};

/**
 * set the cwd to the temp dir
 * @param {String} dir The directory to change to.
 * @param {Function} cb The callback function.
 */
exports.chDir = function(dir, cb) {
  try {
    process.chdir(dir);
  } catch(err) {
    debug('runGithub chdir error: '+inspect(err));
    return cb(err);
  }
  cb();
};

