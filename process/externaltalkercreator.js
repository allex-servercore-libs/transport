var cp = require('child_process');
var net = require('net');
var fs = require('fs');

function createProcessTalker(lib, PingingTalker, mylib, tcpTalkerFactory) {
  'use strict';

  var _spawned = [];

  function removeSpawned (sp) {
    var spindex = _spawned.indexOf(sp);
    if (spindex>=0){
      _spawned.splice(spindex, 1);
    }
  }

  function killSpawned() {
    _spawned.forEach(function (sp) {sp.kill();})
  }

  process.on('uncaughtException', killSpawned);
  process.on('SIGTERM', killSpawned);
  process.on('SIGINT', killSpawned);

  function ExternalProcessTalker(jstofork, options) {
    PingingTalker.call(this, true);
    mylib.ProcessTalkerMixin.call(this, jstofork, options);
    this.childProcSocket = null;
    this.childProcTalker = null;
  }
  lib.inherit(ExternalProcessTalker, PingingTalker);
  mylib.ProcessTalkerMixin.addMethods(ExternalProcessTalker);
  ExternalProcessTalker.prototype.__cleanUp = function () {
    this.childProcSocket = null;    
    if (this.childProcTalker){
      this.childProcTalker.destroy();
    }
    this.childProcTalker = null;
    mylib.ProcessTalkerMixin.prototype.destroy.call(this);
    PingingTalker.prototype.__cleanUp.call(this);
  };
  ExternalProcessTalker.prototype.onIncoming = function (message) {
    if (!mylib.ProcessTalkerMixin.prototype.onIncoming.call(this, message)) {
      return;
    }
    PingingTalker.prototype.onIncoming.call(this, message);
  };
  ExternalProcessTalker.prototype.cleanProcListeners = function () {
    if (!this.proc) return;
    if (this.destroyer) {
      this.proc.removeListener('exit', this.destroyer);
    }
    removeSpawned(this.proc);
    this.proc.kill();
  };
  ExternalProcessTalker.prototype.makeUpOnCreationArgsFromEnvironment = function (args, env){
    var spawn = env.ALLEX_SPAWN;
    var modulename = spawn.modulename, debug = spawn.debug;
    var path = require('path').dirname(require.resolve(modulename));
    path += '/dotnet//bin/'+(debug ? 'Debug' : 'Release')+'/netcoreapp3.1/'+modulename+'.dll';
    args[0] = path;
  };
  ExternalProcessTalker.prototype.additionalMakeupOnExecArgv = function (execargs, options) {
  };
  ExternalProcessTalker.prototype.doTheCreation = function (jstofork, args, forkoptions) {
    forkoptions.stdio = 'inherit';
    forkoptions.detached = false;
    this.proc = cp.spawn(jstofork, args, forkoptions);
    _spawned.push(this.proc);
    this.proc.on('exit', this.destroyer);
    //this.proc.stdout.on('data', function(data) {console.log('incoming data:', data.toString());});
    //this.proc.stderr.on('data', function(data) {console.log('incoming error:', data.toString());});
    console.log('Spawned child process pid', this.proc.pid);
    this.tryOpenChildPipe();
  };
  ExternalProcessTalker.prototype.tryToSendToProcess = function (data) {
    if (!this.childProcTalker) {
      return false;
    }
    //console.log('send to external', data);
    this.childProcTalker.send(data);
    //console.log('successfully');
    this.dump();
    //this.proc.send(data);
    return true;
  };
  ExternalProcessTalker.prototype.dump = function () {
    this.procq.drain(this.drainer.bind(this));
  };
  ExternalProcessTalker.prototype.drainer = function (item) {
    //console.log('drain to external', item);
    this.childProcTalker.send(item);
  };
  ExternalProcessTalker.prototype.tryOpenChildPipe = function () {
    if (!(this.proc && this.proc.pid)) {
      lib.runNext(this.tryOpenChildPipe.bind(this), 100);
      return;
    }
    var pipename = '/tmp/allexprocess.'+this.proc.pid;
    try {
      fs.accessSync(pipename, fs.constants.R_OK | fs.constants.W_OK);
    } catch(e) {
      lib.runNext(this.tryOpenChildPipe.bind(this), 100);
      return;
    }
    try {
      this.childProcSocket = net.createConnection(pipename, this.onChildPipeOpen.bind(this));
    } catch (e) {
      console.error(e);
      lib.runNext(this.tryOpenChildPipe.bind(this), 100);
      return;
    }
  };
  ExternalProcessTalker.prototype.onChildPipeOpen = function () {
    //this.processPong(Date.now() - 5);
    this.childProcTalker = tcpTalkerFactory(this.childProcSocket, this.onChildTalker.bind(this), false);
    this.childProcTalker.clients = null; //to disable SelfDestructor
    this.established = true;
    this.dump();
  };
  ExternalProcessTalker.prototype.onChildTalker = function (talker, item) {
    //console.log('ParallelProcess sez', item);
    this.onIncoming(item);
  };

  mylib.ExternalProcessTalker = ExternalProcessTalker;
}

module.exports = createProcessTalker;
