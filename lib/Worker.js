/**
 * @fileOverview
 * The Worker object in SuperCluster is responsible for taking tasks from
 * Masters, completing the tasks and reporting back the results.
 * When SuperCluster is required, the discovery begins.
 */
'use strict';
var util = require('util');
var spawn = require('child_process').spawn;
var fs = require('fs');
var path = require('path');
var debug = require('debug')('sc:master');
var is = require('is2');
var RoleBase = require('./RoleBase').RoleBase;
var funcserialize = require('funcserialize');
var request = require('request');
var async = require('async');
var mkdirp = require('mkdirp');
var exec = require('exec');
var githubUrl = require('github-url');
var runFile = require('./WorkerRunFile');

util.inherits(Worker, RoleBase);
exports.Worker = Worker;

/**
 * Constructs a worker object.
 * @param {Object} options The configuration directing how to construct the
 * object.
 * @constructor
 */
function Worker(options) {
  var self = this;
  self.port = (options && options.port) ? options.port : 9998;
  self.restApiPort = (options && options.restApiPort) ? options.restApiPort :
    44401;
  self.options = options ? options : {};
  RoleBase.call(this, 'worker');
}

/**
 * Creates the REST API specific to the worker.
 */
Worker.prototype.addRoutes = function() {
  var self = this;

  // add a route to handle adding a task. Just collect the body and
  // call Worker.addTask.
  self.RestApi.addRoute('post', '/addTask', function(req, res, taskInfo) {
    if (!is.obj(taskInfo) || !is.obj(taskInfo.master)) {
      debug('self.RestApi.addRoute received bad taskInfo:', taskInfo);
      return;
    }

    // send reply to client
    res.write('{"success":true}', 'utf8');
    res.end();

    // create easy to use return address
    var address = req.socket.address().address + ':' +
      taskInfo.master.restApiPort;

    // process the task on the next tick
    process.nextTick(function() {
      if (is.obj(taskInfo) && is.obj(taskInfo.master) &&
          is.obj(taskInfo.task)) {
        self.emit('taskReceived', taskInfo.master, taskInfo.task);
        self.doTask(taskInfo, address);
      } else {
        debug('/addTask bad taskInfo:',taskInfo);
      }
    });
  });
};

/**
 * Figure out task type and run the correct method for the type of task.
 * @param {Object} taskInfo An object describing the task to be done.
 * @param {String} address An adress of the requestor for the task in the form:
 * <IP ADDR>:<PORT>
 */
Worker.prototype.doTask = function(taskInfo, address) {
  var self = this;

  var type = taskInfo.task.type;
  if (type === 'function') {
    self.runFunc(taskInfo.task, function(err, result) {
      if (err && !result)  result = err.message;
      self.taskReply(err, taskInfo, address, result);
    });
  } else if (type === 'file') {
    self.runFile(taskInfo.task, function(err, result) {
      if (err) {
        debug('Worker.doTask err: '+util.inspect(err));
        if (!result)  result = err.message;
      }
      self.taskReply(err, taskInfo, address, result);
    });
  } else if (type === 'github') {
    self.runGithub(taskInfo.task, function(err, result) {
      if (err) {
        debug('Worker.doTask err: '+util.inspect(err));
        if (!result)  result = err.message;
      }
      self.taskReply(err, taskInfo, address, result);
    });
  }
};

/**
 * Task is done, now send task result to master.
 * @param {Object} err An error object describing an error.
 * @param {Object} taskInfo An object describing the task to be done.
 * @param {String} address An adress of the requestor for the task in the form:
 * <IP ADDR>:<PORT>
 * @param {Any} result The result of the task.
 */
Worker.prototype.taskReply = function(err, taskInfo, address, result) {
  var addr = 'http://'+address+'/taskResult';
  var response;

  if (err)  debug('Worker.taskReply err:',err);

  var responseObj = {
    success: err ? false : true,
    result: result,
    task: taskInfo
  };

  try {
    response = JSON.stringify(responseObj);
  } catch (err) {
    response = JSON.stringify({ success: false, result: err.message });
    debug('Worker.taskReply: Failed to stringify responseObj: '+
          util.inspect(responseObj));
  }

  var options = {
    method: 'POST',
    uri: addr,
    json: true,
    body: response,
    encoding: 'utf8'
  };

  // send the task result to the master's REST API
  request(options, function (err, res, body) {
    if (err) {
      debug('Worker.taskReply: request error: '+util.inspect(err));
      return err;
    }

    if (res.statusCode !== 200) {
      debug('Worker.taskReply unexpected response code: '+res.statusCode);
      return 'error';
    }
    if (!body.success)
      debug('Error on Worker.taskReply response:'+util.inspect(body));
  });
};

