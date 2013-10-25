/**
 * @fileOverview This file contains the functions used in the async.series for
 * the run file run github functionality. The functions exported here are used
 * WorkerRunFile.js and WorkerRunGithub.js.
 *
 * All of the functions here are called from async.series.
 */
'use strict';
var fs = require('fs');
var inspect = require('util').inspect;
var mkdirp = require('mkdirp');
var debug = require('debug')('sc:worker:run:common');
var is = require('is2');
var remove = require('remove');
var spawn = require('child_process').spawn;
var async = require('async');

/**
 * make the temp directory
 * @param {String} dir The directory where the file will go.
 * @param {Function} cb The callback function.
 */
exports.makedir = function(dir, cb) {

  if (!is.nonEmptyStr(dir))
    return cb(new Error('makeDir: bad dir parameter type: '+typeof dir));

  if (!is.func(cb))
    return cb(new Error('makeDir: bad cb parameter type: '+typeof cb));

  mkdirp(dir, function (err) {
    if (err) {
      debug('mkdirp '+inspect(err));
      return cb('mkdirp '+inspect(err));
    }
    cb(null);
  });
};

/**
 * delete the temporary file
 * @param {String} file string with the file and path.
 * @param {Function} [cb] The callback function. Optional.
 */
exports.unlink = function(file, cb) {

  if (!is.nonEmptyStr(file))
    return cb(new Error('unlink: bad file parameter: '+inspect(file)));

  fs.unlink(file, function (err) {
    if (err) {
      debug('unlink: failed to delete file '+file);
      return cb(err);
    }
    if (cb && is.func(cb)) return cb();
  });
};

/**
 * delete the temporary dir
 * @param {String} dir The string with the direct
 * @param {Function} [cb] The callback function. Optional.
 */
exports.rmdir = function(dir, cb) {

  if (!is.nonEmptyStr(dir))
    return cb(new Error('rmdir: bad directory parameter: '+inspect(dir)));

  // Asynchronous
  remove(dir, function(err){
    if (err) {
      debug('rmdir: failed to delete directory '+dir);
      return cb(err);
    }
    if (is.func(cb)) return cb();
  });
};

/**
 * set the cwd to the temp dir
 * @param {String} dir The directory to change to.
 * @param {Function} cb The callback function.
 */
exports.chdir = function(dir, cb) {

  if (!is.nonEmptyStr(dir))
    return cb(new Error('chdir: bad dir parameter type: '+typeof dir));

  if (!is.func(cb))
    return cb(new Error('chdir: bad cb parameter type: '+typeof cb));

  try {
    process.chdir(dir);
  } catch(err) {
    debug('chdir error: '+inspect(err));
    return cb(err);
  }
  cb();
};

/**
 * run an array of commands or just one command
 * @param {Object[]} cmds An array of commands. or Just one c
 * @param {String} [dir] An optional default directory to run the commands in.
 * @param {Function} cb The callback function.
 */
exports.runCmds = function(cmds, dir, cb) {

  // it's valid to send no commands, you just get empty results.
  if (is.nullOrUndef(cmds))
    return cb(null, [], []);

  if (!is.array(cmds))
    return cb(new Error('Bad cmds parameter: '+inspect(cmds)));

  if (!is.func(cb))
    return cb(new Error('Bad cb parameter: '+inspect(cb)));

  // one for each entry in the array
  var outputs = [];
  var codes = [];

  // iterator function for async.eachSeries
  var iterator = function(cmd, cb) {
    // default directorry is the cwd
    if (!is.nonEmptyStr(cmd.dir))  cmd.dir = dir;

    var output = ({stdout:'', stderr:''});
    if (!is.nonEmptyStr(cmd.cmd) || !is.array(cmd.args))
      return debug('Bad command '+inspect(cmd));

    exports.runCmd(cmd.cmd, cmd.args, cmd.dir, output,
    function(err, output, code) {
      if (err) {
        debug(inspect(err.message));
        return cb(err);
      }
      codes.push(code);
      outputs.push(output);
      cb(null);
    });
  };

  async.eachSeries(cmds, iterator, function(err) {
    if (err) {
      debug(inspect(err));
      return cb(err);
    }
    cb(null, outputs, codes);
  });
};

/**
 * spawn the child process, run the command
 * @param {String} cmd The command to run.
 * @param {String[]} [args] An aray of argument for the command.
 * @param {String} dir The directory to run the task.
 * @param {Object} output Object with stdout and stderr property buffers.
 * @param {Function} [cb] The callback function.
 */
exports.runCmd = function(cmd, args, dir, output, cb) {

  if (!is.nonEmptyStr(cmd))
    return cb(new Error('Bad cmd param: '+inspect(cmd)));

  if (is.nullOrUndefined(args))
    args = [];

  var runInDir = cmd.dir ? cmd.dir : dir;
  if (!is.nonEmptyStr(runInDir))
    return cb(new Error('Bad dir param: '+inspect(runInDir)));

  var errDomain = require('domain').create();
  errDomain.on('error', function(err) {
    debug('Spawned child process error: '+err.message);
    cb(err);
  });

  var child;
  debug('Spawning child process to run '+cmd+', wth args: '+inspect(args));
  errDomain.run(function() {
    child = spawn(cmd, args, {cwd:runInDir, env:process.env});
  });

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
    if (is.func(cb))  cb(null, output, code);
  });
};

