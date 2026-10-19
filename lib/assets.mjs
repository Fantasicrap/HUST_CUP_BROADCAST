import crypto from 'node:crypto';
export function inspectAsset(buffer,filename){
 const ext=String(filename).toLowerCase().split('.').at(-1);
 const checks={png:()=>buffer.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10])),jpg:()=>buffer[0]===255&&buffer[1]===216,jpeg:()=>buffer[0]===255&&buffer[1]===216,webp:()=>buffer.toString('ascii',0,4)==='RIFF'&&buffer.toString('ascii',8,12)==='WEBP',mp4:()=>buffer.toString('ascii',4,8)==='ftyp',webm:()=>buffer.subarray(0,4).equals(Buffer.from([26,69,223,163])),svg:()=>{const s=buffer.toString('utf8');return /<svg[\s>]/i.test(s)&&!/<\s*(script|foreignObject|iframe|object|embed|image|use|style)\b|\bon\w+\s*=|(?:href|src)\s*=|<!ENTITY|<!DOCTYPE|@import/i.test(s)&&[...s.matchAll(/url\s*\(\s*['"]?([^)'"\s]+)['"]?\s*\)/gi)].every(m=>/^#[\w-]+$/.test(m[1]));}};
 if(!checks[ext]||!checks[ext]())throw new Error('素材内容无效。支持 PNG / JPG / WebP / 安全 SVG / MP4 / WebM。');
 if(buffer.length>(['mp4','webm'].includes(ext)?100:12)*1024*1024)throw new Error('图片最大 12 MB，视频最大 100 MB。');
 return `${crypto.createHash('sha256').update(buffer).digest('hex')}.${ext}`;
}
