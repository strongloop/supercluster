'use strict';
var util = require('util');
var MasterExp = require('../lib/Master');
var Master = new MasterExp.Master();
var data = { role: 'master' };
var debug = require('debug')('sc:example:master');

Master.on('workerAvailable', function(name, worker, reason) {
  debug('workerAvailable', name, worker, reason);
  var f = function(a,b,c) { console.log('Hello %s %s!',a,b); return c; };

  Master.sendTaskToWorker(worker, f, ['distributed', 'world', 'hmm'], function(err, res, body) {
    if (err) {
      debug('Error on sendTaskToWorker',err);
      return;
    }
    debug('Work complete: ',body);
  });
});

Master.on('workerUnavailable', function(name, workerId, reason) {
  debug('workerUnavailable', name, workerId, reason);
});
