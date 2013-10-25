/**
 * @fileOverview
 * Created the MAster API. The Master object in SuperCluster is responsible for
 * distrubting work to workers.
 * When super cluster is required, the discovery begins.
 */
'use strict';
var util = require('util');
var inspect = util.inspect;
var path = require('path');
var fs = require('fs');
var is = require('is2');
var debug = require('debug')('sc:master');
var request = require('request');
var funcserialize = require('funcserialize');
var RoleBase = require('./RoleBase').RoleBase;
var ConfigObj = require('config-js').Config;
var Config = new ConfigObj(path.join(__dirname, './config.js'));
var asyncerr = require('async-err').asyncerr;
var objToJson = require('obj-to-json');

util.inherits(Master, RoleBase);
exports.Master = Master;

/**
 * Master constructor, creates an instance of a Master object.
 * @param {Object} [options] An optional configuration object.
 */
function Master(options) {
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

  if (!is.func(task) && !is.obj(task))
    return asyncerr(new Error('Bad task object: '+inspect(task)),cb);

  if (!is.func(cb))
    debug('Master.taskAll received no callback function.');

  if (!self.nodes.worker || !self.nodes.worker.length)
    return asyncerr(new Error('There are no workers.'), cb);

  // iterate across all the workers, sending the task.
  for (var i=0; i<self.nodes.worker.length; i++)
    self.taskWorker(self.nodes.worker[i], task, args, cb);
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

  if (!is.func(task) && !is.obj(task))
    return asyncerr(new Error('Bad task object: '+inspect(task)),cb);

  if (!is.nonEmptyObj(worker))
    return asyncerr(new Error('Bad parameter for worker: '+
                              inspect(worker)), cb);

  if (!is.func(cb))
    debug('Master.taskAll received no callback function.');

  // args is an optional argument and may not be present
  if (is.func(args)) {
    cb = args;
  } else if (is.array(args)) {
    if (is.obj(task) && !task.args) {
      task.args = args;
      args = undefined;
    }
  }

  // depending on the type of task, handle it
  process.nextTick(function() {
    if (is.func(task)) {
      self.sendFuncToWorker(worker, task, args, cb);
    } else if (is.obj(task)) {
      switch(task.type) {
      case 'github':
        self.sendGithubToWorker(worker, task, cb);
        break;
      case 'file':
        self.sendFileToWorker(worker, task, cb);
        break;
      default:
        debug('Unknown task.type in task: '+inspect(task));
        cb(new Error('Unknown task.type in task: '+inspect(task)));
        break;
      }
    }
  });
};

/**
 * Send a task to a specific worker.
 * @param {Object} worker An object identifying a specific worker.
 * @param {Object} task A task object, may be an object
 * describing a task, a string referring to a file or a function.
 * @param {Array} [args] if task is a function, args stores input arguments for
 * the function.
 * @param {Function} cb callback.
 */
Master.prototype.sendFileToWorker = function(worker, task, cb) {
  var self = this;
  var id = worker.id;

  if (!id || !self.getWorker(id)) {
    return asyncerr(new Error('Master.sendTaskToWorker: bad id received: '+
                       inspect(id)), cb);
  }

  // asynchronously serialize the file (file ops done async)
  self.serializeFile(task, function(err, taskObj) {
    if (err) {
      debug('sendFileToWorker serializeFile'+inspect(err));
      return cb(err);
    }

    var body = {
      task: taskObj,
      master: self.data,
      worker: worker
    };

    var options = {
      method: 'POST',
      uri: 'http://'+id+'/addTask',
      json: true,
      body: body,
      encoding: 'utf8'
    };

    // send the task to the worker's REST API
    request(options, function (err, res, body) {
      if (err) {
        debug('Master.sendTaskToWorker: request error: '+inspect(err));
        return cb(err);
      }

      if (res.statusCode !== 200) {
        debug('Master.sendTaskToWorker unexpected response code: '+
              res.statusCode);
        return cb('error', res, body);
      }

      if (cb)  return cb(null, res, body);
    });
  });
};

/**
 * Send a task to a specific worker that represent a github project.
 * @param {Object} worker An object identifying a specific worker.
 * @param {Object} task A task object, may be an object
 * describing a task, a string referring to a file or a function.
 * @param {Array} [args] if task is a function, args stores input arguments for
 * the function.
 * @param {Function} cb callback.
 */
