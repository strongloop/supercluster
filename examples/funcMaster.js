'use strict';
var MasterExp = require('../lib/Master');
var Master = new MasterExp.Master();
var debug = require('debug')('sc:example:master');
var inspect = require('util').inspect;

var f = function(a,b,c) { console.log('Hello %s %s!',a,b); return c; };
var args = ['distributed', 'world', 'hmm'];

Master.on('workerTaskComplete', function(task) {
  debug('workerTaskComplete task:'+inspect(task));
  //debug('workerTaskComplete task:',task,'worker:',worker,'result:',result);
  //debug('workerTaskComplete task:',task,'worker:',worker,'result:',result);
  //debug('workerTaskComplete task:',task,'worker:',worker,'result:',result);
});

Master.on('workerAvailable', function(name, worker) {
  //debug('workerAvailable', name, worker, reason);

  Master.taskWorker(worker, f, args, function(err, res, body) {
    if (err) return debug('Error on taskWorker',err);
    debug('Work complete: ',body);
  });
});

Master.on('workerUnavailable', function(name, workerId) {
  debug('workerUnavailable', name, workerId);
});
