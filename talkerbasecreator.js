function createTalkerBase(lib) {
  'use strict';

  var q = lib.q,
    PING_PERIOD = 10*lib.intervals.Second;

  function TalkerDestructor (talker) {
    this.talker = talker;
    this.counter = 0;
    this.check();
  }
  TalkerDestructor.prototype.destroy = function () {
    this.counter = null;
    this.talker = null;
  };
  TalkerDestructor.prototype.check = function () {
    if (!this.talker) {
      return;
    }
    if (!this.talker.clients) {
      return;
    }
    if (this.talker.clients.count>0) {
      this.destroy();
      return;
    }
    this.counter++;
    if (this.counter>2) {
      //console.log('TalkerDestructor destroying', this.talker.id);
      this.talker.destroy();
      this.destroy();
      return;
    }
    //console.log('TalkerDestructor destroying NOT', this.talker.id, 'because counter', this.counter);
    lib.runNext(this.check.bind(this), PING_PERIOD);
  };
  var _id = 0;
  function TalkerBase() {
    /*
    this.id = process.pid+'_'+(++_id);
    //console.trace();
    console.log('new', this.constructor.name, this.id);
    this.logEnabled = false;
    */
    lib.ComplexDestroyable.call(this);
    this.clients = new lib.Map();
    this.pendingDefers = new lib.DeferMap();
    this.futureOOBs = new lib.Map();
    this.destructor = null;
  }
  lib.inherit(TalkerBase, lib.ComplexDestroyable);
  TalkerBase.prototype.__cleanUp = function () {
    var futures = this.futureOOBs, pendingDefers = this.pendingDefers, clients = this.clients; 
    this.futureOOBs = null;
    this.pendingDefers = null;
    this.clients = null;
    if (this.pingWaiter) {
      lib.clearTimeout(this.pingWaiter);
    }
    if (futures) {
      lib.containerDestroyAll(futures);
      futures.destroy();
    }
    if (pendingDefers) {
      pendingDefers.destroy();
    }
    if (clients) {
      lib.containerDestroyAll(clients);
      clients.destroy();
    }
    lib.ComplexDestroyable.prototype.__cleanUp.call(this);
  };
  function deathTeller(client, session) {
    client.onOOBData([session, '-', true]);
  }
  TalkerBase.prototype.startTheDyingProcedure = function () {
    this.clients.traverse(deathTeller);
  };
  /*
  function sessionprinter(client, session) {
    console.log(session);
  }
  */
  TalkerBase.prototype.dyingCondition = function () {
    if (!this.clients) {
      return true;
    }
    //console.log('TalkerBase', this.id, this.clients.count > 0 ? 'cannot' : 'can', 'die', this.clients.count);
    //this.clients.traverse(sessionprinter);
    if (this.clients.count < 1) {
      this.log(this.id, process.pid, 'can die', this.clients.count);
    }
    return this.clients.count < 1;
  };
  TalkerBase.prototype.isUsable = function () {
    return !!this.clients;
  };
  TalkerBase.prototype.add = function (client) {
    if (this.__dying) {
      console.error('already dying, cannot add more Clients');
      if (this.__dyingException) {
        return q.reject(this.__dyingException);
      } else {
        return q(null);
      }
    }
    if (!client.identity) {
      return q(null);
    }
    var cid = lib.uid();
    client.identity.talkerid = cid;
    this.clients.add(cid, client);
    if (this.destructor) {
      this.destructor.destroy();
    }
    this.destructor = null;
    //console.log(this.id, 'after add has', this.clients.count, 'clients');
    this.log(this.id, process.pid, 'adding', cid, this.clients.count, this.clients.get(cid) ? 'ok' : 'nok');
    return this.transfer(client, null, true).then(
      this.onClientIntroduced.bind(this,cid)
    );
  };
  TalkerBase.prototype.remove = function (client) {
    if (!this.clients) {
      return;
    }
    if (!client.identity.talkerid) {
      return;
    }
    var c = this.clients.remove(client.identity.talkerid);
    //console.log(this.id, 'after remove has', this.clients.count, 'clients');
    if (!c) {
      console.trace();
      console.error(process.pid, 'nothing on', this.id, 'for', client.identity.talkerid);
      console.error(this.clients.count, 'current clients');
      console.error(client);
    }
    this.maybeDie();
    this.startNewSelfDestruction();
  };
  TalkerBase.prototype.startNewSelfDestruction = function () {
    if (!(this.destructor && this.destructor.talker === this)) {
      this.destructor = new TalkerDestructor(this);
    }/* else {
      console.log('did NOT start new TalkerDestructor because I already have', this.destructor);
    }*/
  };
  TalkerBase.prototype.onClientIntroduced = function (cid, introduce) {
    var c, future;
    if (!this.clients) {
      return;
    }
    if (introduce && introduce.session) {
      c = this.clients.remove(cid);
      if (c) {
        future = this.futureOOBs.remove(introduce.session);
        c.identity.talkerid = introduce.session;
        this.clients.add(introduce.session, c);
        if (future) {
          future.drain(c.onOOBData.bind(c));
          c = null;
          future.destroy();
        }
      } else {
        console.error('no client for', cid, '?');
      }
      return introduce;//q(introduce);
    } else {
      c = this.clients.get(cid);
      if (c) {
        c.onOOBData([cid, '-', true]);
      }
    }
  };
  TalkerBase.prototype.transfer = function(client, content, introduce){
    var did = lib.uid(),
      d = this.pendingDefers.defer(did),
      tia = client.identity.toIntroduceArray();
    if (introduce) {
      //console.log('+++', did, 'introduce');
      this.send([did, tia]);
    } else {
      /*
      try {
        //console.log('+++', did, JSON.stringify(content), 'from', tia);
      }
      catch (e) {
        //console.log('+++', did, 'some internal object');
      }
      //this.reportDefers(did);
      */
      this.send([did, tia, content]);
    }
    return d.promise;
  };
  TalkerBase.prototype.onIncoming = function(incoming){
    //console.log('onIncoming', incoming);
    var oob, oobsession, client, future, clientid;
    if (!(this.pendingDefers && this.clients)) {
      return;
    }
    if(!lib.isArray(incoming)){
      console.log(this.type, 'rejecting', incoming);
      return;
    }
    if (incoming[0] === '?') {
      console.log(incoming);
    }
    switch(incoming[0]) {
      case 'r': 
        if (incoming[1] === '?') {
          console.trace();
          console.log(process.pid, this.subType, 'wtf?', incoming);
        }
        var pdc;
        if (incoming[2] === 'dead') {
          pdc = this.pendingDefers._map.count;
        }
        //console.log('---', incoming[1]);
        this.pendingDefers.resolve(incoming[1], incoming[2]);
        /*
        this.reportDefers('after resolve '+incoming[1]);
        if (incoming[2] === 'dead' && this.pendingDefers._map.count !== pdc-1) {
          console.log('Defer', incoming[1], 'was not resolved');
          process.exit(1);
        }
        */
        break;
      case 'e':
        //console.log('---', incoming[1]);
        this.pendingDefers.reject(incoming[1], incoming[2]);
        //this.reportDefers('after reject '+incoming[1]);
        break;
      case 'n':
        this.pendingDefers.notify(incoming[1], incoming[2]);
        break;
      case 'oob':
        oob = incoming[1];
        oobsession = oob[0];//oob['.'];
        client = this.clients.get(oobsession);
        if (client) {
          if (client.identity.talkerid !== oobsession) {
            console.error(client.identity.talkerid, '<>', oobsession, '?');
          }
          client.onOOBData(oob);
        } else {
          future = this.futureOOBs.get(oobsession);
          if (!future) {
            future = new lib.Fifo();
            this.futureOOBs.add(oobsession, future);
          }
          future.push(oob);
        }
        break;
      case '?':
        console.log('pong?', incomming);
        this.send(['!', incoming[1]]);
        break;
      case '!':
        this.processPong(incoming[1]);
        break;
      case 'f':
        //console.log('should forget', incoming[1]);
        clientid = incoming[1] && incoming[1][1] && incoming[1][1][0] ? incoming[1][1][0] : null;
        if (clientid) {
          client = this.clients.get(clientid);
          if (client) {
            client.onOOBData([clientid, '-', true]);
          }
        }
        if (incoming[1] && incoming[1][0]) {
          this.pendingDefers.reject(incoming[1][0], new lib.Error('CLIENT_SHOULD_FORGET', 'Session ID not recognized on the server side, forget yourself'));
        }
        break;
      default:
        console.log('not processed', incoming);
        break;
    }
    //this.onIncomingExecResult(incomingunit);
  };
  var _reportDefersThreshold = 20;
  TalkerBase.prototype.reportDefers = function (title) {
    //return;
    if (this.pendingDefers && this.pendingDefers._map && this.pendingDefers._map.count>=_reportDefersThreshold) {
      console.log(this.constructor.name, title, this.pendingDefers._map.count, 'defers');
    }
    /*
    */
  };
  TalkerBase.prototype.enableLogging = function () {
    this.logEnabled = true;
    var c = this.clients, ca = this.clients.add, cr = this.clients.remove, t = this;
    this.clients.add = function (key) {
      t.log('adding', key);
      return ca.apply(c, arguments);
    };
    this.clients.remove = function (key) {
      t.log('removing', key);
      return cr.apply(c, arguments);
    };
  };
  TalkerBase.prototype.log = function () {
    if (this.logEnabled) {
      var args = [process.pid, this.id].concat(Array.prototype.slice.call(arguments,0));
      console.log.apply(console, args);
    }
  };

  return TalkerBase;
}

module.exports = createTalkerBase;
