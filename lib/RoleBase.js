// Copyright IBM Corp. 2013. All Rights Reserved.
// Node module: supercluster
// This file is licensed under the MIT License.
// License text available at https://opensource.org/licenses/MIT

/**
 * @fileOverview
 * The RoleBase object in SuperCluster is responsible for the common actions
 * among workers and master. The RoleBase class is responsible for managing the
 * discovery. When super cluster is required, the discovery begins.
 */
'use strict';
var util = require('util');
var events = require('events');
var debug = require('debug')('sc:rolebase');
var is = require('is2');
var Discovery = require('./discovery').Discovery;
var ConfigObj = require('config-js').Config;
var path = require('path');
var Config = new ConfigObj(path.join(__dirname, './config.js'));
var RestApi = require('json-rest-api').RestApi;
var asyncerr = require('async-err').asyncerr;
var inspect = util.inspect;

util.inherits(RoleBase, events.EventEmitter);
exports.RoleBase = RoleBase;

/**
 * Base class for worker and master, used to prevent code duplication for ease
 * of maintenance.
 * @param {String} role The name of the role 'worker', 'master' or 'tracker'
 * @param {Object} [config] Optional parameter with configuration information.
 */
function RoleBase(role) {
  var self = this;

  // check the role parameter for correctness
  if (!is.str(role))  return debug('Bad type for role param: '+typeof role);
  if (role !== 'worker' && role !== 'master')
    return debug('RoleBase contructor, bad role: '+role+', returning.');

  self.role = role;        // our role in this network.
  self.nodes = {};         // storage for storage of discovered nodes
  self.nodes.worker = {};  // local storage for all discovered workers
  self.nodes.master = {};  // local storage for all discovered masters

  // The data we announce to all the other nodes.
  self.data = {
    role: self.role,
    port: self.port,
    restApiPort: self.restApiPort
  };

  // create a REST API upon which, we can receive commands
  self.createRestApi(function(err) {
    if (err)  return debug('Error creating REST API: '+inspect(err));

    // reference the singleton Discovery object
    self.Discovery = Discovery;

    // set the announcement interval and then announce this instance
    var annInterval = self.options.annInterval ? self.options.annInterval :
      Config.get('rolebase.annInterval', 1000);
    Discovery.announce(self.role, self.data, annInterval);

    // Handle the Discovery available event
    Discovery.on('available', function(name, msg, reason) {
      // we only receive messages from other roles ...
      if (msg && msg.data && msg.data.role !== self.role)
        self.available(name, msg, reason);
    });

    // Handle the Discovery unavailable event
    Discovery.on('unavailable', function(name, msg, reason) {
      // we only receive messages from other roles ...
      if (msg && msg.data && msg.data.role !== self.role)
        self.unavailable(name, msg, reason);
    });
  });
}

/**
 * Creates the REST API to receive work.
 * @param {Function} cb A callback to report errors.
 */
RoleBase.prototype.createRestApi = function(cb) {
  var self = this;
  self.RestApi = new RestApi({port: self.restApiPort}, function(err) {

    if (err) return asyncerr(new Error('RestApi Error'+inspect(err)), cb);

    // A simple health check, common to all derived classes.
    self.RestApi.addRoute('get', '/ping', function(req, res) {
      res.json({success: true, pong: 'pong'});
    });

    // add routes if any are present on derived instance
    if (self.addRoutes)  self.addRoutes();
    cb();
  });
};

/**
 * Handle the case where dicovery found something with another role.
 * @param {String} name The name of the service discovered.
 * @param {Object} msg The announcement msg.
 * @param {String} reason Reason for the event to occur.
 */
RoleBase.prototype.available = function(name, msg, reason) {
  var self = this;

  // do type checking, to make sure inputs are ok
  if (!is.nonEmptyStr(name))
    return debug('Error RoleBase.available bad name:', name);

  if (!is.obj(msg) || !is.obj(msg.data) || !is.nonEmptyStr(msg.data.role))
    return debug('Error RoleBase.available bad msg:', msg);

  if (msg.data.role !== 'master' && msg.data.role !== 'worker')
    return debug('Error in RoleBase.available, bad role:',msg.data.role);

  if (!is.nonEmptyStr(reason))
    debug('RoleBase.available had no reason parameter.');

  // create a unique id for each worker/master
  msg.id = msg.addr + ':' + msg.data.restApiPort;

  // Based on the message's data.role add/update it to the right hash object.
  self.nodes[msg.data.role][msg.id] = msg;

  // emit the event for discovered master or worker
  var eventName = msg.data.role + 'Available';
  this.emit(eventName, name, msg, reason);
};

/**
 * Handle the case where discovery found now unavailable.
 * @param {String} name The name of the service discovered.
 * @param {Object} msg The announcement msg.
 * @param {String} reason Reason for the event to occur.
 */
RoleBase.prototype.unavailable = function(name, msg, reason) {

  if (!is.nonEmptyStr(name))
    return debug('Error RoleBase.unavailable bad name:', name);

  if (!is.obj(msg) || !is.obj(msg.data) || !is.nonEmptyStr(msg.data.role))
    return debug('Error RoleBase.unavailable bad msg:', msg);

  if (msg.data.role !== 'master' && msg.data.role !== 'worker')
    return debug('Error in RoleBase.unavailable, bad role: '+
                 inspect(msg.data.role));

  // Not an error, so we don't return.
  if (!is.nonEmptyStr(reason))
    debug('RoleBase.unavailable had no reason parameter.');

  // create a unique id for each worker/master
  msg.id = msg.addr + ':' + msg.data.restApiPort;

  // Based on the message's data.role remove it from the right hash object.
  if (this.nodes[msg.data.role][msg.id])
    delete this.nodes[msg.data.role][msg.id];

  // emit the event for the node that is unavailable
  delete this.nodes[msg.data.role][msg.id];
  var eventName = msg.data.role + 'Unavailable';
  //debug(eventName,name,'reason:',reason, 'msg:',msg);
  this.emit(eventName, name, msg, reason);
};

/**
 * Convenience function to get a worker by id.
 * @param {String} id The string id for the worker.
 * @return {Boolean|Object} False, if not found and the worker object on
 * success.
 */
RoleBase.prototype.getWorker = function(id) {

  if (!this.nodes.worker[id]) {
    debug('RoleBase.getWorker, bad id: '+inspect(id));
    return false;
  }

  return this.nodes.worker[id];
};

/**
 * Convenience function to get a master by id.
 * @param {String} id The string id for the master.
 * @return {Boolean|Object} False, if not found and the master object on
 * success.
 */
RoleBase.prototype.getMaster = function(id) {

  if (!this.nodes.master[id]) {
    debug('RoleBase.getMaster, bad id: '+inspect(id));
    return false;
  }

  return this.nodes.master[id];
};

