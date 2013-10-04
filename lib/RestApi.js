/**
 * @fileOverview
 * Implements a simple REST api in an object. Use is for workers/masters to 
 * receive tasks/results from masters/workers.
 */
'use strict';
var http = require('http');
var debug = require('debug')('sc:restapi');
var url = require('url');
var util = require('util');

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

  // create teh http server object and on every request, try to match the
  // request with a known route. If there is no match, return a 404 error.
  self.HttpServer = http.createServer(function(req, res) {
    var uriPath = url.parse(req.url).pathname;

    // try to match the request & method with a handler
    for (var path in self.routes[req.method]) {
      debug('adding path:',path);
      if (path === uriPath) {
        self.routes[req.method][path](req, res);
        return;
      }
    }

    // no match was found, return a 404 error.
    res.writeHead(404, {'Content-Type': 'application/json; charset=utf-8'});
    res.end('{status:404, message:"Content not found."}', 'utf8');
  });

  self.HttpServer.listen(self.port, self.bindTo, function(err) {
    if (err) {
      if (cb)  cb('RestApi error:'+util.inspect(err));
      return;
    }
    debug('REST API listening on port:', self.port);
    if (cb)  cb();
  });
}

/**
 * Add a route along with a function to run.
 * @param {String} verb HTTP verb for route.
 * @param {String} path A valid URI path.
 * @param {Function} fun A function to tun when teh path executes.
 */
RestApi.prototype.addRoute = function(verb, path, func) {
  var httpVerb = verb.toUpperCase();
  debug('Adding: '+httpVerb+' '+path);
  if (!this.routes[httpVerb])  this.routes[httpVerb] = {};
  this.routes[httpVerb][path] = func;
};

