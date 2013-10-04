/**
 * @fileOverview
 * The Worker object in SuperCluster is responsible for taking tasks from
 * Masters, completing the tasks and reporting back the results.
 * When SuperCluster is required, the discovery begins.
 */
'use strict';
var util = require('util');
var debug = require('debug')('sc:master');
var is = require('is2');
var RoleBase = require('./RoleBase').RoleBase;
var funcserialize = require('funcserialize');
var request = require('request');

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
  self.RestApi.addRoute('post', '/addTask', function(req, res) {
    var buf = '';   // buffer for body.
    // accumulate the body.
    req.on('data', function (data) { buf += data.toString(); });
    // we should not have all the body text, act on it.
    req.on('end', function () {
      res.setHeader('Content-Type', 'application/json');
      res.statusCode = 200;

      var task;
      try {
        debug('buf', typeof buf);
        task = JSON.parse(buf);
      } catch (err) {
        res.statusCode = 500;
        res.end({success: false, msg: 'Bad task.'});
        return;
      }

      res.write('{"success":true}', 'utf8');
      res.end();

      var address = req.socket.address().address + ':' +
        task.master.restApiPort;
      debug('==> address: '+address);
      process.nextTick(function() {
        self.doTaskAndReply(task, address);
      });
    });
  });
};

Worker.prototype.doTaskAndReply = function(task, address) {
  var self = this;
  var addr = 'http://'+address+'/taskResult';
  var result = self.runTask(task);
  var response;

  try {
    response = JSON.stringify({ success: true, result: result });
  } catch (err) {
    response = JSON.stringify({ success: false, result: err.message });
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
      debug('Worker.runTask: request error: '+util.inspect(err));
      return err;
    }

    if (res.statusCode !== 200) {
      debug('Worker.runTask unexpected response code: '+res.statusCode);
      return 'error';
    }
    debug('Worker,runTask response:'+util.inspect(body));
  });
};

/**
 * Runs a task from a master via the REST API, run it and return the result.
 * @param {Object} body The
 * @param {Object} req The http request object.
 * @param {Object} res The http response object.
 */
Worker.prototype.runTask = function(task) {
  if (!is.nonEmptyObj(task)) {
    debug('Worker addTask no task received.');
    return;
  }

  var taskFunc = funcserialize.toFunc(task);
  debug('task:'+util.inspect(task));
  debug('task.args:', task.args);

  // RUN the TASK
  var result = taskFunc.apply(taskFunc, task.args);
  return result;
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

