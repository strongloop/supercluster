SuperCluster
============

# SuperCluster Overview

A module to make it easy to distribute work across multiple network-connected
hosts.

SuperCluster is a means to scale past one machine and easily create distributed
applications using Node.js. The goal is ease-of-use for the common case with
little or no configuration. Supercluste enables less common cases with a minimum
of configuration and set-up.

For example, if you were using SuperCluster where all hosts are on the same
subnet, there is no configuration required. However, if your hosts are AWS or
Rackspace or spread-out to random points on the Internet, some configuration is
neccessary to enable discovery.

The inspirations for SuperCluster are:

1. hook.io - global event bus
2. cluster - master/worker model & events for coordination

## Proposed features

* Ease of use for the common cases with minimal or no setup
  * Auto discovery for hosts on the same sub-net (i.e. no routes between hosts)
  * 1-line config for discovery of hosts on separate networks
  * Enable less common cases with 1-2 lines of code/config
* Ability to distribute workload across many servers
  * Control enforced by the master
  * An event bus that works across networks - events can have data
* Master can communicate tasks with dependecies that workers can
  self-setup, through `git clone` and `npm install`.

## How it Works

### Discovery

#### Overview
The SuperCluster module has three factory methods for a master, worker and
tracker. The master and worker map to their counter-parts in cluster. The
tracker exists to enable discovery of hosts on separate networks. The tracker is
not needed, however, if all SuperCluster hosts are on the same sub-net.

1. SuperCluster.createMaster\(\[confObj\]\) - construct master object
2. SuperCluster.createWorker\(\[confObj\]\) - construct worker object
3. SuperCluster.createTracker\(\[confObj\]\) - construct tracker object

When creating masters or workers, in the default case with no configuration, you
implicitly create a singleton object, doing 2 things:

1. Announce its presence via UDP broadcast, identifying its role
   \(default port 44201\)
2. Listen to the port for announcements. Workers look for masters and
   masters look for workers.

By creating the master, worker or tracker, the node process implcitly joins the
node network. A config option exists to prevent this behavior, but the default
is to join upon creation.

If the worker or tracker configuration specifies a tracker, a different
set of actions occurs:

1. Masters and workers announce themselves to the tracker over HTTP using the
   tracker's REST API.
2. Masters and workers receive annoucements by querying the tracker's REST API.

The announcements received by masters and workers happen implicity. When
trackers are in use, a singleton again exists, but this time rather than relying
on UDP broadcast packets for discovery, it queries the tracker and announcements
result from the responses of the tracker.

It's expected that, as use-cases grow in complexity, the configuration will have
more options to enable special-cases. For example, Amazon Web Services (AWS) and
Rackspace will likely have their own solutions for discovery and options to
enable them.

#### Dicovery Events

Regardless if trackers or UDP broadcast packets are the means of discovery,
developers receives notice of discovery through events. The events exist for the
developer to take additional action; when a master discovers workers, tasks can
be sent to that worker with no action required by the developer.

##### Master

* 'workerAvailable' - A worker available for work was found
  * arg: worker object, including an id for the worker.
* 'workerUnavailable' - The woker was lost.
  * arg: worker id

##### Worker

* 'masterAvailable' - master available to give work
  * arg: master object
* 'masterUnavailable' - master heartbeat lost, perhaps it died?
  * arg: master object

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
workers and masters, a tracker DNS|IP and, optionally a port. Then, the
signalling switches to tracker-based where workers and masters query the
tracker's REST API to discover other workers and masters.

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
workers can optionally add to their announcements. One possible use might be for
selection of workers by available resources, specified in the worker
configuration.

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

In the previous example, masters and workers will not use broadcast packets for
discovery, but instead periodically contact (every 3 seconds) the tracker's API
end-point: "/hostsAvailable". This happens implictly as a result of construction
and the dicovered hosts are communicated through to the developer by the
previously described events for discovery.

What about race conditions with discovery events? The discovery events are
buffered with a TTL (as set by the sender). If you construct a master, a worker
available event arrives first, and then you add the on 'workerAvailable' event,
the event still arrives.

## How Work is Distributed

Masters distribute work to the workers. There are two interfaces for work
disrtibution. One has a master send a task to all or a single worker. The other
has a query that works on the data portion each worker sends in its
configuration. For each host where the query is true, that host will receive the
task.

### Master Simple Work Interface

* Master Events
  * Event: 'workerTaskConfigComplete'' Describes when the task configuration,
    i.e. `git pull <whatever>` and `npm install` are complete and the task is
    ready to run on the remote host.
    * worker object
    * task obj
  * Event: 'workerTaskReceived' The worker received the task.
    * worker object
    * task obj
  * Event: 'workerProgress' Workers can send optional progress events.
    Developers must have to decidee what % of work is done.
    * worker object
    * % complete \(0.0-1.0\)
  * Event: 'workerTaskComplete' The task is complete on the remote host.
    * worker object
    * task object

  * Master API
    * master.msgTo\(query|worker|\[workers\], 'event', \[dataObj,\]\) Send a
      message with optional data to a worker or an array or workers.
    * master.msgToAll\('event', \[dataObj,\]\) - Send message to all workers.
    * sendTaskTo\(query|worker|\[worker\], TaskObj|Function, cb(err,
      results\[\]\) Send a task to a worker or, array of workers, or to all
      workers resulting from a query.
    * sendTaskToAll\(TaskObj|Function, cb(err, results\[\]\) Send a task to all
      workers, the results or error arrive in the callback.

### Worker Work Interface

The work events are largely informational. Developers do not have to listen for
these events unless they want to do something in addition to what nnet already
does.

* Event: 'taskReceived' - This worker now has work.
  * master object
  * task object
* Class Worker
  * sendToMaster\('event', \[data\]\) - send an event with optional data to the
master.
  * sendTo\(worker|\[wrk1,wrk2,...\], 'event', \[data\]\) - send a single worker
    or an array or workers a message with optional data.
  * sendToAll\('event', \[data\]\) - send an event to all workers with optional
data.
  * setAvailability\(Boolean\) - Allows a worker to remove itself from the list
    of available workers if false and to re-enter the list if true.
  * setProgress\(percent\) - Optional convenience function to send a progress
message to the master.

## Task Object
Tasks are abstractions to describe work to be done on remote machines and the
dependencies to do the work. In most cases, a task can be substituted with a
function. Use a task if your code has dependencies, like npm modules you require
or the code you want to execute has multiple files.

Task Data members of task with their meanings:

    {
      name: "TaskName",

      // a package.json for the Task
      // `npm install` will be run after the package.json is saved.
      package_json: {
      {
        respository: {
          type: "git",
          url: "git://github.com/hookio/hook.io.git"
        },
        [...]
      },

      run: {
        file: "filePath",
        function: "function",
        args: ARRAY,
        cwd: "path",
      },

      deleteWhenDone: false,    // true by default

      // after completion, will have:
      result: {
        exitCode: 0,
        error: "String",
        errno: num,
        data: {}      // user defined
      }
    }

## Simplest example:
The simplest example is a worker and a master on the same network.

worker:

    var nnet = require('nnet');
    var worker = nnet.createWorker();

master:

    var master = require('nnet').createMaster();
    master.on('workerAvailable', function(worker) {
      master.sendTo(worker, function() { console.log('Hello World');
    });
