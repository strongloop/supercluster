'use strict';
var MasterExp = require('../lib/Master');
var Master = new MasterExp.Master();
var debug = require('debug')('sc:example:master');
var inspect = require('util').inspect;

var task = {
  type: 'github',
  user: 'strongloop',
  repo: 'slc',
  dir: '/tmp',
  cmds: {
    pre: [
      { cmd: 'git', args: ['checkout', 'v1.1'] },
      { cmd: 'npm', args: ['install'] },
    ],
    cmd: { cmd: './bin/slc', args: ['help'] }
  }
};

Master.on('workerTaskComplete', function(taskResult) {
  debug('workerTaskComplete taskResult: '+inspect(taskResult));
  debug('workerTaskComplete task: '+inspect(taskResult.task));
  debug('workerTaskComplete worker:'+inspect(taskResult.worker));
  debug('workerTaskComplete master:'+inspect(taskResult.master));

  if (taskResult.result)
    debug('workerTaskComplete result:'+inspect(taskResult.result));

  if (taskResult.err)
    debug('workerTaskComplete err:'+inspect(taskResult.err));
});

Master.on('workerAvailable', function(name, worker, reason) {
  debug('workerAvailable', name, worker, reason);

  Master.taskWorker(worker, task, function(err, res, body) {
    if (err) return debug('Error on taskWorker',err);
    debug('Work complete: ',body);
  });
});

/*
Master.on('workerUnavailable', function(name, workerId, reason) {
  //debug('workerUnavailable', name, workerId, reason);
});
*/
