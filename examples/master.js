'use strict';
var MasterExp = require('../lib/Master');
var Master = new MasterExp.Master();
var data = { role: 'master' };

Master.on('workerAvailable', function(name, worker, reason) {
  console.log('workerAvailable', name, worker, reason);
  var f = function() { console.log('Hello distributed world!'); };

  Master.sendTaskToWorker(worker, f, [], function(err, res, body) {
  });
});

Master.on('workerUnavailable', function(name, workerId, reason) {
  console.log('workerUnavailable', name, workerId, reason);
});
