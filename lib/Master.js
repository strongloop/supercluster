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
var ConfigObj = require('config-js').Config;
var path = require('path');
var Config = new ConfigObj(path.join(__dirname, './config.js'));

util.inherits(Master, RoleBase);
exports.Master = Master;

/**
 * Master constructor, creates an instance of a Master object.
 * @param {Object} options A configuration object.
 */
function Master(options) {

  // first, do set set up
  var self = this;

  self.port = (options && options.port) ? options.port :
    Config.get('master.port', 9999);
  self.restApiPort = (options && options.restApiPort) ? options.restApiPort :
    Config.get('master.restApiPort', Config.get('master.restApiPort', 44402));
  self.options = options ? options : {};

  // Second, call base class
  RoleBase.call(this, 'master', Config);
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

  if (!self.nodes.worker || !self.nodes.worker.length)  return false;
  var taskObj = this.serializeTask(task, args);
  var callback = function(err, resp, body) {
    if (!err && resp.statusCode === 200)
      console.log(body);
  };

  for (var i=0; i<self.nodes.worker.length; i++) {
    var addr = 'http://'+self.nodes.worker[i].id+'/addTask';
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
  if (!id || !self.getWorker(id)) {
    debug('Master.taskWorker: bad id received: '+id);
    return false;
  }
  var taskObj = this.serializeTask(task, args);
  var addr = 'http://'+id+'/addTask';

  var options = {
    method: 'POST',
    uri: addr,
    json: true,
    body: taskObj,
    encoding: 'utf8'
  };

  // send the task to the worker's REST API
  request(options, function (err, res, body) {
    if (err) {
      debug('Master.taskWorker: request error: '+util.inspect(err));
      return cb(err);
    }

    if (res.statusCode !== 200) {
      debug('Master.taskWorker unexpected response code: '+res.statusCode);
      return cb('error', res, body);
    }

    if (cb)  return cb(null, res, body);
  });
};

/**
 * Creates the REST API specific to the worker.
 */
Master.prototype.addRoutes = function() {
  var self = this;

  // add a route to handle adding a task. Just collect the body and
  // call Worker.addTask.
  self.RestApi.addRoute('post', '/taskResult', function(req, res) {
    debug('/taskResult');
    var buf = '';   // buffer for body.
    // accumulate the body.
    req.on('data', function (data) { buf += data.toString(); });
    // we should not have all the body text, act on it.
    req.on('end', function () {
      res.setHeader('Content-Type', 'application/json');
      res.statusCode = 200;

      var task;
      try {
        task = JSON.parse(buf);
      } catch (err) {
        res.statusCode = 500;
        res.end('{"success":false,"msg":"Bad task."}');
        return;
      }

      debug('body: '+buf);
      var jResult = { success: true };
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
 * Given an input, describing a task for a worker, create an object
 * that can be serialized to JSON and sent to the worker.
 * @param {Object} task An object describing a task.
 * @param {String[]} args An array os strings with the argument names.
 * @return {Object} Serialized result.
 */
Master.prototype.serializeTask = function(task, args) {
  var self = this;
  if (!is.func(task)) {
    debug('Received bad object for serializeTask: task, returning.');
    return false;
  }

  var obj = funcserialize.toObj(task);
  if (args)  obj.args = args;
  obj.master = self.data;
  return obj;
};

/**
 * Handle the case where dicovery found a master.
 * @param {Object} master The master announcement msg.
 */
Master.prototype.masterAvailable = function() { };

/**
 * Handle the case where discovery lost a master.
 * @param {Object} master The master announcement msg.
 */
Master.prototype.masterUnavailable = function() { };

/**
 * Handle the case where dicovery found a worker.
 * @param {Object} worker The worker announcement msg.
 */
Master.prototype.workerAvailable = function() { };

/**
 * Handle the case where discovery lost a worker.
 * @param {Object} worker The worker announcement msg.
 */
Master.prototype.workerUnavailable = function() { };

