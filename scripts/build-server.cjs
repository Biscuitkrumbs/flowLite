const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const rules = fs.readFileSync(path.join(root, 'js/flow-state.js'), 'utf8');
const server = fs.readFileSync(path.join(root, 'google-apps-script/server.js'), 'utf8');
fs.writeFileSync(path.join(root, 'google-apps-script/Code.gs'), '// Generated from js/flow-state.js and google-apps-script/server.js.\n' + rules + '\n' + server);
