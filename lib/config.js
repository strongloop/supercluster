// Copyright IBM Corp. 2013. All Rights Reserved.
// Node module: supercluster
// This file is licensed under the MIT License.
// License text available at https://opensource.org/licenses/MIT

/**
 * @fileOverview
 * A simple way to store a set of constants,
 */

module.exports = {
  validRoles: [ 'master', 'worker' ],
  rolebase: {
    annInterval: 1000,
  },
  master: {
    port: 9999,
    restApiPort: 44402
  }
};
