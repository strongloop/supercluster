'use strict';
var MasterExp = require('../lib/Master');
var Master = new MasterExp.Master();
var data = { role: 'master' };
Master.Discovery.announce('master', data, 1000, true);