Master.prototype.sendGithubToWorker = function(worker, task, cb) {
  var id = worker.id;
  if (!id || !this.getWorker(id)) {
    return asyncerr(new Error('Master.sendTaskToWorker: bad id received: '+
                       inspect(id)), cb);
  }

  var body = {
    task: task,
    master: this.data,
    worker: worker
  };

  var options = {
    method: 'POST',
    uri: 'http://'+id+'/addTask',
    json: true,
    body: body,
    encoding: 'utf8'
  };

  // send the task to the worker's REST API
  request(options, function (err, res, body) {
    if (err) {
      debug('Master.sendTaskToWorker: request error: '+inspect(err));
      return cb(err);
    }

    if (res.statusCode !== 200) {
      debug('Master.sendGithubToWorker unexpected response code: '+
            res.statusCode);
      return cb('error', res, body);
    }

    if (cb)  return cb(null, res, body);
  });
};

/**
 * Send a function to a specific worker.
 * @param {Object} worker An object identifying a specific worker.
 * @param {Function} func A function to run remotely.
 * describing a task, a string referring to a file or a function.
 * @param {Array} [args] if task is a function, args stores input arguments for the function.
 * @param {Function} cb callback.
 */
Master.prototype.sendFuncToWorker = function(worker, func, args, cb) {
  var id = worker.id;
  if (!id || !this.getWorker(id)) {
    return asyncerr(new Error('Master.sendFuncToWorker: bad worker received: '+
                       inspect(worker)), cb);
  }

  var obj = {
    task: this.serializeFunc(func, args),
    master: this.data,
    worker: worker
  };

  var body = objToJson.jsonStringify(obj);
  if (!body)
    debug('There was an error stringifying task: '+inspect(func));

  var options = {
    method: 'POST',
    uri: 'http://'+id+'/addTask',
    json: true,
    body: body,
    encoding: 'utf8'
  };
  debug('sendFuncToWorker options: '+inspect(options));

  // send the task to the worker's REST API
  request(options, function (err, res, body) {
    if (err) {
      debug('Master.sendFuncToWorker: request error: '+inspect(err));
      return cb(err);
    }

    if (res.statusCode !== 200) {
      debug('Master.sendFuncToWorker unexpected response code: '+
            res.statusCode);
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
  self.RestApi.addRoute('post', '/taskResult', function(req, res, taskResult) {
    self.taskResult(req, res, taskResult);
  });
};

/**
 * Handles the async result sent by the worker to the master's REST API.
 * @param {Object} req The HTTP request object from Node.
 * @param {Object} res The HTTP response object from Node.
 * @param {Object} taskResult The JSON object in the HTTP request body.
 */
Master.prototype.taskResult = function(req, res, taskResult) {
  res.write('{"success":true}', 'utf8');
  res.end();

  if (!taskResult.task || !is.str(taskResult.task.type))
    debug('Master.taskResult missing task information: '+inspect(taskResult));

  if (!taskResult.worker || !is.obj(taskResult.worker) ||
     (!taskResult.err && !taskResult.result)) {
    debug('Master.taskResult missing information: '+inspect(taskResult));
  }

  this.emit('workerTaskComplete', taskResult);
};

/**
 * Given an input, describing a task for a worker, create an object
 * that can be serialized to JSON and sent to the worker.
 * @param {Object} task An object describing a task.
 * @param {String[]} args An array os strings with the argument names.
 * @return {Object} Serialized result.
 */
Master.prototype.serializeFile = function(task, cb) {
  if (!is.obj(task)) {
    return asyncerr(new Error('serializeFile Received bad object for task: '+
                       inspect(task)), cb);
  }

  var type = task.type;
  if (!type || type !== 'file')
    return asyncerr(new Error('serializeFile bad task '+inspect(task)), cb);

  // file must exist
  fs.exists(task.fileName, function(exists) {
    if (!exists)
      return cb(new Error('serializeFile no such file as '+task.fileName));

    // file exists, read it
    fs.readFile(task.fileName, function (err, data) {
      if (err) {
        cb(new Error('serializeFile error reading '+task.FileName+': '+
           inspect(err)));
        return;
      }

      task.type = 'file';
      task.file = data;
      cb(null, task);
    });
  });
};

/**
 * Given an input, describing a task for a worker, create an object
 * that can be serialized to JSON and sent to the worker.
 * @param {Function} task An object describing a task.
 * @param {String[]} args An array os strings with the argument names.
 * @return {Object} Serialized result.
 */
Master.prototype.serializeFunc = function(task, args) {
  if (!is.func(task)) {
    debug('Received bad object for serializeFunc: task, returning.');
    return false;
  }

  debug('serializeFunc task: '+inspect(task));

  // when we send the task to the master, we combine the:
  // task, master information, worker information into the object sent
  var obj = {};
  obj.type = 'function';
  obj.func = funcserialize.toObj(task);
  if (args && is.nonEmptyArray(args))
    obj.args = args;
  debug('Master.serializeFunc task:', obj);
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

