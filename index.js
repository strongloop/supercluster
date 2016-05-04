// Copyright IBM Corp. 2013. All Rights Reserved.
// Node module: supercluster
// This file is licensed under the MIT License.
// License text available at https://opensource.org/licenses/MIT

/**
 * @fileOverview
 * Exports the Master and Worker object for easy access in developer code.
 */
'use strict';
exports.modules = {
  Master: require('./lib/Master').Master,
  Worker: require('./lib/Worker').Worker
};

