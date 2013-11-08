/**
 * @fileOverview
 * Exports the Master and Worker object for easy access in developer code.
 */
'use strict';
exports.modules = {
  Master: require('./lib/Master').Master,
  Worker: require('./lib/Worker').Worker
};

