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
 * Runs a task from a master by saving, then running the supplied file.
 * @param {Object} task An object describing the task.
 * @param {Function} cb A callback function.
 */
Worker.prototype.runFile = function(task, cb) {
  var Err;
  var errStr;
  if (!is.nonEmptyObj(task)) {
    errStr = 'runFile: no task received.';
    Err = new Error(errStr);
    debug('runFunc: no task received.');
    process.nextTick(function() {
      cb(Err);
    });
    return;
  }

  if (!is.str(task.fileName)) {
    errStr = 'runFile, task has no fileName: '+util.inspect(task);
    Err = new Error(errStr);
    debug(errStr);
    process.nextTick(function() {
      cb(Err);
    });
    return;
  }

  // convert array representing a buffer into a string
  if (is.array(task.file)) {
    task.file = new Buffer(task.file);
    task.file = task.file.toString();
  }

  // ensure we have a string representing the file
  if (!is.str(task.file)) {
    debug('Buffer.isBuffer(task.file) ',Buffer.isBuffer(task.file));
    errStr = 'runFile, task has no task.file: '+util.inspect(task.file);
    Err = new Error(errStr);
    debug(errStr);
    process.nextTick(function() {
      cb(Err);
    });
    return;
  }

  if (!is.array(task.args)) {
    errStr = 'runFile, task has no args: '+util.inspect(task);
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

  async.series(
  [
    // make the temp directory
    function(cb) {
      mkdirp('dir', function (err) {
        if (err) {
          debug('mkdirp '+util.inspect(err));
        }
        cb(null);
      });
    },
    // write the file to the temp dir
    function(cb) {
      fs.writeFile(task.fileName, task.file, function (err) {
        if (err) {
          var errStr = 'runFile, could not write file: '+err.message;
          debug(errStr);
        }
        cb(null);
      });
    },
    // spawn the child process, have it run in the dir
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
    }
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
    debug('===> OBJ:',obj);
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

