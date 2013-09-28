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
var RoleBase = require('./RoleBase').RoleBase;

util.inherits(Master, RoleBase);
exports.Master = Master;

/**
 *
 */
function Master(config) {
  RoleBase.call(this, 'master', config);
}

/**
 * Send a task to all workers.
 */
Master.prototype.sendTaskToAll = function(task, args, cb) {
  if (!is.func(task)) {
    debug('Master.sendTaskToAll error, bad task:',task);
    return false;
  }

  if (!self.workers || !self.workers.length)  return false;
  var taskObj = this.serializeTask(task, args);

  for (var i=0; i<self.workers.length; i++) {
    var addr = 'http://'+self.workers[i].id+'/addTask';
    request.post(addr, taskObj, function (error, response, body) {
      if (!error && response.statusCode == 200) {
        console.log(body);
      }
    })
  }
};

/**
 * Send a task to a specific worker.
 */
Master.prototype.sendTaskToWorker = function(worker, task, args, cb) {
  var self = this;

  if (!is.func(task)) {
    debug('Master.sendTaskToAll error, bad task:',task);
    return false;
  }

  var id = worker.id;
  if (!id || !self.workers[id])  return false;
  var taskObj = this.serializeTask(task, args);
  var addr = 'http://'+id+'/addTask';

  request.post(addr, taskObj, function (err, res, body) {
    if (err)  return cb(err);
    if (res.statusCode !== 200)  return cb(body);
    cb(null, res, body);
  })
};

/**
 * Given an input, describing a task for a worker, create an object
 * that can be serialized to JSON and sent to the worker.
 * @param {Object} task An object describing a task
 * @return {Object} Serialized result.
 */
Master.prototype.serializeTask = function(task, args) {
  if (!is.func(task))  return false;

  var str = task.toString();
  var re = /function\s*(.*)\((.*)\)\s*\{(.*)\}/m;
  var match = re.exec(str);
  var obj = {};
  obj.name = match[1];
  obj.params = match[2].split(',');
  obj.code = match[3];
  obj.args = args;
  return obj;
};

/**
 * Handle the case where dicovery found a master.
 * @param {Object} master The master announcement msg.
 */
Master.prototype.masterAvailable = function(master) {
};

/**
 * Handle the case where discovery lost a master.
 * @param {Object} master The master announcement msg.
 */
Master.prototype.masterUnavailable = function(master) {
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

