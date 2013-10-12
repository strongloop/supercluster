'use strict';
var MasterExp = require('../lib/Master');
var Master = new MasterExp.Master();
var debug = require('debug')('sc:example:master');

var task = {
  type: 'github',
  user: 'strongloop',
  repo: 'slc',
  dir: '/tmp'
  cmds: {
    pre: [
      "npm install"
    ],
    cmd: "./bin/slc help"
  }
};

Master.on('workerTaskComplete', function(task, worker, result) {
  //debug('workerTaskComplete task:',task,'worker:',worker,'result:',result);
});

Master.on('workerAvailable', function(name, worker, reason) {
  //debug('workerAvailable', name, worker, reason);

  Master.taskWorker(worker, task, function(err, res, body) {
    if (err) return debug('Error on taskWorker',err);
    debug('Work complete: ',body);
  });
});

Master.on('workerUnavailable', function(name, workerId, reason) {
  //debug('workerUnavailable', name, workerId, reason);
});
