/**
 * @fileOverview 
 * The Worker object in SuperCluster is responsible for taking tasks from 
 * Masters, completing the tasks and reporting back the results.
 * When SuperCluster is required, the discovery begins.
 */
'use strict';
//var net = require('net');
var util = require('util');
var events = require('events');
//var debug = require('debug')('sc-master');
//var is = require('is2');
var Discovery = new require('./discovery').Discovery;
console.log('typeof Discovery', typeof Discovery);
console.log('Discovery', Discovery.port);

util.inherits(Worker, events.EventEmitter);
exports.Worker = Worker;

function Worker() {

  var self = this;
  self.data = { role: 'worker' };
  self.Discovery = Discovery;

  // master-pid-IP
  self.Discovery.announce('worker', self.data, 1000);

  self.Discovery.on('available', function(name, data, reason) {
    if (data.role === 'master')
      self.available(name, data, reason);
  });

  self.Discovery.on('unavailable', function(name, data, reason) {
    if (data.role === 'master')
      self.unavailable(name, data, reason);
  });
}

Worker.prototype.available = function(name, data, reason) {
  console.log('Available:',name,':','available:',reason, 'Data:',data);
};

Worker.prototype.unavailable = function(name, data, reason) {
  console.log('Unavailable:',name,':','available:',reason, 'Data:',data);
};


