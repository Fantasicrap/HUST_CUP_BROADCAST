const path=require('node:path'),fs=require('node:fs/promises'),{spawn}=require('node:child_process');
const root=path.resolve(__dirname,'..'),scripts=['review-workflow-guide','review-event-modal','review-referee-editor','review-formats','review-goal2','review-goal2-net','review-audit'];
(async()=>{
 const output=process.env.HUST_REVIEW_OUTPUT||'work/review-current';await fs.mkdir(path.resolve(root,output),{recursive:true});const results=[];
 for(const script of scripts){console.log('\nChecking '+script);const result=await new Promise(resolve=>{const child=spawn(process.execPath,[path.join(__dirname,script+'.cjs')],{cwd:root,env:{...process.env,HUST_REVIEW_OUTPUT:path.join(output,script)},stdio:'inherit',windowsHide:true});child.once('error',e=>{console.error(e.message);resolve(1);});child.once('exit',code=>resolve(code??1));});results.push({script,passed:result===0});}
 await fs.writeFile(path.resolve(root,output,'summary.json'),JSON.stringify({date:new Date().toISOString(),results},null,2));
 const failed=results.filter(r=>!r.passed);console.log(`\nBrowser suites: ${results.length-failed.length}/${results.length} passed. Evidence: ${output}`);if(failed.length)process.exitCode=1;
})().catch(e=>{console.error(e);process.exitCode=1;});
