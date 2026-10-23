import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {spawn} from 'node:child_process';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const files=fs.readdirSync(path.join(root,'tests')).filter(f=>f.endsWith('.test.mjs')).sort().map(f=>path.join(root,'tests',f));
const child=spawn(process.execPath,['--test',...files],{cwd:root,stdio:'inherit',windowsHide:true});
child.on('error',error=>{console.error(error);process.exitCode=1;});
child.on('exit',code=>{process.exitCode=code??1;});
