'use strict';
// Software Factory structural smoke check. This does not prove business behavior.
const {test}=require('node:test');const assert=require('node:assert/strict');const {spawnSync}=require('node:child_process');const fs=require('node:fs');
test('selected JavaScript files parse',()=>{for(const file of ["src/utils/response.util.js","scripts/collect-project-context.mjs","src/app.js","src/config/database.js","src/config/openai.js","src/config/passport.js","src/config/server.js","src/controllers/ai.controller.js"]){const result=spawnSync(process.execPath,['--check','--',file],{encoding:'utf8',timeout:15000});assert.equal(result.status,0,'Syntax check failed: '+file);}});
test('project manifest is valid JSON',()=>{assert.equal(typeof JSON.parse(fs.readFileSync("package.json",'utf8')),'object');});
