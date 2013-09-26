/**
 * @fileOverview
 * This file implements a simple REST api in an object. First use is
 * intended for the worker to receive tasks from the masters.
 */
'use strict';
var http = require('http');
var debug = require('debug')('sc-RestApi');
var url = require('url');

exports.RestApi = RestApi;

/**
 * RestApi constructor. Creates the HTTP server objects and starts listening on
 * the socket.
 * @param {Object} A configuration object to configure the RestApi.
 * @constructor
 */
function RestApi(config, cb) {
  var self = this;
  self.routes = {};

  self.bindTo = (config && config.bindTo) ? config.bindTo : undefined;
  self.port = (config && config.port) ? config.port : 44401;

  self.HttpServer = http.createServer(function(req, res) {
    var uriPath = url.parse(req.url).pathname;
    var found = false;
    for (var path in self.routes) {
      if (path === uriPath) {
        self.routes[path](req, res);
        found = false;
      }
    }

    if (!found) {
      res.writeHead(404, {'Content-Type': 'text/html; charset=utf-8'});
      res.end('<p>404 Content Not Found</p>\n');
    }
  });

  self.HttpServer.listen(self.port, self.bindTo, function(err) {
    if (err)
      return cb('RestApi error:'+util.inspect(err));
    debug('REST API listening on port:', self.port);
    cb();
  });
}

/**
 * Add a route along with a function to run.
 * @param {String} path A valid URI path.
 * @param {Function} fun A function to tun when teh path executes.
 */
RestApi.prototype.addRoute = function(path, func) {
  this.routes[path] = func;
};
