"""Compose the selected 30 source videos at 5s each, retaining a name/prompt panel."""
from pathlib import Path
import argparse,json,subprocess
from PIL import Image,ImageDraw,ImageFont
ROOT=Path(__file__).resolve().parents[1]
p=argparse.ArgumentParser();p.add_argument('--font',help='Chinese-capable TTF/TTC/OTF file');p.add_argument('--limit',type=int,default=30,help='Smoke test subset, default 30');args=p.parse_args()
fonts=[args.font,'/System/Library/Fonts/Hiragino Sans GB.ttc','/usr/share/fonts/opentype/noto/NotoSansCJK-Regular.ttc','C:/Windows/Fonts/msyh.ttc']
font=next((x for x in fonts if x and Path(x).is_file()),None)
if not font:raise SystemExit('Install a Chinese font and pass --font /path/to/font.ttf')
if not 1<=args.limit<=30:raise SystemExit('--limit must be between 1 and 30')
S=json.loads((ROOT/'compilation/selected30.json').read_text())[:args.limit];B=ROOT/'outputs/compilation';B.mkdir(parents=True,exist_ok=True)
def f(n):return ImageFont.truetype(font,n)
def wrap(s,font,width):
 out=[];line=''
 for c in s:
  if c=='\n' or font.getlength(line+c)>width:out.append(line);line='' if c=='\n' else c
  else:line+=c
 if line:out.append(line)
 return out
clips=[];meta=[';FFMETADATA1']
for s in S:
 source=ROOT/s['id']/'demo.mp4'
 if not source.exists():raise SystemExit('First run: npm run render -- '+s['id'])
 duration=float(subprocess.check_output(['ffprobe','-v','error','-show_entries','format=duration','-of','default=nw=1:nk=1',str(source)]))
 if abs(duration-15)>.1:raise SystemExit(f'{s["id"]}: expected 15s source, got {duration}')
 im=Image.new('RGB',(1920,1080),'#11150f');d=ImageDraw.Draw(im);white='#f3efdf';dim='#a4ac99';accent='#d5e4a5'
 d.text((40,38),'Claude 动画画风 · 30 种画风 · 5 秒速览',font=f(40),fill=white);d.text((40,100),'每种画风，用它自己的故事与镜头说话',font=f(22),fill=dim)
 d.rounded_rectangle((1430,164,1880,929),radius=16,fill='#20261b',outline='#3c4730',width=1);d.text((1460,193),f"{s['n']:02d} / 30",font=f(25),fill=accent);y=248
 for line in wrap(s['zh'],f(37),385):d.text((1460,y),line,font=f(37),fill=white);y+=49
 for line in wrap(s['en'],f(17),385):d.text((1460,y+3),line,font=f(17),fill=dim);y+=25
 y+=24
 for line in wrap(s['line'],f(22),385):d.text((1460,y),line,font=f(22),fill=accent);y+=34
 y=max(y+30,440);d.line((1460,y,1850,y),fill='#435135',width=1);y+=24;d.text((1460,y),'让 Claude 这样制作',font=f(24),fill=white);y+=52
 for line in wrap(s['screen_prompt'],f(23),385):d.text((1460,y),line,font=f(23),fill=white);y+=34
 if y>900:raise SystemExit('Text overflow: '+s['id'])
 d.text((40,963),'每种 5 秒 · 原片 3 倍速 · 保音高',font=f(23),fill=dim);d.text((40,1010),'门类参考 LemoLab / lemo-opuscar',font=f(18),fill=dim)
 for j in range(30):
  x=1100+j*26;d.rounded_rectangle((x,1019,x+18,1024),radius=2,fill=accent if j==s['n']-1 else '#3b4432')
 layout=B/f'{s["n"]:02d}.png';im.save(layout);out=B/f'{s["n"]:02d}.mp4'
 subprocess.run(['ffmpeg','-y','-v','error','-i',str(source),'-loop','1','-framerate','30','-i',str(layout),'-filter_complex','[0:v]setpts=(PTS-STARTPTS)/3,fps=30,scale=1344:756:flags=lanczos,setsar=1[v];[1:v][v]overlay=40:164:shortest=1,format=yuv420p[out];[0:a]asetpts=PTS-STARTPTS,atempo=2,atempo=1.5,apad,atrim=duration=5[a]','-map','[out]','-map','[a]','-t','5','-r','30','-c:v','libx264','-preset','fast','-crf','18','-threads','2','-c:a','aac','-b:a','192k','-ar','48000','-ac','2','-movflags','+faststart',str(out)],check=True)
 clips.append(f"file '{out.name}'");meta+=['[CHAPTER]','TIMEBASE=1/1000',f'START={(s["n"]-1)*5000}',f'END={s["n"]*5000}',f'title={s["n"]:02d} {s["zh"]}'];print('Composed',s['id'],flush=True)
(B/'concat.txt').write_text('\n'.join(clips));(B/'chapters.ffmeta').write_text('\n'.join(meta));out=B/f'animation-{args.limit}-styles.mp4'
subprocess.run(['ffmpeg','-y','-v','error','-f','concat','-safe','0','-i',str(B/'concat.txt'),'-i',str(B/'chapters.ffmeta'),'-map','0:v','-map','0:a','-map_metadata','1','-map_chapters','1','-c','copy','-movflags','+faststart',str(out)],check=True);print(out)
