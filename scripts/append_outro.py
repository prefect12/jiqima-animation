"""Append the optional eight-second announcement without changing compilation speed."""
from pathlib import Path
import argparse, json, subprocess

ROOT = Path(__file__).resolve().parents[1]
p = argparse.ArgumentParser()
p.add_argument('compilation', type=Path, help='Already composed 150-second video')
p.add_argument('--outro', type=Path, default=ROOT/'compilation/outro/demo.mp4')
p.add_argument('--replace-last', type=Path, help='Optional already-composed five-second replacement for segment 30')
p.add_argument('--output', type=Path, default=ROOT/'outputs/compilation/animation-30-styles-with-outro.mp4')
a = p.parse_args()
sources=[(a.compilation,150),(a.outro,8)]+([(a.replace_last,5)] if a.replace_last else [])
for src, expected in sources:
    info=json.loads(subprocess.check_output(['ffprobe','-v','error','-show_format','-of','json',str(src)]))
    if abs(float(info['format']['duration'])-expected)>.1:
        raise SystemExit(f'Expected {expected}s: {src}')
if a.output.resolve() in [src.resolve() for src,_ in sources]:
    raise SystemExit('Output must not overwrite either source')
a.output.parent.mkdir(parents=True,exist_ok=True)
meta=[';FFMETADATA1']
for s in json.loads((ROOT/'compilation/selected30.json').read_text())+[dict(start=150,end=158,zh='视频工作台开源预告')]:
    meta+=['[CHAPTER]','TIMEBASE=1/1000',f'START={s["start"]*1000}',f'END={s["end"]*1000}',f'title={s["zh"]}']
metadata=a.output.with_suffix('.ffmeta');metadata.write_text('\n'.join(meta))
inputs=[]
for src,_ in sources:inputs+=['-i',str(src)]
parts=[(0,145 if a.replace_last else 150)]+([(2,5)] if a.replace_last else [])+[(1,8)]
filters=[]
for i,duration in parts:
    filters.append(f'[{i}:v]trim=duration={duration},setpts=PTS-STARTPTS,setsar=1[v{i}]')
    fade=',afade=t=out:st=6.5:d=1.5' if i==1 else ''
    filters.append(f'[{i}:a]atrim=duration={duration},asetpts=PTS-STARTPTS{fade}[a{i}]')
filters.append(''.join(f'[v{i}][a{i}]' for i,_ in parts)+f'concat=n={len(parts)}:v=1:a=1[v][a]')
subprocess.run(['ffmpeg','-y','-v','error',*inputs,'-i',str(metadata),
 '-filter_complex',';'.join(filters),'-map_metadata',str(len(sources)),'-map_chapters',str(len(sources)),
 '-map','[v]','-map','[a]','-c:v','libx264','-preset','fast','-crf','18','-threads','4','-pix_fmt','yuv420p','-r','30',
 '-c:a','aac','-b:a','192k','-ar','48000','-ac','2','-movflags','+faststart',str(a.output)],check=True)
print(a.output)
