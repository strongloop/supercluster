/**
 * @fileOverview This file contains the functions used in the async.series for
 * the run file functionality in the worker. To allow for more parameters, the
 * async.apply was used which inserts arguments before the default callback.
 */
'use strict';
var debug = require('debug')('sc:worker:run:file');
var spawn = require('child_process').spawn;
var workerRunCommon = require('./WorkerRunCommon.js');
var is = require('is2');
var inspect = require('util').inspect;

/**
 * make the temp directory
 * @param {String} dir The directory where the file will go.
 * @param {Function} cb The callback function.
 */
exports.makeDir = workerRunCommon.makeDir;

/**
 * write the file to the temp dir
 * @param {Object} task The object describing the task (file)
 * @param {Function} cb The callback function
 */
exports.writeFile = workerRunCommon.writeFile;

/**
 * spawn the child process, have it run in the dir
 * @param {Object} task An object describing the task (file)
 * @param {Sring} dir The director for the file
 * @param {Object} output An object with stdout and stderr properties (strings)
 * @param {Function} cb The callback function.
 */
exports.spawnChild = function(task, dir, output, cb) {

  if (!is.obj(task) || !is.str(task.fileName))
    return cb(new Error('Bad task object: '+inspect(task)));

  if (!is.nonEmptyStr(dir))
    return cb(new Error('Bad dir object: '+inspect(task)));

  if (!is.obj(output) || !is.str(output.stdout) || !is.str(output.stderr))
    return cb(new Error('Bad output object: '+inspect(output)));

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
    debug('output:',output);
    cb(null, code);
  });
};

/**
 * delete the temporary file
 * @param {Object} task An object describing the task (file)
 * @param {Function} cb The callback function.
 */
exports.rmTempFile = exports.unlink = workerRunCommon.unlink;

