const { timeStamp } = require('console');
var os = require('os');

function createProcessTalkerBase(lib, TalkerBase, mylib) {
  'use strict';

  var not2json = {
    'string': true,
    'number': true,
    'boolean': true
  };
  function setEnvVariable(env, variable, variablename) {
    var tov = typeof variable;
    //console.log(variable, 'is of type', tov);
    if (tov in not2json) {
      env[variablename] = variable;
    } else if (tov === 'function') {
      //nothing
    } else {
      env[variablename] = JSON.stringify(variable);
    }
  }

  function ProcessTalkerMixin(jstocreate, options) {
    this.destroyer = this.destroy.bind(this);
    this.incomer = this.onIncoming.bind(this);
    this.proc = null;
    this.procq = new lib.Fifo();
    this.established = false;
    this.prepareCreation(jstocreate, options);
  }
  ProcessTalkerMixin.prototype.destroy = function () {
    this.established = null;
    if (this.procq) {
      this.procq.destroy();
    }
    this.procq = null;
    this.cleanProcListeners();
    this.proc = null;
    this.incomer = null;
    this.destroyer = null;
  };
  ProcessTalkerMixin.prototype.prepareCreation = function (jstocreate, options) {
    if (os.type() === 'Windows_NT'){
      jstocreate = jstocreate.replace(/\//g,'\\');
      if (jstocreate.match(/^[^\\]\\/)){
        jstocreate = jstocreate[0]+':'+jstocreate.substring(1)
      }
    }
    var args=[],
      env = {parentProcessID: process.pid},
      createoptions = {env: env},
      ea = [];
    lib.traverse(process.env, setEnvVariable.bind(null, env));
    if (options) {
      if (options.env) {
        try {
          var oe = JSON.parse(options.env);
          lib.traverse(oe, setEnvVariable.bind(null, env));
          this.makeUpOnCreationArgsFromEnvironment(args, oe);
        } catch (ignore) {}
      }
      this.additionalMakeupOnExecArgv(ea, options);
    }
    createoptions.execArgv=ea;
    this.doTheCreation(jstocreate, args, createoptions);
  };
  ProcessTalkerMixin.prototype.send = function (data) {
    //console.log('ChildProcessClient sending', data);
    if (!this.established) {
      //console.log('unsuccessfully');
      this.procq.push(data);
      return;
    }
    if (!this.tryToSendToProcess(data)) {
      this.procq.push(data);
    }
  };
  ProcessTalkerMixin.prototype.onIncoming = function (message) {
    var e, es, ec;
    if (message.uncaughtException) {
      es = message.uncaughtException.message;
      ec = message.uncaughtException.code;
      if (es.match('Cannot find module')) {
        e = new Error(es);
        e.code = 'MODULE_NOT_FOUND';
      } else {
        if (ec) {
          e = new lib.Error(ec, es);
        } else {
          e = new Error(es);
        }
      }
      this.destroy(e);
      return false;
    }
    if (!this.established) {
      //console.log(this.proc.pid, 'ChildProcessClient', message);
      this.established = this.proc && (parseInt(message.child_init) === this.proc.pid);
      //console.log('established', this.established, '(', this.proc.pid, ')');
      if (this.established) {
        this.dump();
      }
      return false;
    }
    return true;
  };
  ProcessTalkerMixin.prototype.cleanProcListeners = function () {};
  ProcessTalkerMixin.prototype.makeUpOnCreationArgsFromEnvironment = function (args, env) {};
  ProcessTalkerMixin.prototype.additionalMakeupOnExecArgv = function (execargs, options) {};
  ProcessTalkerMixin.prototype.doTheCreation = function (jstocreate, args, createoptions) {};
  ProcessTalkerMixin.prototype.tryToSendToProcess = function (data) {};

  ProcessTalkerMixin.addMethods = function (klass) {
    lib.inheritMethods(klass, ProcessTalkerMixin,
      'prepareCreation',
      'send',
      'cleanProcListeners',
      'makeUpOnCreationArgsFromEnvironment',
      'additionalMakeupOnExecArgv',
      'doTheCreation',
      'tryToSendToProcess'
    );
  };

  mylib.ProcessTalkerMixin = ProcessTalkerMixin;
}
module.exports = createProcessTalkerBase;