// Copyright IBM Corp. 2013. All Rights Reserved.
// Node module: supercluster
// This file is licensed under the MIT License.
// License text available at https://opensource.org/licenses/MIT

console.log('This is standard out.');
console.error('This is standard err');
process.argv.forEach(function (val, index, array) {
    console.log(index + ': ' + val);
});
