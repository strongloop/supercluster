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