/**
 * Runs a task from a master via the REST API, run it and return the result.
 * @param {Object} task An object describing the task.
 * @param {Function} cb A callback function.
 */
Worker.prototype.runFunc = function(task, cb) {
  if (!is.nonEmptyObj(task)) {
    debug('runFunc: no task received.');
    process.nextTick(function() {
      cb(new Error('runFunc: no task received.'));
    });
    return;
  }

  var taskFunc = funcserialize.toFunc(task);

  // RUN the TASK
  process.nextTick(function() {
    var result = taskFunc.apply(taskFunc, task.args);
    cb(undefined, result);
  });
};

/**
 * A convenience function to make oterwise sync errors async and to make them
 * easier to read.
 * @param {Object} A Node.js Error object.
 * @param {Function} A function object as callback.
 */
function asyncErr(err, cb) {
  if (!is.instanceOf(err, Error))
    return debug('ascynErr received bad err object.');

  if (!is.func(cb))
    return debug('asyncErr received bad callback: '+util.inspect(cb));

  debug(err.message);
  process.nextTick(function() {
    cb(err);
  });
}

/**
 * Runs a task from a master by saving, then running the supplied file.
 * @param {Object} task An object describing the task.
 * @param {Function} cb A callback function.
 */
Worker.prototype.runFile = function(task, cb) {
  // ensure task is an object
  if (!is.nonEmptyObj(task))
    return asyncErr(new Error('runFile: no task received.'), cb);
  // ensure the task has a filename
  if (!is.str(task.fileName))
    return asyncErr(new Error('runFile, task has no fileName: '+
                              util.inspect(task)), cb);

  try {
    // convert array representing a buffer into a string
    if (is.array(task.file)) {
      task.file = new Buffer(task.file);
      task.file = task.file.toString();
    }
  } catch(err) {
    return asyncErr(err, cb);
  }

  // ensure we have a string representing the file
  if (!is.str(task.file))
    return asyncErr(new Error('runFile, task has no task.file: '+
                              util.inspect(task.file)), cb);

  if (!is.array(task.args))
    return asyncErr(new Error('runFile, task has no args: '+
                              util.inspect(task)), cb);

  task.fileName = path.normalize(task.fileName);

  // we want to dump the file in /tmp. If it is starts with /tmp, fine.
  if (task.fileName.substr(0,4) !== '/tmp')
    task.fileName = path.join('/tmp', task.fileName);

  // get the dir and make the directory
  var dir = path.dirname(task.fileName);
  var output = {
    stdout: '',
    stderr: ''
  };

  async.series([
    async.apply(runFile.makeDir, dir),
    async.apply(runFile.writeFile, task),
    async.apply(runFile.spawnChild, task, dir, output),
    async.apply(runFile.rmTempFile, task)
  ],   // end of series
  // return result
  function(err, results) {
    if (err)  {
      debug('results: ',results);
      debug('==> runFile err: ',err);
      // this cb is from the outtermost function
      return cb(err);
    }
    debug('==> results:',results);
    var obj = {
      stdout: output.stdout,
      stderr: output.stderr,
      code: results[2]
    };
    debug('===> OBJ:',obj);
    cb(undefined, obj);
  });
};

/**
 * Runs a task from a master by cloning a github repo and then performing
 * a sequence of commands.
 * @param {Object} task An object describing the task.
 * @param {Function} cb A callback function.
 */
