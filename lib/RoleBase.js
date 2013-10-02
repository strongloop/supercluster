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

util.inherits(RoleBase, events.EventEmitter);
exports.RoleBase = RoleBase;

/**
 * Base class for worker and master, used to prevent code duplication for ease
 * of maintenance.
 * @param {String} role The name of the role 'worker', 'master' or 'tracker'
 * @param {Object} [config] Optional parameter with configuration information.
 */
function RoleBase(role, config) {
  var self = this;

  self.role = role;
  self.data = {};
  var port;
  var restApiPort;

  if (self.role === 'worker') {
    port = (config && config.port) ? config.port : 9998;
    restApiPort = (config && config.restApiPort) ? config.restApiPort : 44400;
  } else {
    debug('RoleBase constructor received bad role: '+role+', returning.');
    return;
  }

  self.workers = {};  // local storage for all discovered workers
  self.masters = {};  // local storage for all discovered masters
  self.data = {
    role: self.role,
    port: self.port,
    restApiPort: self.restApiPort
  };

  // reference the singleton Discovery object
  self.Discovery = Discovery;

  var annInterval = (config && config.annInterval) ? config.annInterval : 1000;
  Discovery.announce(self.role, self.data, annInterval);

  // Handle the Discovery available event
  Discovery.on('available', function(name, msg, reason) {
    if (msg && msg.data && msg.data.role !== self.role)
      self.baseAvailable(name, msg, reason);
  });

  // Handle the Discovery unavailable event
  Discovery.on('unavailable', function(name, msg, reason) {
    if (msg && msg.data && msg.data.role !== self.role)
      self.baseUnavailable(name, msg, reason);
  });
}

/**
 * Create local config.
 * @param {Object} config A configuratio object.
 * @return {Boolean} true if successful, false otherwise.
 */
RoleBase.prototype.createConfig = function(config) {
  var self = this;
  // if the configuration is an object, try to make a copy of it.
  if (is.obj(config)) {
    try {
      self.config = JSON.parse(JSON.stringify(config));
    } catch(err) {
      debug('RoleBase.createConfig, bad config:',config);
      return false;
    }
  } else {
    self.config = {};
  }
  return true;
};

/**
 * Handle the case where dicovery found something with another role.
 * @param {String} name The name of the service discovered.
 * @param {Object} msg The announcement msg.
 * @param {String} reason Reason for the event to occur.
 */
RoleBase.prototype.baseAvailable = function(name, msg, reason) {
  var self = this;

  if (!is.nonEmptyStr(name)) {
    debug('Error RoleBase.baseAvailable bad name:', name);
    return;
  }

  if (!is.obj(msg) || !is.obj(msg.data) || !is.nonEmptyStr(msg.data.role)) {
    debug('Error RoleBase.baseAvailable bad msg:', msg);
    return;
  }

  // create a unique id for each worker/master
  msg.id = msg.addr + ':' + msg.data.restApiPort;

  /*
  switch(msg.data.role) {
  case 'worker':
    if (!self.workers[msg.id])
      self.workers[msg.id] = msg;
    if (self.workerAvailable)
      self.workerAvailable(msg);
    break;
  case 'master':
    if (!self.masters[msg.id])
      self.masters[msg.id] = msg;
    if (self.masterAvailable)
      self.masterAvailable(msg);
    break;
  default:
    debug('Error in RoleBase.available, bad role:',msg.data.role);
    return;
  }
  */

  // FIXME:  Make configurable for base class
  if (self.available && self.role !== msg.data.role)  self.available(msg);

  // emit the event for discovered master or worker
  var eventName = msg.data.role + 'Available';
  debug(eventName,name,'reason:',reason, 'msg:',msg);
  this.emit(eventName, name, msg, reason);
};

/**
 * Handle the case where discovery found now unavailable.
 * @param {String} name The name of the service discovered.
 * @param {Object} msg The announcement msg.
 * @param {String} reason Reason for the event to occur.
 */
RoleBase.prototype.unavailable = function(name, msg, reason) {
  var self = this;

  if (!is.nonEmptyStr(name)) {
    debug('Error RoleBase.unavailable bad name:', name);
    return;
  }

  if (!is.obj(msg) || !is.obj(msg.data) || !is.nonEmptyStr(msg.data.role)) {
    debug('Error RoleBase.unavailable bad msg:', msg);
    return;
  }

  // create a unique id for each worker/master
  msg.id = msg.address + ':' + msg.data.port;

  switch(msg.data.role) {
  case 'worker':
    if (self.workers[msg.id])
      delete self.workers[msg.id];
    if (self.workerUnavailable)  self.workerUnavailable(msg.id);
    break;
  case 'master':
    if (self.masters[msg.id])
      delete self.masters[msg.id];
    if (self.masterUnavailable)  self.masterUnavailable(msg.id);
    break;
  default:
    debug('Error in RoleBase.unavailable, bad role:',msg.data.role);
    return;
  }

  delete this.workers[msg.id];
  var eventName = msg.data.role + 'Unavailable';
  debug(eventName,name,'reason:',reason, 'msg:',msg);
  this.emit(eventName, name, msg, reason);
};

