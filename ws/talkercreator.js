function createWSTalker(lib, PingingTalker, OuterClientBoundTalkerMixin) {
  'use strict';
  var _WebSocket, StringBuffer = lib.StringBuffer;
  if ('undefined' !== typeof window) {
    if (window.WebSocket) {
      _WebSocket = window.WebSocket;
    } else {
      throw Error('No WebSocket support from the Browser');
    }
  } else {
    _WebSocket = lib.ws;
  }
  function dump(data) {
    return data; //needs more work for the `browserify` in order to use require('util') in the NodeJS case
  }
  function WSTalker(connectionstring, address, port, defer){
    PingingTalker.call(this, true);
    OuterClientBoundTalkerMixin.call(this, address, port, defer);
    try{
    this.connectionstring = connectionstring;
    this.wsock = new _WebSocket(connectionstring);
    this.sendchecker = this.onSend.bind(this);
    this.messager = this.onMessage.bind(this);
    this.opener = defer.resolve.bind(defer, this);
    this.closer = this.onWSClosed.bind(this);
    this.onincomer = this.forIncoming.bind(this);
    this.setHandlers();
    }
    catch(e){
      console.error(e.stack);
      console.error(e);
      this.destroy(e);
    }
  }
  lib.inherit(WSTalker, PingingTalker);
  OuterClientBoundTalkerMixin.addMethods(WSTalker);
  WSTalker.prototype.__cleanUp = function () {
    if(this.wsock){
      this.wsock.close();
      this.unSetHandlers();
    }
    this.onincomer = null;
    this.closer = null;
    this.opener = null;
    this.messager = null;
    this.sendchecker = null;
    this.wsock = null;
    OuterClientBoundTalkerMixin.prototype.destroy.call(this);
    PingingTalker.prototype.__cleanUp.call(this);
  };
  WSTalker.prototype.setHandlers = function(){
    this.wsock.on('error',this.errorer);
    this.wsock.on('message',this.messager);
    this.wsock.on('open',this.opener);
    this.wsock.on('close',this.closer);
  };
  WSTalker.prototype.unSetHandlers = function(){
    if (!this.wsock) {
      return;
    }
    this.wsock.removeListener('error', this.errorer);
    this.wsock.removeListener('message', this.messager);
    this.wsock.removeListener('open', this.opener);
    this.wsock.removeListener('close', this.closer);
    this.wsock = null;
  };
  WSTalker.prototype.onSend = function (error) {
    if (error) {
      console.error(process.pid, this.address, this.port, 'WSTalker send error', error);
    }
  };
  WSTalker.prototype.onWSClosed = function(){
    console.log(process.pid, this.address, this.port, 'WSTalker closing');
    this.unSetHandlers();
    this.destroy(new lib.NoServerError('ws',this.address,this.port));
  };
  WSTalker.prototype.send = function(data){
    var jsondata;
    if (!this.wsock) {
      return;
    }
    try {
      jsondata = JSON.stringify(data);
    } catch(e) {
      console.error('could not stringify', dump(data));
      return;
    }
    this.sendRaw(jsondata);
  };
  WSTalker.prototype.sendRaw = function (raw) {
    try {
      this.wsock.send(raw, this.sendchecker);
    } catch(e) {
      //console.error(e.stack);
      //console.error('WSTalker tried to send data over a WebSocket, but got',e);
      /*
      */
      this.onError(e);
    }
  };
  WSTalker.prototype.onMessage = function(message){
    StringBuffer.consumeString(message, this.onincomer);
  };
  WSTalker.prototype.forIncoming = function (message){
    var m;
    try{
      m = JSON.parse(message);
    }
    catch(e){
      console.error(e.stack);
      console.error(e);
      this.dieExceptionally(e);
      return;
    }
    if (!m) {
      console.error('Y NO MESSAGE?');
      return;
    }
    //console.log('WSTalker got', m);
    this.onIncoming(m);
  };
  WSTalker.prototype.type = 'ws';

  function ServerWSTalker(connectionstring,address,port,defer){
    WSTalker.call(this,connectionstring,address,port,defer);
    this.sending = false;
    this.buffer = new StringBuffer();
  }
  lib.inherit(ServerWSTalker, WSTalker);
  ServerWSTalker.prototype.__cleanUp = function () {
    this.sending = null;
    if (this.buffer) {
      this.buffer.destroy();
    }
    this.buffer = null;
    WSTalker.prototype.__cleanUp.call(this);
  };
  ServerWSTalker.prototype.onSend = function (error) {
    this.sending = false;
    WSTalker.prototype.onSend.call(this,error);
    if (this.buffer && this.buffer.hasContents()) {
      this.sendBuffer();
    }
  };
  var _zeroString = String.fromCharCode(0);
  ServerWSTalker.prototype.send = function (data) {
    var jd;
    if (this.sending === null) {
      console.log('no this.sending, NOT sending', data);
      return;
    }
    if (!this.wsock) { //ok, just in case
      console.log('no this.wsock, NOT sending', data);
      return;
    }
    if (!this.buffer) {
      console.log('no this.buffer, NOT sending', data);
      return;
    }
    try {
      jd = JSON.stringify(data);
    } catch(e) {
      console.error('could not stringify', dump(data));
      return;
    }
    this.buffer.add(jd);
    if (this.sending === false) {
      this.sendBuffer();
    }
  };
  ServerWSTalker.prototype.sendBuffer = function () {
    this.sending = true;
    this.buffer.get(this.sendRaw.bind(this));
  };

  function BrowserWSTalker(connectionstring,address,port,defer){
    WSTalker.call(this,connectionstring,address,port,defer);
  }
  lib.inherit(BrowserWSTalker, WSTalker);

  BrowserWSTalker.prototype.setHandlers = function () {
    this.wsock.onerror=this.errorer;
    this.wsock.onmessage=this.messager;
    this.wsock.onopen=this.opener;
    this.wsock.onclose=this.closer;
  };
  BrowserWSTalker.prototype.unSetHandlers = function(){
    if (!this.wsock) {
      return;
    }
    this.wsock.onerror = null;
    this.wsock.onmessage = null;
    this.wsock.onopen = null;
    this.wsock.onclose = null;
    this.wsock = null;
  };
  BrowserWSTalker.prototype.onMessage = function(message){
    WSTalker.prototype.onMessage.call(this, message.data);
  };

  return 'undefined' === typeof window ? ServerWSTalker : BrowserWSTalker;
}

module.exports = createWSTalker;
