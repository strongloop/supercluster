/**
 * @fileOverview 
 * Created the RoleBase API. The RoleBase object in SuperCluster is responsible for
 * distrubting work to workers.
 *
 * When super cluster is required, the discovery begins.
 */
'use strict';
//var net = require('net');
var util = require('util');
var events = require('events');
var debug = require('debug')('sc-RoleBase');
//var is = require('is2');
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
  var port = (config && config.port) ? config.port : 9999;
  self.workers = {};  // local storage for all discovered workers
  self.data = { role: self.role, port: port };

  // reference the singleton Discovery object
  self.Discovery = Discovery;

  var annInterval = (config && config.annInterval) ? config.annInterval : 1000;
  Discovery.announce(self,role, self.data, annInterval);

  // Handle the Discovery available event
  Discovery.on('available', function(name, msg, reason) {
    console.log('self.role',self.role);
    console.log('msg.data.role',msg.data.role);
    console.log('msg.data.role!==self.role',msg.data.role!==self.role);
    if (msg && msg.data && msg.data.role !== self.role)
      self.available(name, msg, reason);
  });

  // Handle the Discovery unavailable event
  Discovery.on('unavailable', function(name, msg, reason) {
    if (msg && msg.data && msg.data.role !== self.role)
      self.unavailable(name, msg, reason);
  });
}

/**
 * Handle the case where dicovery found something with another role.
 * @param {String} name The name of the service discovered.
 * @param {Object} msg The announcement msg.
 * @param {String} reason Reason for teh event to occur.
 */
RoleBase.prototype.available = function(name, msg, reason) {
  this.workers[msg.addr] = msg;
  var eventName = msg.data.role + 'Available';
  debug(eventName,name,':','available:',reason, 'msg:',msg);
  this.emit(eventName, name, msg, reason);
};

/**
 * Handle the case where discovery found now unavailable.
 * @param {String} name The name of the service discovered.
 * @param {Object} msg The announcement msg.
 * @param {String} reason Reason for teh event to occur.
 */
RoleBase.prototype.unavailable = function(name, msg, reason) {
  var id = msg.addr;
  delete this.workers[id];
  var eventName = msg.data.role + 'Unavailable';
  debug(eventName,name,':','available:',reason, 'msg:',msg);
  this.emit(eventName, name, id, reason);
};

