const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');

function createServer(legacyData = null) {
  let locked = false;
  const sheets = new Map();
  class Sheet {
    constructor(rows = []) { this.rows = rows; }
    getLastRow() { return this.rows.length; }
    getMaxRows() { return 100000; }
    setFrozenRows() {}
    appendRow(row) { if (!locked) throw new Error('Write without lock'); this.rows.push(row); }
    getRange(row, col, height, width) {
      return {
        getValues: () => Array.from({length:height},(_,r)=>Array.from({length:width},(_,c)=>this.rows[row+r-1]?.[col+c-1] ?? '')),
        setValues: values => {
          if (!locked) throw new Error('Write without lock');
          values.forEach((value,r)=>{this.rows[row+r-1] ||= [];value.forEach((cell,c)=>this.rows[row+r-1][col+c-1]=cell);});
        }
      };
    }
  }
  if (legacyData) sheets.set('FlowData', new Sheet([['Key','Updated At','JSON Data'],['shared_state','original',JSON.stringify(legacyData)]]));
  const book = {getSheetByName:name=>sheets.get(name),insertSheet:name=>{const s=new Sheet();sheets.set(name,s);return s;}};
  const context=vm.createContext({ console, Date, Map, Set,
    SpreadsheetApp:{getActiveSpreadsheet:()=>book},
    LockService:{getScriptLock:()=>({waitLock(){if(locked)throw new Error('Lock overlap');locked=true;},releaseLock(){locked=false;}})},
    ContentService:{MimeType:{JSON:'json'},createTextOutput:text=>({setMimeType:()=>JSON.parse(text)})}
  });
  vm.runInContext(fs.readFileSync(path.join(__dirname,'../google-apps-script/Code.gs'),'utf8'),context);
  return {
    get:()=>vm.runInContext('doGet({parameter:{action:"getData"}})',context),
    post:operation=>{context.requestText=JSON.stringify({action:'applyAction',operation});return vm.runInContext('doPost({postData:{contents:requestText}})',context);},
    legacyWrite:()=>vm.runInContext('doPost({postData:{contents:JSON.stringify({action:"saveData",data:{cages:[],cycles:[],events:[]}})}})',context),
    setup:()=>vm.runInContext('setupFlowSheet()',context),
    sheets,context
  };
}
module.exports={createServer};
