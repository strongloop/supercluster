/**
 * @fileOverview 
 * The Worker object in SuperCluster is responsible for taking tasks from 
 * Masters, completing the tasks and reporting back the results.
 * When SuperCluster is required, the discovery begins.
 */
'use strict';
var util = require('util');
var http = require('http');
var url = require('url');
var qs = require('querystring');
var debug = require('debug')('sc:master');
var is = require('is2');
var RestApi = require('./RestApi').RestApi;
var RoleBase = require('./RoleBase').RoleBase;

util.inherits(Worker, RoleBase);
exports.Worker = Worker;

/**
 * Constructs a worker object.
 * @param {Object} config The configuration directing how to construct the
 * object.
 * @constructor
 */
function Worker(config) {
  var restCfg = {
    port: config && config.port ? config.port : 44401,
  };

  if (is.obj(config)) {
    try {
      var cfgCopy = JSON.parse(JSON.stringify(config));
    } catch(err) {
      debug('Worker constructor, bad config:',config);
      return;
    }
  } else {
    cfgCopy = {};
  }

  if (!cfgCopy.restApiPort)
    cfgCopy.restApiPort = restCfg.port;

  RoleBase.call(this, 'worker', cfgCopy);

  this.createRestApi(restCfg);
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
    req.on('data', function (data) { buf += data; });
    // we should not have all the body text, act on it.
    req.on('end', function () {
      try {
        var task = JSON.parse(buf);
      } catch (err) {
        debug('RestApi.addRoute bad JSON received:',buf);
        res.writeHead(500, {'Content-Type': 'application/json'});
        res.end('{"success": false, "msg": "Bad JSON received."}');
        return;
      }
      self.addTask(task, req, res);
    });
  });
};

/**
 * Accept a task from a master via the REST API, run it and return the result.
 * @param {Object} body The 
 * @param {Object} req The http request object.
 * @param {Object} res The http response object.
 */
Worker.prototype.addTask = function(task, req, res) {
  console.log('addTask:',task);
  res.writeHead(200, {'Content-Type': 'application/json'});
  res.end('{"success": true}');
  /*
function construct(constructor, args) {
    function F() {
        return constructor.apply(this, args);
    }
    F.prototype = constructor.prototype;
    return new F();
}*/

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


