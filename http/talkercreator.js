function createHttpTalker (lib, TalkerBase, OuterClientBoundTalkerMixin, signalR) {
  'use strict';

  var qlib = lib.qlib,
    JobOnDestroyableBase = qlib.JobOnDestroyableBase;

  function HttpTalker(connectionstring, address, port, defer) {
    TalkerBase.call(this);
    OuterClientBoundTalkerMixin.call(this, address, port, defer);
    this.underscorer = this.onSignalRUnderscore.bind(this);
    this.closer = this.onSignalRClosed.bind(this);
    this.connectionstring = connectionstring;
    this.sr = new signalR.HubConnectionBuilder()
      .withUrl(this.connectionstring)
      .configureLogging(5) //critical only
      .build();
    this.jobs = new qlib.JobCollection();
    this.setHandlers();
    this.sr.start({withCredentials: false}).then(
      defer.resolve.bind(defer, this),
      this.errorer
    );
  };
  lib.inherit(HttpTalker, TalkerBase);
  OuterClientBoundTalkerMixin.addMethods(HttpTalker);
  HttpTalker.prototype.__cleanUp = function(){
    if (this.jobs) {
      this.jobs.destroy();
    }
    this.jobs = null;
    this.unSetHandlers();
    if (this.sr) {
      this.sr.stop();
    }
    this.sr = null;
    this.connectionstring = null;
    this.errorer = null;
    this.closer = null;
    this.underscorer = null;
    OuterClientBoundTalkerMixin.prototype.destroy.call(this);
    TalkerBase.prototype.__cleanUp.call(this);
  };
  HttpTalker.prototype.send = function (obj) {
    return this.jobs.run('.', new SignalRSendingJob(this, obj));
  };

  HttpTalker.prototype.setHandlers = function () {
    this.sr.on('_', this.underscorer);
    this.sr.onclose(this.closer);
  };
  HttpTalker.prototype.unSetHandlers = function () {
    if (!this.sr) {
      return;
    }
    this.sr.off('_', this.underscorer);
    this.sr.onclose(null); //no way to unset the close handler?
  };

  HttpTalker.prototype.onSignalRUnderscore = function (oobobj) {
    //console.log('HttpTalker onIncoming', oobobj);
    this.onIncoming(oobobj);
  };
  HttpTalker.prototype.onSignalRClosed = function (error) {
    if (this.address && this.port) {
      console.log(process.pid, this.address, this.port, 'HttpTalker closing');
      //this.destroy(error);
      this.destroy(new lib.NoServerError('ws',this.address,this.port));
      return;
    }
    this.destroy();
  };


  //jobs

  function SignalRSendingJob (talker, data, defer) {
    JobOnDestroyableBase.call(this, talker, defer);
    this.talker = talker;
    this.data = data;
  }
  lib.inherit(SignalRSendingJob, JobOnDestroyableBase);
  SignalRSendingJob.prototype.destroy = function () {
    this.data = null;
    this.talker = null;
    JobOnDestroyableBase.prototype.destroy.call(this);
  };
  SignalRSendingJob.prototype._destroyableOk = function () {
    return this.destroyable && this.destroyable.sr;
  };
  SignalRSendingJob.prototype.go = function () {
    var ok = this.okToGo();
    if (!ok.ok) {
      return ok.val;
    }
    this.destroyable.sr.send('allexjs', this.data).then(
			this.onSent.bind(this),
			this.reject.bind(this)
    );
    return ok.val;
  };
  SignalRSendingJob.prototype.onSent = function (error) {
    if (!this.okToProceed()) {
      console.log('nok to proceed');
      return;
    }
    if (error) {
      this.reject(error);
      return;
    }
    this.resolve(true);
  };



  return HttpTalker;

}
module.exports = createHttpTalker;

