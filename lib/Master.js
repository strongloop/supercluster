/**
 * @fileOverview 
 * Created the MAster API. The Master object in SuperCluster is responsible for
 * distrubting work to workers.
 *
 * When super cluster is required, the discovery begins.
 */
'use strict';
var util = require('util');
var debug = require('debug')('sc:master');
var is = require('is2');
var request = require('request');
var funcserialize = require('funcserialize');
var RoleBase = require('./RoleBase').RoleBase;

util.inherits(Master, RoleBase);
exports.Master = Master;

/**
 * Master constructor, creates an instance of a Master object.
 * @param {Object} config A configuration object.
 */
function Master(config) {

  // first, do set set up
  var self = this;
  self.restCfg = {
    port: config && config.port ? config.port : 44402,
  };

  if (!self.createConfig(config) || !is.obj(self.config)) {
    debug('Master constructor, config failed, returning.');
    return;
  }

  if (!self.config.restApiPort)
    self.config.restApiPort = self.restCfg.port;

  self.port = (config && config.port) ? config.port : 9999;
  self.restApiPort = (config && config.restApiPort) ? config.restApiPort :
    44401;

  // Second, call base class
  RoleBase.call(this, 'master', self.config);
}

/**
 * Send a task to all workers.
 * @param {Object|Function|String} task A task object, may be an object
 * describing a task, a string referring to a file or a function.
 * @param {Array} args if task is a function, args stores input arguments for
 * the function.
 * @param {Function} cb callback.
 */
Master.prototype.taskAll = function(task, args, cb) {
  var self = this;
  if (!is.func(task)) {
    debug('Master.taskAll error, bad task:',task);
    return false;
  }

  if (!self.workers || !self.workers.length)  return false;
  var taskObj = this.serializeTask(task, args);
  var callback = function(err, resp, body) {
    if (!err && resp.statusCode === 200)
      console.log(body);
  };

  for (var i=0; i<self.workers.length; i++) {
    var addr = 'http://'+self.workers[i].id+'/addTask';
    request.post(addr, taskObj, callback);
  }

  if (cb)  return cb();
};

/**
 * Send a task to a specific worker.
 * @param {Object} worker An object identifying a specific worker.
 * @param {Object|Function|String} task A task object, may be an object
 * describing a task, a string referring to a file or a function.
 * @param {Array} args if task is a function, args stores input arguments for
 * the function.
 * @param {Function} cb callback.
 */
Master.prototype.taskWorker = function(worker, task, args, cb) {
  var self = this;

  if (!is.func(task)) {
    debug('Master.taskAll error, bad task:',task);
    return false;
  }

  var id = worker.id;
  if (!id || !self.workers[id])  return false;
  var taskObj = this.serializeTask(task, args);
  var addr = 'http://'+id+'/addTask';

  debug('taskWorker addr:', addr);
  debug('taskWorker taskObj:', taskObj);

  var options = {
    method: 'POST',
    uri: addr,
    json: true,
    body: taskObj,
    encoding: 'utf8'
  };

  request(options, function (err, res, body) {
    if (err)  return cb(err);
    if (res.statusCode !== 200)  return cb('error', res, body);
    if (cb)  return cb(null, res, body);
  });
};

/**
 * Given an input, describing a task for a worker, create an object
 * that can be serialized to JSON and sent to the worker.
 * @param {Object} task An object describing a task.
 * @param {String[]} args An array os strings with the argument names.
 * @return {Object} Serialized result.
 */
Master.prototype.serializeTask = function(task, args) {
  if (!is.func(task)) {
    debug('Received bad object for serializeTask: task, returning.');
    return false;
  }

  var obj = funcserialize.toObj(task);
  if (args)  obj.args = args;
  return obj;
};

/**
 * Handle the case where dicovery found a worker.
 * @param {Object} worker The worker announcement msg.
 */
Master.prototype.workerAvailable = function(worker) {
};

/**
 * Handle the case where discovery lost a worker.
 * @param {Object} worker The worker announcement msg.
 */
Master.prototype.workerUnavailable = function(worker) {
};

