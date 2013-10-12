/**
 * @fileOverview This file contains the functions used in the async.series for
 * the run file functionality in the worker. To allow for more parameters, the
 * async.apply was used which inserts arguments before the default callback.
 */
'use strict';
var fs = require('fs');
var inspect = require('util').inspect;
var mkdirp = require('mkdirp');
var debug = require('debug')('sc:worker:run:file');
var spawn = require('child_process').spawn;

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
 * spawn the child process, have it run in the dir
 * @param {Object} task An object describing the task (file)
 * @param {Sring} dir The director for the file
 * @param {Object} output An object with stdout and stderr properties (strings)
 * @param {Function} cb The callback function.
 */
exports.spawnChild = function(task, dir, output, cb) {
  var args = task.args;
  args.unshift(task.fileName);
  var child = spawn('node', args, {cwd:dir, env:process.env});
  debug('Spawned child process to run file.');

  child.stdout.on('data', function (data) {
    output.stdout += data;
    debug('stdout: ' + data);
  });

  child.stderr.on('data', function (data) {
    output.stderr += data;
    debug('stderr: ' + data);
  });

  child.on('close', function (code) {
    debug('child process exited with code ' + code);
    cb(null, code);
  });
};

/**
 * delete the temporary file
 * @param {Object} task An object describing the task (file)
 * @param {Function} cb The callback function.
 */
exports.rmTempFile = function(task, cb) {
  if (task.doNotDelete)  return cb(null);
  fs.unlink(task.fileName, function (status) {
    if (!status)
      debug('Successfully deleted '+task.fileName);
    else
      debug('Error: failed to delete '+task.fileName);
    cb();
  });
};

