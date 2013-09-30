'use strict';
var WorkerExp = new require('../lib/Worker');
var Worker = new WorkerExp.Worker();
var debug = require('debug')('sc:example:worker');
var data = { role: 'worker' };

Worker.on('masterAvailable', function(name, msg, reason) {
  debug('masterAvailable', name, msg, reason);
});

Worker.on('workerUnavailable', function(name, msg, reason) {
  debug('workerUnavailable', name, msg, reason);
});
