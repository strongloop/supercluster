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
var RestApi = require('./RestApi').RestApi;
var RoleBase = require('./RoleBase').RoleBase;
var funcserialize = require('funcserialize');

util.inherits(Worker, RoleBase);
exports.Worker = Worker;

/**
 * Constructs a worker object.
 * @param {Object} config The configuration directing how to construct the
 * object.
 * @constructor
 */
function Worker(config) {
  var self = this;
  self.restCfg = {
    port: config && config.port ? config.port : 44401,
  };

  if (!self.createConfig(config) || !is.obj(self.config)) {
    debug('Master constructor, config failed, returning.');
    return;
  }

  if (!self.config.restApiPort)
    self.config.restApiPort = self.restCfg.port;

  RoleBase.call(this, 'worker', self.config);
  this.createRestApi(self.restCfg);
}

/**
 * Creates the REST API to receive work.
 * @param {Object} restCfg The configuration object.
 */
Worker.prototype.createRestApi = function(restCfg) {
  var self = this;
  self.RestApi = new RestApi(restCfg);

  // A simple health check
  self.RestApi.addRoute('get', '/ping', function(req, res) {
    res.writeHead(200, {'Content-Type': 'text/plain'});
    res.end('pong');
  });

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

      var result = self.runTask(task, req, res);
      var jResult = { success: true };
      if (result)  jResult.result = result;
      debug('==> result: '+util.inspect(result));

      var jsonResult;
      try {
        jsonResult = JSON.stringify(jResult);
      } catch (err) {
        debug('json stringify error with result:'+util.inspect(jResult));
        jsonResult = JSON.stringify({success: false, msg: 'Bad JSON result.'});
      }

      res.write(JSON.stringify(jsonResult), 'utf8');
      res.end();
    });
  });
};

/**
 * Runs a task from a master via the REST API, run it and return the result.
 * @param {Object} body The
 * @param {Object} req The http request object.
 * @param {Object} res The http response object.
 */
Worker.prototype.runTask = function(task, req, res) {
  if (!is.nonEmptyObj(task)) {
    debug('Worker addTask no task received.');
    return;
  }

  if (!is.nonEmptyObj(req)) {
    debug('Worker addTask missing http request object.');
    return;
  }

  if (!is.nonEmptyObj(res)) {
    debug('Worker addTask missing http response object.');
    return;
  }

  var taskFunc = funcserialize.toFunc(task);
  debug('task:'+util.inspect(task));
  debug('task.args:', task.args);
  var result = taskFunc.apply(taskFunc, task.args);
  return result;
};

/**
 * Handle the case where dicovery found a master.
 * @param {Object} master The master announcement msg.
 */
Worker.prototype.masterAvailable = function(master) {
};

/**
 * Handle the case where discovery lost a master.
 * @param {Object} master The master announcement msg.
 */
Worker.prototype.masterUnavailable = function(master) {
};

/**
 * Handle the case where dicovery found a worker.
 * @param {Object} worker The worker announcement msg.
 */
Worker.prototype.workerAvailable = function(worker) {
};

/**
 * Handle the case where discovery lost a worker.
 * @param {Object} worker The worker announcement msg.
 */
Worker.prototype.workerUnavailable = function(worker) {
};