Worker.prototype.runGithub = function(task, cb) {
  var Err;
  var errStr;
  if (!is.nonEmptyObj(task)) {
    errStr = 'runGithub: no task received.';
    Err = new Error(errStr);
    debug('runGithub: no task received.');
    process.nextTick(function() {
      cb(Err);
    });
    return;
  }

  if (!is.str(task.user)) {
    errStr = 'runGithub, task has no user: '+util.inspect(task);
    Err = new Error(errStr);
    debug(errStr);
    process.nextTick(function() {
      cb(Err);
    });
    return;
  }

  if (!is.str(task.repo)) {
    errStr = 'runGithub, task has no repo: '+util.inspect(task);
    Err = new Error(errStr);
    debug(errStr);
    process.nextTick(function() {
      cb(Err);
    });
    return;
  }

  if (!is.str(task.dir)) {
    errStr = 'runGithub, task has no dir: '+util.inspect(task);
    Err = new Error(errStr);
    debug(errStr);
    process.nextTick(function() {
      cb(Err);
    });
    return;
  }

  if (!is.obj(task.cmds)) {
    errStr = 'runGithub, task has no cmds: '+util.inspect(task);
    Err = new Error(errStr);
    debug(errStr);
    process.nextTick(function() {
      cb(Err);
    });
    return;
  }

  // ensure we have a string representing the file
  if (!is.str(task.file)) {
    debug('Buffer.isBuffer(task.file) ',Buffer.isBuffer(task.file));
    errStr = 'runGithub, task has no task.file: '+util.inspect(task.file);
    Err = new Error(errStr);
    debug(errStr);
    process.nextTick(function() {
      cb(Err);
    });
    return;
  }

  if (!is.array(task.args)) {
    errStr = 'runGithub, task has no args: '+util.inspect(task);
    Err = new Error(errStr);
    debug(errStr);
    process.nextTick(function() {
      cb(Err);
    });
    return;
  }

  task.fileName = path.normalize(task.fileName);

  // we want to dump the file in /tmp. If it is starts with /tmp, fine.
  if (task.fileName.substr(0,4) !== '/tmp')
    task.fileName = path.join('/tmp', task.fileName);

  // get the dir and make the directory
  var dir = path.dirname(task.fileName);
  var stdout = '';
  var stderr = '';
  var origCwd = process.cwd();
  var targetDir = path.join(dir, task.repo);

  async.series(
  [
    // make the temp directory
    function(cb) {
      fs.exists(dir, function(exists) {
        if (exists)  return cb();
        mkdirp(dir, function (err) {
          if (err) {
            debug('mkdirp '+util.inspect(err));
            return cb(err);
          }
          cb();
        });
      });
    },
    // set the cwd to the temp dir
    function(cb) {
      try {
        process.chdir(dir);
      } catch(err) {
        debug('runGithub chdir error: '+util.inspect(err));
        return cb(err);
      }
      cb();
    },
    // git clone the repo
    function(cb) {
      var url = githubUrl.toUrl({user: task.user, project: task.repo});
      exec(['git', 'clone', url], function(err, out, code) {
        if (err) {
          debug('runGithub git clone error: '+util.inspect(err));
          return cb(err);
        }
        if (code !== 0) {
          debug('runGithub git clone bad exit code: '+code);
          return cb(code);
        }
        cb();
      });
    },
    // set the cwd to the dir
    function(cb) {
      try {
        process.chdir(targetDir);
      } catch(err) {
        debug('runGithub chdir error: '+util.inspect(err));
        return cb(err);
      }
      cb();
    },
    // run the pre-commands
    function(cb) {
      cb();
    },
    // spawn the child process, run the command
    function(cb) {
      var args = task.args;
      args.unshift(task.fileName);
      var child = spawn('node', args, {cwd:dir, env:process.env});
      debug('Spawned child process to run file.');

      child.stdout.on('data', function (data) {
        stdout += data;
        debug('stdout: ' + data);
      });

      child.stderr.on('data', function (data) {
        stderr += data;
        debug('stderr: ' + data);
      });

      child.on('close', function (code) {
        debug('child process exited with code ' + code);
        cb(null, code);
      });
    },
    // run the post commands
    function(cb) {
      cb();
    },
    // delete the temporary file
    function(cb) {
      if (task.doNotDelete)  return cb(null);
      fs.unlink(task.fileName, function (status) {
        if (!status)
          debug('Successfully deleted '+task.fileName);
        else
          debug('Error: failed to delete '+task.fileName);
        cb();
      });
    },
    // cd to the containing dir and remove the cloned dir
    function(cb) {
      try {
        process.chdir(origCwd);
      } catch(err) {
        debug('runGithub chdir error: '+util.inspect(err));
        return cb(err);
      }
      fs.unlink(targetDir, function (err) {
        if (err) {
          debug('runGithub unlink error: '+util.inspect(err));
          return cb(err);
        }
        debug('Successfully deleted '+targetDir);
        cb();
      });
    },
  ],   // end of series
  // return result
  function(err, results) {
    if (err)  {
      debug('results: ',results);
      debug('==> runFile err: ',err);
      return cb(err);
    }
    debug('==> results:',results);
    var obj = {
      stdout: stdout,
      stderr: stderr,
      code: results[2]
    };
    cb(undefined, obj);
  });
};

/**
 * Handle the case where dicovery found a master.
 * @param {Object} master The master announcement msg.
 */
Worker.prototype.masterAvailable = function() { };

/**
 * Handle the case where discovery lost a master.
 * @param {Object} master The master announcement msg.
 */
Worker.prototype.masterUnavailable = function() { };

/**
 * Handle the case where dicovery found a worker.
 * @param {Object} worker The worker announcement msg.
 */
Worker.prototype.workerAvailable = function() { };

/**
 * Handle the case where discovery lost a worker.
 * @param {Object} worker The worker announcement msg.
 */
Worker.prototype.workerUnavailable = function() { };

