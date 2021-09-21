function dump(obj){
  return require('util').inspect(obj,{depth:null});
}
function createTalker(lib, PingingTalker){
  'use strict';
  var Fifo = lib.Fifo, StringBuffer = lib.StringBuffer;
  function Talker(socket,cb,acceptor){
    PingingTalker.call(this, !acceptor);
    this.lenBuf = new Buffer(4);
    this.lenBufread = 0;
    this.bytesToRead = -1;
    this.dataRead = '';
    this.sendingQueue = '';
    this.sending = false;
    this.sendingBuffs = new Fifo();
    this.dataCursor = 0;
    this.incomingData = new Fifo();
    this.currentData = null;
    this.acceptor = acceptor;
    this.socket = socket;
    this.dataHandler = this.onData.bind(this);
    this.drainHandler = this.sendMore.bind(this);
    this.invalidator = this.onSocketUnusable.bind(this);
    this.errorer = this.onSocketError.bind(this);
    this.incomingDispatcher = this.onIncomingDispatcher.bind(this);
    this.sendingBuffsDrainerBound = this.sendingBuffsDrainer.bind(this);
    this.processDataBound = this.processData.bind(this);
    this.socket.setNoDelay(true);
    //if (acceptor) {
      this.socket.setTimeout(5*this.KEEP_ALIVE_INTERVAL);
    //}
    socket.on('data',this.dataHandler);
    socket.on('drain',this.drainHandler);
    socket.on('error',this.errorer);
    socket.on('close',this.invalidator);
    this.cb = cb;
    //this.log('new SocketTalker', acceptor);
  };
  lib.inherit(Talker,PingingTalker);
  Talker.prototype.__cleanUp = function(){
    //this.log('dying');
    this.cb = null;
    this.detachFromSocket();
    this.processDataBound = null;
    this.sendingBuffsDrainerBound = null;
    this.incomingDispatcher = null;
    this.errorer = null;
    this.invalidator = null;
    this.drainHandler = null;
    this.dataHandler = null;
    this.currentData = null;
    if(this.incomingData){
      this.incomingData.destroy();
    }
    this.incomingData = null;
    this.acceptor = null;
    this.dataCursor = null;
    if(this.sendingBuffs){
      this.sendingBuffs.destroy();
    }
    this.sendingBuffs = null;
    this.sending = null;
    /*
    if(this.sendingQueue){
      this.sendingQueue.destroy();
    }
    */
    this.sendingQueue = null;
    this.dataRead = null;
    this.bytesToRead = null;
    this.lenBufread = null;
    this.lenBuf = null;
    PingingTalker.prototype.__cleanUp.call(this);
  };
  Talker.prototype.dyingCondition = function () {
    if (this.socket) {
      if (!(this.socket.writable && this.socket.readable)) {
        return true;
      }
    }
    if (this.sendingQueue !== null && this.sendingBuffs && this.sendingQueue.length < 1 && this.sendingBuffs.length < 1) {
      //this.log('disposeOfSocket');
      this.disposeOfSocket();
    }
    if (this.socket) {
      //this.log('cannot die bc of socket');
      return false;
    }
    return PingingTalker.prototype.dyingCondition.call(this);
  };
  Talker.prototype.isUsable = function () {
    if (!PingingTalker.prototype.isUsable.call(this)) {
      return false;
    }
    if (!this.socket) {
      return false;
    }
    if (!this.socket.readable) {
      return false;
    }
    if (!this.socket.writable) {
      return false;
    }
    return true;
  };
  Talker.prototype.detachFromSocket = function () {
    if(this.socket){
      //this.log('detaching from socket');
      //console.log('removing listeners', this.destroyed.collection.length, 'my listeners');
      this.socket.removeListener('data',this.dataHandler);
      this.socket.removeListener('drain',this.drainHandler);
      this.socket.removeListener('error',this.errorer);
      this.socket.removeListener('close',this.invalidator);
    }
    this.socket = null;
    this.errorer = null;
    this.invalidator = null;
    this.dataHandler = null;
    this.drainHandler = null;
  };
  Talker.prototype.onSocketError = function (error) {
    //this.log('onSocketError', error);
    this.onSocketUnusable(error);
  };
  Talker.prototype.onSocketUnusable = function () {
    //console.log('onSocketUnusable', this.destroyed.collection.length, 'my listeners', arguments);
    //this.log('socket down', --_count);
    var s = this.socket;
    this.detachFromSocket();
    if (s) {
      //console.trace();
      //console.log(this.id, this.constructor.name, this.acceptor ? 'acceptor':'initiator', 'destroying socket');
      s.destroy();
    }
    this.destroy();
  };
  Talker.prototype.handleDataRead = function(){
    var items, eq, dr;
    if(!this.incomingDispatcher) {
      return;
    }
    if(this.dataRead){
      dr = this.dataRead;
      this.dataRead = '';
      StringBuffer.consumeString(dr, this.incomingDispatcher, true);
    }
    this.processData(this.currentData,this.dataCursor);
  };
  Talker.prototype._internalSend = function(buf){
    if(!this.socket){
      //console.log(this.__id,'got out because there is no socket');
      return;
    }
    if(!this.sendingQueue.length){
      //console.log(this.__id,'got out because there is nothing to send');
      return;
    }
    if(this.sending){
      //console.log(this.__id,'got out because I am already sending');
      return;
    }
    var sq = this.sendingQueue;
    this.sendingQueue = '';
    this.bufferize(sq);
    this.sending = true;
    this.sendMore();
  };
  Talker.prototype.onIncomingDispatcher = function (item) {
    if (!(lib.isArray(item) && item.length>0)) {
      return;
    }
    if (this.cb) {
      this.cb(this, item);
    } else {
      this.onIncoming(item);
    }
  };
  Talker.prototype.bufferize = function(sq){
    /*
    var sqblen = Buffer.byteLength(sq, 'utf8'),
      sqb = new Buffer(sqblen+4);
    sqb.write(sq, 4, sqblen, 'utf8');
    sqb.writeUInt32LE(sqblen,0);
    this.sendingBuffs.push(sqb);
    */
    var sqblen = Buffer.byteLength(sq, 'utf8'),
        sqlb = Buffer.allocUnsafe(4);
    sqlb.writeUInt32LE(sqblen, 0);
    this.sendingBuffs.push(sqlb);
    this.sendingBuffs.push(sq);
  }
  Talker.prototype.send = function(obj){
    if(!lib.isString(this.sendingQueue)){
      //this.log('rejecting',dump(obj));
      return;
    }
    if (this.sendingQueue.length) {
      this.sendingQueue += String.fromCharCode(0);
    }
    this.sendingQueue += JSON.stringify(obj);
    this._internalSend();
  };
  Talker.prototype.sendingBuffsDrainer = function (b) {
    this.sendingLength = b.length;
    //console.log('writing',b.toString());
    //console.log('Talker', this.id, 'writing');
    if (lib.isString(b)) {
      if (this.socket.write(b, 'utf8')){
        this.sendMore();
      }
    } else {
      if(this.socket.write(b)){
        this.sendMore();
      }
    }
  };
  Talker.prototype.sendMore = function(){
    if(!this.sendingBuffs){
      //console.log('cannot sendMore, no sendingBuffs');
      return;
    }
    if(!this.sendingBuffs.length){
      //console.log('sendingBuffs are empty');
      this.sending = false;
      this.maybeDie();
    }else{
      if(this.socket && this.socket.writable && this.sendingBuffsDrainerBound){
        this.sendingBuffs.pop(this.sendingBuffsDrainerBound);
      }else{
        //console.log('not writing, socket',this.socket,'is not writable');
      }
    }
    this._internalSend();
  };

  Talker.prototype.onData = function (data) {
    this.processData(data);
  };
  Talker.prototype.processData = function(data,offset){
    if(!this.socket){return;}
    var i=(offset||0);
    if((this.currentData && data!==this.currentData) || (i!==this.dataCursor)){
      //console.log(i,'<>',this.dataCursor);
      this.incomingData.push(data);
      return;
    }
    this.currentData = data;
    //console.log('data',data.length,'long, reading from',i);
    for(; (this.bytesToRead<0)&&(i<data.length)&&(this.lenBufread<4); i++,this.lenBufread++){
      this.lenBuf[this.lenBufread] = data[i];
      //console.log(this.lenBuf);
    }
    if(this.bytesToRead<0){
      if(this.lenBufread!==4){
        this.currentData = null;
        this.dataCursor=0;
        if(this.incomingData.length){
          this.processData(this.incomingData.shift());
        }
        this.maybeDie();
        return;
      }
      this.bytesToRead = this.lenBuf.readUInt32LE(0);
    }else{
      //console.log('still',this.bytesToRead);
    }
    //console.log('should read',this.bytesToRead,'bytes');
    var canread = (data.length-i);
    if(canread>this.bytesToRead){
      canread=this.bytesToRead;
    }
    this.dataRead+=data.toString('utf8',i,i+canread);
    this.bytesToRead-=canread;
    i+=canread;
    this.dataCursor = i;
    if(this.bytesToRead===0){
      this.bytesToRead=-1;
      this.lenBufread=0;
      this.handleDataRead();
      //this.unzip.end();
    }else{
      //console.log('at',i,'data is',data.length,'long, now what?');
      if(i===data.length){
        this.currentData = null;
        this.dataCursor=0;
        if(this.incomingData.length){
          this.incomingData.pop(this.processDataBound);
        }
      }else{
        this.processData(data,i);
      }
    }
  };
    /*
  Talker.prototype.log = function () {
    var args = Array.prototype.slice.call(arguments, 0);
    args.unshift(this.id);
    args.unshift(this.subType);
    args.unshift(this.acceptor ? 'acceptor' : 'initiator');
    args.unshift(process.pid+'');
    console.log.apply(console, args);
  };
    */
  Talker.prototype.type = 'socket';
  Talker.prototype.KEEP_ALIVE_INTERVAL = 1*lib.intervals.Second;
  return Talker;
}

module.exports = createTalker;
