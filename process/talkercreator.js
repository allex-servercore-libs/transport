var cp = require('child_process'),
  os = require('os');

function createProcessTalker(lib, TalkerBase) {
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
  function ProcessTalker(jstofork, options) {
    TalkerBase.call(this);
    this.procq = new lib.Fifo();
    this.destroyer = this.destroy.bind(this);
    if (os.type() === 'Windows_NT'){
      jstofork = jstofork.replace(/\//g,'\\');
      if (jstofork.match(/^[^\\]\\/)){
        jstofork = jstofork[0]+':'+jstofork.substring(1)
      }
    }
    var args = [],
      env = {parentProcessID: process.pid},
      forkoptions = {env: env},
      ea = [];
    lib.traverse(process.env, setEnvVariable.bind(null, env));
    /*
    if (options) {
      args.push.apply(args, options);
    }
    */
    if (options) {
      if (options.env) {
        try {
          var oe = JSON.parse(options.env);
          lib.traverse(oe, setEnvVariable.bind(null, env));
        } catch (ignore) {}
      }
      if (options.debug_brk) {
        ea.push('--debug-brk=' + options.debug_brk);
      } else if (options.debug) {
        ea.push('--debug');
      } else if (options.prof) {
        ea.push('--prof');
      }
    }
    forkoptions.execArgv=ea;
    //console.log('forking', jstofork, args, require('util').inspect(forkoptions, {depth: 6}));
    this.proc = cp.fork(jstofork, args, forkoptions);
    this.incomer = this.onIncoming.bind(this);
    this.proc.on('message', this.incomer);
    this.proc.on('exit', this.destroyer);
    this.established = false;
  }
  lib.inherit(ProcessTalker, TalkerBase);
  ProcessTalker.prototype.__cleanUp = function () {
    this.established = null;
    if (this.destroyer) {
      this.proc.removeListener('exit', this.destroyer);
    }
    if (this.incomer) {
      this.proc.removeListener('message', this.incomer);
    }
    this.incomer = null;
    this.proc = null;
    this.destroyer = null;
    this.procq.destroy();
    this.procq = null;
    TalkerBase.prototype.__cleanUp.call(this);
  };
  ProcessTalker.prototype.send = function (data) {
    //console.log('ChildProcessClient sending', data);
    if (!this.established) {
      //console.log('unsuccessfully');
      this.procq.push(data);
      return;
    }
    if (this.proc.connected) {
      //console.log('successfully');
      this.dump();
      this.proc.send(data);
    }
  };
  ProcessTalker.prototype.onIncoming = function (message) {
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
      this.dieExceptionally(e);
      return;
    }
    if (!this.established) {
      //console.log(this.proc.pid, 'ChildProcessClient', message);
      this.established = (parseInt(message.child_init) === this.proc.pid);
      //console.log('established', this.established, '(', this.proc.pid, ')');
      if (this.established) {
        this.dump();
      }
      return;
    }
    TalkerBase.prototype.onIncoming.call(this, message);
  };
  ProcessTalker.prototype.dump = function () {
    this.procq.drain(this.proc.send.bind(this.proc));
    //this.procq.drain(this.drainer.bind(this));
  };
  ProcessTalker.prototype.drainer = function (item) {
    console.log('need to send', arguments);
    this.proc.send(item);
  };

  return ProcessTalker;
}

module.exports = createProcessTalker;
