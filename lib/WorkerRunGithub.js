/**
 * @fileOverview This file contains the functions used in the async.series for
 * the run github functionality in the worker. To allow for more parameters, the
 * async.apply was used which inserts arguments before the default callback.
 */
'use strict';
var inspect = require('util').inspect;
var debug = require('debug')('sc:worker:run:github');
var exec = require('exec');
var workerRunCommon = require('./WorkerRunCommon');
var inspect = require('util').inspect;
var is = require('is2');
var fs = require('fs');

/**
 * make the temp directory
 * @param {String} dir The directory where the file will go.
 * @param {Function} cb The callback function.
 */
exports.makedir = workerRunCommon.makedir;

/**
 * set the cwd to the temp dir
 * @param {String} dir The directory to change to.
 * @param {Function} cb The callback function.
 */
exports.chdir = workerRunCommon.chdir;

/**
 * git clone the repo
 * @param {Object} task The object describing the task.
 * @param {Function} cb The callback function.
 */
exports.gitClone = function(task, targetDir, cb) {

  if (!is.obj(task) || !is.nonEmptyStr(task.user) || !is.nonEmptyStr(task.repo))
    return cb(new Error('Error bad task object: '+inspect(task)));

  if (!is.func(cb))
    return cb(new Error('Bad cb parameter: '+inspect(cb)));

  // assume, if the target directory is present, it was installed.
  // FIXME: This is kinda dumb.
  if (fs.existsSync(targetDir))
    return cb();

  debug('gitClone task: '+inspect(task));
  var url = 'https://github.com/' + task.user + '/' + task.repo;
  debug('gitClone url: '+url);
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
 * run an array of commands or just one command
 * @param {Object[]} cmds An array of commands.
 * @param {Function} cb The callback function.
 */
exports.runCmds = workerRunCommon.runCmds;

/**
 * spawn the child process, run the command
 * @param {Object} task The object describing the task.
 * @param {String} dir The directory to run the task.
 * @param {Object} output Object with stdout and stderr property buffers.
 * @param {Function} cb The callback function.
 */
exports.runCmd = workerRunCommon.runCmd;

/**
 * delete the temporary directory
 * @param {string} dir The string describing the dir.
 * @param {Function} cb The callback function.
 */
exports.rmdir = workerRunCommon.rmdir;

