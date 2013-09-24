/**
 * @fileOverview 
 * Created the MAster API. The Master object in SuperCluster is responsible for
 * distrubting work to workers.
 *
 * When super cluster is required, the discovery begins.
 */
'use strict';
//var net = require('net');
var util = require('util');
//var events = require('events');
//var debug = require('debug')('sc-master');
//var is = require('is2');
//var Discovery = require('./discovery').Discovery;
var RoleBase = require('./RoleBase').RoleBase;

util.inherits(Master, RoleBase);
exports.Master = Master;

function Master(config) {
  RoleBase.call(this, 'master', config);
}

