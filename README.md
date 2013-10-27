SuperCluster
============

SuperCluster is not ready for use. Many key features have yet to be implemented.

# Overview

SuperCluster is a  module to make it easy to distribute work across multiple
network-connected hosts.

With SuperCluster you can scale past one machine and easily create distributed
applications using Node.js. The goal is ease-of-use for the common case with
little or no configuration. Supercluster enables less common cases with a
minimum of configuration and set-up.

For example, if you were using SuperCluster where all hosts are on the same
subnet, there is no configuration required. However, if your hosts are on AWS,
Rackspace or spread-out to random points on the Internet, some configuration is
neccessary to enable discovery.

Discovery is implemented using
[sc-discovery](https://github.com/strongloop/sc-discovery "github repo for
sc-discovery") which currently has two transports: HTTP and UDP multicast.
Additionally, when hosts announce themselves, they can include user-data to
describe the service the worker provides.

## Proposed features

* A simple master/worker relationship where masters send work to workers.
* Ability to discover hosts with events regarding status.
* Ability to send work to workers that can be:
  * a function
  * a file of JavaScript
  * a repository in GitHub
* Asynchronous replies from workers with standard out, standard error and exit
  code for work done.
* A global event bus
* Ability to send tasks to a single worker, all workers, or a set of workers
  matching a query.

## Current Status

The following are functional, but not stable and fully-tested:

* master/worker interfaces
* tasks representating functions, files and repos are done and work
* UDP multicast discovery
* master receives reply from worker on all task types
* can send a task to 1 worker or all workers

To be done:

* global event bus
* HTTP-based discovery for wide-area networkes spanning NATs
* TLS support and security
* Tracker for HTTP-based discovery.

## How it Works

### Discovery

#### Overview
SuperCluster has three factory methods to create masters, workers and trackers.
The master and worker map to their counterparts in cluster. The tracker exists
to enable discovery of hosts on separate networks. The tracker is not needed if
all SuperCluster hosts are on the same subnet.

1. SuperCluster.createMaster\(\[confObj\]\) - construct master object
2. SuperCluster.createWorker\(\[confObj\]\) - construct worker object
3. SuperCluster.createTracker\(\[confObj\]\) - construct tracker object

When creating masters or workers, in the default case with no configuration, you
implicitly create a singleton object, doing 2 things:

1. Announcing presence via UDP broadcast, identifying its role
   \(default port 44201\)
2. Listen to the port for announcements. Workers look for masters and
   masters look for workers.

By creating the master, worker or tracker, the node process implcitly joins the
node network. 

If the worker or tracker configuration specifies a tracker, a different
set of actions occurs:

1. The configuration of workers and masters has the IP address and port of the
   tracker.
1. Masters and workers announce themselves to the tracker over HTTP using the
   tracker's REST API.
2. Masters and workers receive annoucements by querying the tracker's REST API.

The announcements received by masters and workers happen implicity. When
trackers are in use, a singleton still exists, but this time rather than relying
on UDP broadcast packets for discovery, it queries the tracker using HTTP  and
announcements result from the responses of the tracker.

#### Dicovery Events

Regardless if HTTP or UDP broadcast packets are the means of discovery,
developers receive notice of discovery through events. The events exist for the
developer to take additional action; when a master discovers workers, tasks can
be sent to that worker with no action required by the developer.

The events need not be handled. They exist for customization. For example, a
master may, on workerAvailable, send a task right away to the worker or it may
simply send work to all workers and ignore the event.

##### Master

* 'workerAvailable' - A worker available for work was found
  * arg: Worker - a worker object, including an id for the worker.
* 'workerUnavailable' - The woker was lost.
  * arg: worker id - The id of the worker that is now unavailable.

##### Worker

* 'masterAvailable' - master available to give work
  * arg: Master - a master object, including id for the master.
* 'masterUnavailable' - master was lost, it's now unavailable.
  * arg: master id The id of the master object.

##### Tracker

* 'masterAvailable' - master available to give work
  * master object
* 'masterUnavailable' - master unavailable to give work
  * master id
* 'workerAvailable' - worker available for work was found
  * worker object
* 'workerUnavailable' - worker now unavailable for work
  * worker id

If using the tracker or not, the event 'workerAvailable' is how workers are
found. Though the tracker has a REST API, its use internal and is not a
developer-facing API.

#### Trackers

Typically, broadcast packets aren't routed. Should you need to cross subnets,
with hosts in the same SuperCluster, you'd pass to the factory method for
workers and masters, a tracker DNS/IP and a port. Then, the discovery uses
tracker-based where workers and masters query the tracker's REST API to discover
other workers and masters.

If workers or masters have a tracker object in their configurations, then the
announcement packets are sent to trackers via an HTTP POST operation. In the
case where trackers are used, discovery happens over HTTP.

The tracker configuration for the master or worker:

    confObj.tracker = {
      addr: DNS|IP,
      port: number,   // default is 44201
      bindTo: IP      // optional, default is INADDR_ANY
    };

The tracker's configuration would be:

    confOb = {
      port: number,   // optional, default is 44201
      bindTo: IP      // optional, default is INADDR_ANY
    };

Masters and workers will, if configured with a tracker, periodically announce
their presence and in response, receive a list or workers and masters.

Trackers have a REST API to answer what workers and master are available,
"/hostsAvailable" which responds with JSON:

    { "masters": [
        { addr: IP, port: port, data: dataObj } ],
      "workers": [
        { addr: IP, port: port, data: dataObj },
        { addr: IP, port: port, data: dataObj } ] }

The data object shown in the JSON response is a user-configurable object that
workers can optionally add to their announcements. One use is for selection of
workers by available resources, specified in the worker configuration.

The data configuration for the master or worker:

    confObj.data = {
      str: 'Hello world!'
    };

As shown in the previous object, data can be anything representable in JSON.

In the general case, with groups of masters and workers on the same subnet,
no configuration is necessary. However, for workers and masters on different
subnets can use a tracker for discovery by:

1. Instantiating a tracker
2. Instantiatiang workers and masters configured to use the tracker.

To create the tracker::

    var SuperCluster = require('supercluster');
    // tracker listening on port 44201 bound to INADDR_ANY (the defaults)
    var tracker = SuperCluster.createTracker();

The worker:

    var SuperCluster = require('supercluster');
    var config = {
      tracker: { addr: 'tracker.mynet.com' }
    };
    var tracker = SuperCluster.createWorker(config);

The master:

    var SuperCluster = require('supercluster');
    var config = {
      tracker: { addr: 'tracker.mynet.com' }
    };
    var master = SuperCluster.createMaster(config);
    var f = function() { return 1+1; };
    // send task to any available worker
    master.sendTaskTo(undefined, f, function(err, data) {
      if (err) { // handle error }
      console.log('1+1=', data);
    });

In the previous example, masters and workers periodically contact (default is
every 3 seconds) the tracker's API end-point: "/hostsAvailable". This happens as
a result of construction with a tracker in the options. The dicovered hosts are
communicated by the previously described events for discovery.

## How Work is Distributed

Masters distribute work to the workers. There are two interfaces for work
disrtibution. One has a master send a task to all or a single worker. The other
has a query that works on the data portion each worker sends in its
configuration. For each host where the query is true, that host will receive the
task.

### Master Work Interface

Master Events
* Event: 'workerTaskComplete' The task is complete on the remote host.
  * worker object
  * task object

Master API
* master.msgTo\(query|worker|\[workers\], 'event', \[dataObj,\]\) Send a
  message with optional data to a worker or an array or workers.
* master.msgToAll\('event', \[dataObj,\]\) - Send message to all workers.
* sendTaskTo\(query|worker|\[workers\], TaskObj|Function, cb(err,
  results\[\]\) Send a task to a worker or, array of workers, or to all
  workers resulting from a query.
* sendTaskToAll\(TaskObj|Function, cb(err, results\[\]\) Send a task to all
  workers, the results or error arrive in the callback.

### Worker Work Interface

The work events are largely informational. Developers do not have to listen for
these events unless they want to do something in addition to what nnet already
does.

Event: 'taskReceived' - This worker now has work.
  * master object
  * task object

Class Worker
* sendToMaster\('event', \[data\]\) - send an event with optional data to the
  master.
* sendTo\(worker|\[wrk1,wrk2,...\]|query, 'event', \[data\]\) - send a single
  worker or an array or workers or all workers matching a query, a message with
  optional data.
* sendToAll\('event', \[data\]\) - send an event to all workers with optional
  data.
* setAvailability\(Boolean\) - Allows a worker to remove itself from the list
  of available workers if false and to re-enter the list if true.

## Tasks
Tasks are abstractions to describe work to be done on remote machines and the
dependencies to do the work. A task can be substituted with a function that runs
in the worker's process space. Use a task if your code has dependencies, like
npm modules you require or the code you want to execute has multiple files.

To create a task, you must set-up a task object. The following is an explanation
of the task properties with their meanings:

For a task describing a file to remotely execute:

    var task = {
      type: 'file',
      fileName: 'exFile.js',
      args: [ '--port', 9997, '--restApiPort', 44400 ],
    };

For a task descring a repository in github:

    var task = {
      type: 'github',
      user: 'strongloop',
      repo: 'slc',
      dir: '/tmp',
      cmds: {
        pre: [
          { cmd: 'git', args: ['checkout', 'v1.1'] },
          { cmd: 'npm', args: ['install'] },
        ],
        cmd: { cmd: './bin/slc', args: ['help'] }
      }
    };


## Simplest example:
The simplest example is a worker and a master on the same network.

worker:

    var supercluster = require('supercluster');
    var worker = supercluster.createWorker();

master:

    var master = require('supercluster').createMaster();
    master.on('workerAvailable', function(name, worker) {
      master.sendTo(worker, function() { console.log('Hello World');
    });

