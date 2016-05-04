// Copyright IBM Corp. 2013. All Rights Reserved.
// Node module: supercluster
// This file is licensed under the MIT License.
// License text available at https://opensource.org/licenses/MIT

'use strict';
var MasterExp = require('../lib/Master');
var Master = new MasterExp.Master();
var debug = require('debug')('sc:example:master');
var inspect = require('util').inspect;

var task = {
  type: 'file',
  fileName: 'exFile.js',
  args: [ '--port', 9997, '--restApiPort', 44400 ],
};

Master.on('workerTaskComplete', function(task) {
  debug('workerTaskComplete task: '+inspect(task,{colors:true,depth:null}));
});

Master.on('workerAvailable', function(name, worker) {
  debug('workerAvailable', name, worker);

  Master.taskWorker(worker, task, function(err, res, body) {
    if (err) return debug('Error on taskWorker',err);
    debug('Work complete: ',body);
  });
});

Master.on('workerUnavailable', function(name, workerId) {
  debug('workerUnavailable', name, workerId);
});
