/**
 * @fileOverview This file contains the functions used in the async.series for
 * the run github functionality in the worker. To allow for more parameters, the
 * async.apply was used which inserts arguments before the default callback.
 */
'use strict';
var inspect = require('util').inspect;
var debug = require('debug')('sc:worker:run:file');
var spawn = require('child_process').spawn;
var githubUrl = require('github-url');
var exec = require('exec');
var workerRunCommon = require('./WorkerRunCommon');
var inspect = require('util').inspect;
var is = require('is2');

/**
 * make the temp directory
 * @param {String} dir The directory where the file will go.
 * @param {Function} cb The callback function.
 */
exports.makeDir = workerRunCommon.makeDir;

/**
 * set the cwd to the temp dir
 * @param {String} dir The directory to change to.
 * @param {Function} cb The callback function.
 */
exports.chDir = workerRunCommon.chDir;

/**
 * git clone the repo
 * @param {Object} task The object describing the task.
 * @param {Function} cb The callback function.
 */
exports.gitClone = function(task, cb) {

  if (!is.obj(task) || !is.nonEmptyStr(task.user) || !is.nonEmptyStr(task.repo))
    return cb(new Error('Error bad task object: '+inspect(task)));

  if (!is.func(cb))
    return cb(new Error('Bad cb parameter: '+inspect(cb)));

  var url = githubUrl.toUrl({user: task.user, project: task.repo});
  exec(['git', 'clone', url], function(err, out, code) {
    if (err) {
      debug('runGithub git clone error: '+inspect(err));
      return cb(err);
    }
    if (code !== 0) {
      debug('runGithub git clone bad exit code: '+code);
      return cb(code);
    }
    cb();
  });
};

/**
 * run the pre-commands
 * @param {Object} task The object describing the task.
 * @param {Function} cb The callback function.
 */
exports.runPreCmds = function(task, cb) {

  if (!is.obj(task))
    return cb(new Error('Error bad task object: '+inspect(task)));

  if (!is.func(cb))
    return cb(new Error('Bad cb parameter: '+inspect(cb)));

  cb();
};

/**
 * spawn the child process, run the command
 * @param {Object} task The object describing the task.
 * @param {String} dir The directory to run the task.
 * @param {Object} output Object with stdout and stderr property buffers.
 * @param {Function} cb The callback function.
 */
exports.runCmd = function(task, dir, output, cb) {

  if (!is.obj(task) || !is.array(task.args))
    return cb(new Error('Error bad task object: '+inspect(task)));

  if (!is.func(cb))
    return cb(new Error('Bad cb parameter: '+inspect(cb)));

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
    cb(null, output, code);
  });
};

/**
 * run the post commands
 * @param {Object} task The object describing the task.
 * @param {Function} cb The callback function.
 */
exports.runPostCmds = function(task, cb) {

  if (!is.obj(task))
    return cb(new Error('Error bad task object: '+inspect(task)));

  if (!is.func(cb))
    return cb(new Error('Bad cb parameter: '+inspect(cb)));

  cb();
};

/**
 * delete the temporary file
 * @param {Object} task The object describing the task.
 * @param {Function} cb The callback function.
 */
exports.rmTempDir = workerRunCommon.unlink;

