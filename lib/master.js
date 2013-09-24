/**
 * @fileOverview 
 * Created the MAster API. The Master object in SuperCluster is responsible for
 * distrubting work to workers.
 *
 * When super cluster is required, the discovery begins.
 */
'use strict';
//var net = require('net');
var util = require('util');
var events = require('events');
//var debug = require('debug')('sc-master');
//var is = require('is2');
var Discovery = require('./discovery').Discovery;

util.inherits(Master, events.EventEmitter);
exports.Master = Master;

function Master() {

  var self = this;
  self.data = { role: 'master' };
  self.Discovery = Discovery;

  // master-pid-IP
  Discovery.announce('master', self.data, 1000);

  Discovery.on('available', function(name, data, reason) {
    if (data.role === 'worker')
      self.available(name, data, reason);
  });

  Discovery.on('unavailable', function(name, data, reason) {
    if (data.role === 'worker')
      self.unavailable(name, data, reason);
  });
}

Master.prototype.available = function(name, data, reason) {
  console.log('Available:',name,':','available:',reason, 'Data:',data);
};

Master.prototype.unavailable = function(name, data, reason) {
  console.log('Unavailable:',name,':','available:',reason, 'Data:',data);
};



