// Copyright IBM Corp. 2013. All Rights Reserved.
// Node module: supercluster
// This file is licensed under the MIT License.
// License text available at https://opensource.org/licenses/MIT

/**
 * @fileOverview
 * Handles creation of dicovery for the process.
 * When super cluster is required, the discovery begins.
 */
'use strict';
var SCDiscovery = require('sc-discovery').Discovery;
var debug = require('debug')('sc:discwrap');
exports.Discovery = new SCDiscovery();
if (!exports.Discovery)
  debug('Error creating discovery object.');
