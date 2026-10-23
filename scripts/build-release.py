"""Package tracked project files only; never distribute local runtime or caches."""
from pathlib import Path, PurePosixPath
from zipfile import ZipFile, ZIP_DEFLATED
from hashlib import sha256
import argparse, json, subprocess, shutil

ROOT=Path(__file__).resolve().parents[1]
def git(*args):
    return subprocess.check_output(['git','-c',f'safe.directory={ROOT.as_posix()}',*args],cwd=ROOT)

def main():
    parser=argparse.ArgumentParser()
    parser.add_argument('--output',required=True)
    args=parser.parse_args()
    out=Path(args.output).resolve()
    if out==ROOT or ROOT in out.parents:
        raise SystemExit('Choose an output folder outside the project to keep the checkout clean.')
    out.mkdir(parents=True,exist_ok=True)
    version=json.loads((ROOT/'package.json').read_text(encoding='utf-8'))['version']
    head=git('rev-parse','HEAD').decode().strip()
    tag=git('rev-parse',f'v{version}^{{}}').decode().strip()
    # Documentation may follow the existing tag, but the distributed runtime must match it.
    codepaths=['server.mjs','package.json','public','lib','tests','启动系统.cmd','启动预览.cmd']
    if git('diff',f'v{version}','HEAD','--',*codepaths).strip():
        raise SystemExit('Runtime differs from the release tag; choose a correctly versioned release first.')
    if git('status','--porcelain','--untracked-files=no').strip():
        raise SystemExit('Commit tracked changes before packaging.')
    names=git('ls-files','-z').decode('utf-8').strip('\0').split('\0')
    banned={'runtime','work','releases','.git','.venv-background','node_modules','__pycache__'}
    entries=[]
    for name in names:
        parts=PurePosixPath(name).parts
        if any(p in banned for p in parts) or name.endswith('.log') or name=='.env':
            raise SystemExit('Refusing local-only file: '+name)
        p=ROOT/name
        if p.is_symlink() or not p.is_file():
            raise SystemExit('Expected an ordinary tracked file: '+name)
        entries.append({'path':name,'bytes':p.stat().st_size,'sha256':sha256(p.read_bytes()).hexdigest()})
    manifest={'version':version,'sourceCommit':head,'existingTagCommit':tag,'runtimeMatchesTag':True,
              'documentationIncludesPostTagUpdates':head!=tag,'requires':'Node.js >=20',
              'localRuntimeIncluded':False,'files':entries}
    filename=f'HUST_CUP_BROADCAST-v{version}.zip'
    archive=out/filename
    with ZipFile(archive,'w',ZIP_DEFLATED,compresslevel=6) as z:
        for e in entries:z.write(ROOT/e['path'],'HUST_CUP_BROADCAST/'+e['path'])
        z.writestr('HUST_CUP_BROADCAST/BUILD-MANIFEST.json',json.dumps(manifest,ensure_ascii=False,indent=2))
    with ZipFile(archive) as z:
        if z.testzip():raise SystemExit('ZIP integrity check failed')
        assert len(z.namelist())==len(entries)+1
    guide=f'HUST_CUP_BROADCAST_Operator_Guide_v{version}.docx'
    shutil.copy2(ROOT/f'docs/操作指南/HUST_CUP_BROADCAST_使用者操作指南_v{version}.docx',out/guide)
    (out/'BUILD-MANIFEST.json').write_text(json.dumps(manifest,ensure_ascii=False,indent=2),encoding='utf-8')
    checksum=out/f'SHA256SUMS-v{version}.txt'
    assets=[archive,out/guide,out/'BUILD-MANIFEST.json']
    checksum.write_text(''.join(sha256(p.read_bytes()).hexdigest()+'  '+p.name+'\n' for p in assets),encoding='ascii')
    print(json.dumps({'version':version,'sourceCommit':head,'tagCommit':tag,'files':len(entries),
                     'assets':[{'name':p.name,'bytes':p.stat().st_size,'sha256':sha256(p.read_bytes()).hexdigest()} for p in assets+[checksum]]},ensure_ascii=False))

if __name__=='__main__':main()
