'use strict';
var MasterExp = require('../lib/Master');
var Master = new MasterExp.Master();
var data = { role: 'master' };

Master.Discovery.announce('master', data, 1000, true);

Master.on('workerAvailable', function(name, msg, reason) {
  console.log('workerAvailable', name, msg, reason);
});

Master.on('workerUnavailable', function(name, msg, reason) {
  console.log('workerUnavailable', name, msg, reason);
});
