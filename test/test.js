// Copyright IBM Corp. 2013. All Rights Reserved.
// Node module: supercluster
// This file is licensed under the MIT License.
// License text available at https://opensource.org/licenses/MIT

var assert = require('assert');
var RestApi = require('../lib/RestApi').RestApi;
var request = require('request');

describe('RestApi', function() {
    it('Should repond to test route added.', function(cb) {
        var RestServer = new RestApi(undefined, function(err) {
          RestServer.addRoute('/test', function(req, res) {
            res.writeHead(200, {'Content-Type': 'text/html; charset=utf-8'});
            res.end('<p>This is a test.</p>\n');
          });

          request('http://127.0.0.1:44401/test', function (error, response, body) {
            if (!error && response.statusCode == 200) {
              console.log(body); // Print the google web page.
              cb();
            }
          });
        });
    });
});

