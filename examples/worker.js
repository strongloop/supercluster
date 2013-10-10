'use strict';
var argv = require('optimist')
            .default('port', 9998)
            .default('restApiPort', 44401)
            .argv;

var WorkerExp = new require('../lib/Worker');
var options = {
  port: argv.port,
  restApiPort: argv.restApiPort
};

var Worker = new WorkerExp.Worker(options);

var debug = require('debug')('sc:example:worker');
Worker.on('masterAvailable', function(name, msg, reason) {
  //debug('masterAvailable', name, msg, reason);
});

Worker.on('masterUnavailable', function(name, msg, reason) {
  //debug('masterUnavailable', name, msg, reason);
});

Worker.on('workerAvailable', function(name, msg, reason) {
  //debug('workerAvailable', name, msg, reason);
});

Worker.on('workerUnavailable', function(name, msg, reason) {
  //debug('workerUnavailable', name, msg, reason);
});
