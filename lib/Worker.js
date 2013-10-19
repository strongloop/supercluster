/**
 * @fileOverview
 * The Worker object in SuperCluster is responsible for taking tasks from
 * Masters, completing the tasks and reporting back the results.
 * When SuperCluster is required, the discovery begins.
 */
'use strict';
var util = require('util');
var inspect = require('util').inspect;
var path = require('path');
var debug = require('debug')('sc:master');
var is = require('is2');
var RoleBase = require('./RoleBase').RoleBase;
var funcserialize = require('funcserialize');
var request = require('request');
var async = require('async');
var asyncerr = require('async-err');
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

    // send reply to client - we got the task - the rest of the work will be
    // done asynchronously from here. We'll tell the client how it went via
    // a REST call.
    res.json({success:true});

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
        debug('Worker.doTask err: '+inspect(err));
        if (!result)  result = err.message;
      }
      self.taskReply(err, taskInfo, address, result);
    });
  } else if (type === 'github') {
    self.runGithub(taskInfo.task, function(err, result) {
      if (err) {
        debug('Worker.doTask err: '+inspect(err));
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

  debug('taskReply: '+inspect(result));
  debug('addr: '+addr);
  if (err)  return debug('Worker.taskReply err:',err);

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
          inspect(responseObj));
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
      debug('Worker.taskReply: request error: '+inspect(err));
      return err;
    }

    debug('request status code: '+res.statusCode);
    if (res.statusCode !== 200) {
      debug('Worker.taskReply unexpected response code: '+res.statusCode);
      return 'error';
    }
    if (!body.success)
      debug('Error on Worker.taskReply response:'+inspect(body));
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
      cb(new Error('No task received.'));
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
  // ensure task is an object
  if (!is.nonEmptyObj(task))
    return asyncerr(new Error('No task received.'), cb);
  // ensure the task has a filename
  if (!is.str(task.fileName))
    return asyncerr(new Error('Task has no fileName: '+inspect(task)), cb);

  try {
    // convert array representing a buffer into a string
    if (is.array(task.file)) {
      task.file = new Buffer(task.file);
      task.file = task.file.toString();
    }
  } catch(err) {
    return asyncerr(err, cb);
  }

  // ensure we have a string representing the file
  if (!is.str(task.file))
    return asyncerr(new Error('Task has no task.file: '+
                              inspect(task.file)), cb);

  if (!is.array(task.args))
    return asyncerr(new Error('Task has no args: '+inspect(task)), cb);

  task.fileName = path.normalize(task.fileName);

  // we want to dump the file in /tmp. If it is starts with /tmp, fine.
  if (task.fileName.substr(0,4) !== '/tmp')
    task.fileName = path.join('/tmp', task.fileName);

  // get the dir and make the directory
  var dir = path.dirname(task.fileName);

  // place the output buffers in an object, so we can pass the object
  // as a reference to the async function whose closure does not have the
  // buffers
  var output = { stdout: '', stderr: '' };

  // asynchronously perform the following steps to run the task
  async.series([
    // the following functions are in ./WorkerRunFile.js
    async.apply(runFile.makeDir, dir),
    async.apply(runFile.writeFile, task),
    async.apply(runFile.spawnChild, task, dir, output),
    async.apply(runFile.rmTempFile, task)
  ],   // end of series
  // steps are done (perhaps due to error), handle the result
  function(err, results) {
    if (err)  return cb(err);
    var obj = {
      stdout: output.stdout,
      stderr: output.stderr,
      code: results[2]
    };
    debug('obj:',obj);
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
  if (!is.nonEmptyObj(task))
    return asyncerr(new Error('No task received.'), cb);

  if (!is.str(task.user))
    return asyncerr(new Error('Task has no user: '+ inspect(task)), cb);

  if (!is.str(task.repo))
    return asyncerr(new Error('Task has no repo: '+ inspect(task)), cb);

  if (!is.str(task.dir))
    return asyncerr(new Error('task has no dir: '+ inspect(task)), cb);

  if (!is.obj(task.cmds))
    return asyncerr(new Error('Task has no cmds: '+inspect(task)), cb);

  if (!is.str(task.file))
    return asyncerr(new Error('Task has no file property: '+
                              inspect(task.file)), cb);

  if (!is.array(task.args))
    return asyncerr(new Error('Task has no args: '+inspect(task)), cb);

  task.fileName = path.normalize(task.fileName);

  // we want to dump the file in /tmp. If it is starts with /tmp, fine.
  if (task.fileName.substr(0,4) !== '/tmp')
    task.fileName = path.join('/tmp', task.fileName);

  // get the dir and make the directory
  var dir = path.dirname(task.fileName);
  var output = { stdout: '', stderr: '' };
  var origCwd = process.cwd();
  var targetDir = path.join(dir, task.repo);
  var runGithub = require('./WorkerRunGithub');

  async.series([
    // the following functions are in ./WorkerRunGithub.js
    async.apply(runGithub.makeDir, dir),
    async.apply(runGithub.chDir, dir),
    async.apply(runGithub.gitClone, task),
    async.apply(runGithub.gitClone, task),
    async.apply(runGithub.chDir, targetDir),
    async.apply(runGithub.runPreCmds, task),
    async.apply(runGithub.runCmd, task, output),
    async.apply(runGithub.postCmds, task),
    async.apply(runGithub.chDir, origCwd),
    async.apply(runGithub.unlink, targetDir)
  ],   // end of series
  // return result
  function(err, results) {
    if (err)  {
      debug('results: ',results);
      debug('==> runFile err: ',err);
      return cb(err);
    }
    debug('==> results:',results);
    var obj = {stdout: output.stdout, stderr: output.stderr, code: results[2]};
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

