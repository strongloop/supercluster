/**
 * @fileOverview
 * Handles dicovery for Masters and Workers.
 *
 * When super cluster is required, the discovery begins.
 */
'use strict';
var SCDiscovery = require('sc-discovery').Discovery;
var Discovery;

var initialized = false;
if (initialized === false)  {
  scDiscoveryInit();
  console.log('created discovery obj');
} else {
  console.log('did not create discovery obj');
}

/**
 * Initailzies a single instance of Discovery - we can have only 1, as it binds
 * a port to a socket.
 */
function scDiscoveryInit() {
  if (initialized)  return;

  // Discovery is a singleton
  Discovery = new SCDiscovery();
  initialized = true;
}

exports.Discovery = new SCDiscovery();
