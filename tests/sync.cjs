const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
const { createServer } = require('./server-harness.cjs');
(async () => {
  const backend = createServer();
  backend.post({id:randomUUID(),type:'open',cageId:'RC-044',source:'label',newCycleId:'sync-test-cycle'});
  let releaseRead, reads=0;
  const storage = new Map();
  const context = vm.createContext({console,crypto:{randomUUID},Date,Map,Set,
    localStorage:{getItem:key=>storage.get(key)||null,setItem:(key,value)=>storage.set(key,value)},
    FlowAPI:{getData:()=>{const result=backend.get();return ++reads===1 ? new Promise(resolve=>{releaseRead=()=>resolve(result);}) : Promise.resolve(result);},applyAction:operation=>Promise.resolve(backend.post(operation))}
  });
  for (const file of ['flow-state.js','sync.js']) vm.runInContext(fs.readFileSync(path.join(__dirname,'../js',file),'utf8'),context);
  context.initialState=backend.get().data;
  vm.runInContext('var phone = new FlowSync({demo:false,seed:initialState,onChange(){},onStatus(){}}); phone.ready=true;',context);
  const pending=vm.runInContext('phone.synchronize()',context);
  vm.runInContext('phone.enqueue({type:"worked",cageId:"RC-044",cycleId:"sync-test-cycle"})',context);
  releaseRead();await pending;
  assert.equal(vm.runInContext('phone.pending.length',context),0);
  assert.ok(backend.get().data.cycles[0].workedAt);
  console.log('Passed: an action recorded during an in-flight refresh drains before sync is reported complete.');
})().catch(error=>{console.error(error);process.exitCode=1;});
