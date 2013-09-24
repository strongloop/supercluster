'use strict';
var WorkerExp = new require('../lib/Worker');
var Worker = new WorkerExp.Worker();
var data = { role: 'worker' };
Worker.Discovery.announce('worker', data, 1000, true);
