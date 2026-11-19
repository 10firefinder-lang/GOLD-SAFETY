import {randomBytes} from 'node:crypto';
import {mkdirSync,mkdtempSync,readFileSync,writeFileSync,rmSync} from 'node:fs';
import {homedir} from 'node:os';
import {join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {spawnSync} from 'node:child_process';

const folder=fileURLToPath(new URL('.',import.meta.url));
process.chdir(folder);
const stateFile='.gold-deployment.json';
const dry=process.argv.includes('--dry-run');
const win=process.platform==='win32';
const command=(args)=>spawnSync(win?'npx.cmd':'npx',['--yes','wrangler@4.86.0',...args],{stdio:'inherit',shell:win,env:{...process.env,WRANGLER_SEND_METRICS:'false'}});
const run=(args)=>{const r=command(args);if(r.status!==0)throw Error(r.error?.message||`Wrangler exited ${r.status??r.signal}`);};
let scratch;
try{
  if(Number(process.versions.node.split('.')[0])<22&&!dry)throw Error('התקינו Node.js 22 ומעלה לפני הפריסה.');
  if(dry){
    run(['deploy','--config','wrangler.toml','--dry-run']);
  }else{
    let name;
    try{name=JSON.parse(readFileSync(stateFile,'utf8')).name;}
    catch(e){
      if(e.code!=='ENOENT')throw e;
      name='gold-safety-'+randomBytes(5).toString('hex');
      writeFileSync(stateFile,JSON.stringify({name})+'\n',{flag:'wx',mode:0o600});
    }
    if(!/^gold-safety-[a-f0-9]{10}$/.test(name))throw Error('Deployment identity is invalid.');
    const privateDir=join(homedir(),'.gold-safety');
    mkdirSync(privateDir,{recursive:true,mode:0o700});
    const codePath=join(privateDir,`${name}.txt`);
    let code;
    try{code=readFileSync(codePath,'utf8').trim();}
    catch(e){
      if(e.code!=='ENOENT')throw e;
      code=randomBytes(24).toString('base64url');
      writeFileSync(codePath,code+'\n',{flag:'wx',mode:0o600});
    }
    if(!/^[a-zA-Z0-9_-]{32}$/.test(code))throw Error('Stored access code is invalid.');
    console.log(`Cloudflare Worker: ${name}`);
    if(!process.env.CLOUDFLARE_API_TOKEN){
      console.log('אם זו פריסה ראשונה, אשרו את הכניסה לחשבון Cloudflare בדפדפן.');
      run(['login']);
    }
    scratch=mkdtempSync('.gold-secret-');
    writeFileSync(join(scratch,'secret.json'),JSON.stringify({GOLD_ACCESS_CODE:code}),{flag:'wx',mode:0o600});
    run(['deploy','--config','wrangler.toml','--name',name,'--secrets-file',`${scratch}/secret.json`]);
    console.log(`\nקוד הגישה האישי: ${code}\nשמרו אותו במנהל סיסמאות ופתחו את הכתובת ש־Cloudflare הציג.`);
  }
}catch(e){console.error(e.message);process.exitCode=1;}
finally{if(scratch)rmSync(scratch,{recursive:true,force:true});}
