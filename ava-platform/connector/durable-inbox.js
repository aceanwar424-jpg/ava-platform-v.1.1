'use strict';
// OWNED_BY: ava. Local restricted directory; never publish spool contents.
const fs=require('fs'),path=require('path'),crypto=require('crypto');
class DurableInbox {
  constructor(dir){this.dir=path.resolve(dir);fs.mkdirSync(this.dir,{recursive:true,mode:0o700});}
  write(name,value){
    const target=path.join(this.dir,name),tmp=target+'.tmp';
    const fd=fs.openSync(tmp,'w',0o600);
    try{fs.writeFileSync(fd,JSON.stringify(value));fs.fsyncSync(fd);}finally{fs.closeSync(fd);}
    fs.renameSync(tmp,target);
  }
  enqueue(item){
    const id=crypto.createHash('sha256').update(JSON.stringify([item.analyzer.id,item.protocol,item.direction,item.raw])).digest('hex');
    const file=id+'.json';
    if(!fs.existsSync(path.join(this.dir,file))) this.write(file,{...item,id,attempts:0,received_at:new Date().toISOString()});
    return id;
  }
  pending(){return fs.readdirSync(this.dir).filter(f=>/^[a-f0-9]{64}\.json$/.test(f)).map(f=>JSON.parse(fs.readFileSync(path.join(this.dir,f),'utf8')));}
  complete(id){fs.unlinkSync(path.join(this.dir,id+'.json'));}
  retry(item){this.write(item.id+'.json',item);}
  quarantine(item){this.write(item.id+'.dead',item);this.complete(item.id);}
  frame(session,frames,analyzer){this.write('session-'+session+'.partial',{frames,analyzer,updated_at:new Date().toISOString()});}
  finish(session){const p=path.join(this.dir,'session-'+session+'.partial');if(fs.existsSync(p))fs.unlinkSync(p);}
}
module.exports={DurableInbox};
