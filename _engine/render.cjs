// Portable source renderer. Usage: node _engine/render.cjs pixel-game [stills 1,5,10]
const fs=require('fs'),path=require('path'),{pathToFileURL}=require('url'),{spawn}=require('child_process'),{once}=require('events');
const {chromium}=require('playwright');
const ROOT=path.resolve(process.env.ANIMATION_ROOT||path.join(__dirname,'..'));
const FPS=30;
async function open(browser,id){
 if(!/^[a-z0-9-]+$/.test(id))throw Error('Style ID must contain lowercase letters, digits or hyphens');
 const entry=path.join(ROOT,id,'demo.html');if(!fs.existsSync(entry))throw Error('Missing demo.html: '+id);
 const p=await browser.newPage({viewport:{width:1280,height:720}});const errors=[];
 p.on('pageerror',e=>errors.push(e.message));
 if(process.env.OFFLINE==='1')await p.route(/^https?:/,r=>r.abort());
 await p.addInitScript(()=>{let state=20261024;window.__seed=n=>{state=n>>>0};Math.random=()=>{state=(Math.imul(state,1664525)+1013904223)>>>0;return state/4294967296}});
 await p.goto(pathToFileURL(entry).href,{waitUntil:'load',timeout:60000});
 await p.waitForFunction(()=>window.__film,{timeout:15000});await p.evaluate(()=>window.__film.ready);
 if(errors.length)throw Error(id+': '+errors.join('; '));p.renderErrors=errors;return p;
}
async function frame(p,t){return Buffer.from((await p.evaluate(t=>{window.__seed(20261024+Math.round(t*30000));const canvas=document.querySelector("canvas");canvas.width=canvas.width;return window.__film.frame(t,1920,1080)},t)).split(',')[1],'base64')}
async function stills(browser,id,times){const p=await open(browser,id),dir=path.join(ROOT,id,'stills');fs.mkdirSync(dir,{recursive:true});try{for(const t of times){if(!Number.isFinite(t)||t<0)throw Error('Invalid frame time');fs.writeFileSync(path.join(dir,t.toFixed(2)+'.jpg'),await frame(p,t))}if(p.renderErrors.length)throw Error(p.renderErrors.join('; '))}finally{await p.close()}}
async function video(browser,id){const p=await open(browser,id),dir=path.join(ROOT,id),wav=path.join(dir,'.score.wav'),out=path.join(dir,'demo.mp4');let ff;
 try{const {DUR,poster}=await p.evaluate(()=>({DUR:window.__film.DUR,poster:window.__film.poster}));if(!(DUR>0&&DUR<=600))throw Error('Invalid duration');fs.writeFileSync(path.join(dir,'poster.jpg'),await frame(p,poster));
 fs.writeFileSync(wav,Buffer.from(await p.evaluate(()=>{window.__seed(20261024);return window.__film.audio()}),'base64'));
 ff=spawn(process.env.FFMPEG||'ffmpeg',['-y','-v','error','-f','image2pipe','-framerate','30','-c:v','mjpeg','-i','-','-i',wav,'-vf','scale=in_range=pc:out_range=tv:in_color_matrix=bt601:out_color_matrix=bt709:flags=accurate_rnd+full_chroma_int,format=yuv420p,setparams=range=tv:color_primaries=bt709:color_trc=bt709:colorspace=bt709','-t',String(DUR),'-c:v','libx264','-preset','fast','-crf','20','-threads','2','-maxrate','8M','-bufsize','16M','-g','60','-af','loudnorm=I=-16:TP=-1.5:LRA=11','-c:a','aac','-b:a','192k','-ar','48000','-movflags','+faststart',out],{stdio:['pipe','inherit','inherit']});
 const done=new Promise((resolve,reject)=>{ff.on('error',reject);ff.on('close',code=>code===0?resolve():reject(Error('ffmpeg exit '+code)))});done.catch(()=>{});ff.stdin.on('error',()=>{});
 for(let f=0;f<Math.round(DUR*FPS);f++){if(ff.exitCode!==null)throw Error('ffmpeg stopped');if(!ff.stdin.write(await frame(p,f/FPS)))await Promise.race([once(ff.stdin,'drain'),done.then(()=>{throw Error('ffmpeg closed early')})])}
 ff.stdin.end();await done;if(p.renderErrors.length)throw Error(p.renderErrors.join('; '));console.log(id+': '+out);
 }catch(e){if(ff&&ff.exitCode===null)ff.kill();throw e}finally{fs.rmSync(wav,{force:true});await p.close()}
}
async function main(){const [id,mode,arg]=process.argv.slice(2);if(!id)throw Error('Usage: npm run render -- pixel-game [stills 1,5,10]');const browser=await chromium.launch({...(process.env.CHROME_PATH?{executablePath:process.env.CHROME_PATH}:{}),args:['--autoplay-policy=no-user-gesture-required']});try{if(id==='all'){for(const d of fs.readdirSync(ROOT))if(fs.existsSync(path.join(ROOT,d,'demo.html')))await video(browser,d)}else if(mode==='stills')await stills(browser,id,(arg||'1,7.5,13').split(',').map(Number));else await video(browser,id)}finally{await browser.close()}}
module.exports={open,frame,video};if(require.main===module)main().catch(e=>{console.error(e.message);process.exitCode=1});
