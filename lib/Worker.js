/**
 * @fileOverview 
 * The Worker object in SuperCluster is responsible for taking tasks from 
 * Masters, completing the tasks and reporting back the results.
 * When SuperCluster is required, the discovery begins.
 */
'use strict';
//var net = require('net');
var util = require('util');
//var events = require('events');
//var debug = require('debug')('sc-master');
//var is = require('is2');

//var Discovery = new require('./discovery').Discovery;
var RoleBase = require('./RoleBase').RoleBase;

util.inherits(Worker, RoleBase);
exports.Worker = Worker;

function Worker(config) {
  RoleBase.call(this, 'worker', config);
}

