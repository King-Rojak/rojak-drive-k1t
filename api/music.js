import fs from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";
import { Octokit } from "@octokit/rest";
import formidable from "formidable";
import admin from "firebase-admin";

export const config = { api: { bodyParser: false } };

function send(res,status,data){res.status(status).setHeader("Content-Type","application/json");res.end(JSON.stringify(data));}
function firebaseApp(){
  if(admin.apps.length) return admin.app();
  if(!process.env.FIREBASE_SERVICE_ACCOUNT) throw new Error("FIREBASE_SERVICE_ACCOUNT belum diatur.");
  const s=JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
  if(s.private_key) s.private_key=s.private_key.replace(/\\n/g,"\n");
  return admin.initializeApp({credential:admin.credential.cert(s)});
}
function gh(){if(!process.env.GITHUB_TOKEN) throw new Error("GITHUB_TOKEN belum diatur."); return new Octokit({auth:process.env.GITHUB_TOKEN});}
function cfg(){const owner=process.env.GITHUB_OWNER,repo=process.env.GITHUB_REPO,branch=process.env.GITHUB_BRANCH||"main";if(!owner||!repo) throw new Error("GITHUB_OWNER/GITHUB_REPO belum diatur.");return{owner,repo,branch};}
function clean(s,f="music"){return String(s||f).normalize("NFKD").replace(/[^\w\s.-]/g,"").trim().replace(/\s+/g,"-").slice(0,80)||f;}
function one(v){return Array.isArray(v)?v[0]:v;}
async function verifyAdmin(req){
  const h=req.headers.authorization||""; const token=h.startsWith("Bearer ")?h.slice(7):""; if(!token) throw Object.assign(new Error("Authorization token tidak ada."),{status:401});
  const app=firebaseApp(); const decoded=await admin.auth(app).verifyIdToken(token); const snap=await admin.firestore(app).collection("users").doc(decoded.uid).get();
  if(!snap.exists||snap.data()?.role!=="admin") throw Object.assign(new Error("Akses Admin diperlukan."),{status:403});
  return{app,uid:decoded.uid};
}
async function parse(req){const form=formidable({multiples:false,keepExtensions:true,maxFileSize:4*1024*1024});return new Promise((resolve,reject)=>form.parse(req,(e,fields,files)=>e?reject(e):resolve({fields,files})));}
async function put(o,c,p,b,msg){const r=await o.repos.createOrUpdateFileContents({owner:c.owner,repo:c.repo,path:p,message:msg,content:b.toString("base64"),branch:c.branch});return{sha:r.data.content.sha,url:`https://raw.githubusercontent.com/${c.owner}/${c.repo}/${c.branch}/${p}`};}
async function getSha(o,c,p){const r=await o.repos.getContent({owner:c.owner,repo:c.repo,path:p,ref:c.branch});if(Array.isArray(r.data))throw new Error("GitHub path bukan file: "+p);return r.data.sha;}
async function del(o,c,p,sha,msg){await o.repos.deleteFile({owner:c.owner,repo:c.repo,path:p,message:msg,sha,branch:c.branch});}

export default async function handler(req,res){
  try{
    const {app,uid}=await verifyAdmin(req); const db=admin.firestore(app); const o=gh(); const c=cfg();
    if(req.method==="GET"){const s=await db.collection("music").orderBy("createdAt","desc").get();return send(res,200,{ok:true,music:s.docs.map(d=>({id:d.id,...d.data()}))});}
    if(req.method==="POST"){
      const {fields,files}=await parse(req); const title=String(one(fields.title)||"").trim(),artist=String(one(fields.artist)||"").trim(),mp3=one(files.mp3),cover=one(files.cover);
      if(!title||!artist||!mp3||!cover)return send(res,400,{ok:false,error:"Title, artist, MP3, dan cover wajib diisi."});
      const mm=String(mp3.mimetype||""),cm=String(cover.mimetype||"");
      if(mm!=="audio/mpeg"&&path.extname(mp3.originalFilename||"").toLowerCase()!==".mp3")return send(res,400,{ok:false,error:"File audio harus MP3."});
      if(!["image/jpeg","image/png","image/webp"].includes(cm))return send(res,400,{ok:false,error:"Cover harus JPG, PNG, atau WEBP."});
      const ab=await fs.readFile(mp3.filepath),cb=await fs.readFile(cover.filepath); if(ab.length>4*1024*1024)return send(res,400,{ok:false,error:"MP3 maksimal 4 MB."});
      const id=crypto.randomUUID(),base=clean(title)+"-"+id.slice(0,8),ext=cm==="image/png"?"png":cm==="image/webp"?"webp":"jpg",ap=`music/${base}.mp3`,cp=`covers/${base}.${ext}`;
      let a,cv; try{a=await put(o,c,ap,ab,`Add music: ${title}`);cv=await put(o,c,cp,cb,`Add cover: ${title}`);}catch(e){if(a){try{await del(o,c,ap,await getSha(o,c,ap),`Rollback music: ${title}`);}catch{}}throw e;}
      await db.collection("music").doc(id).set({title,artist,audioUrl:a.url,coverUrl:cv.url,audioPath:ap,coverPath:cp,createdBy:uid,createdAt:admin.firestore.FieldValue.serverTimestamp()});
      return send(res,200,{ok:true,id,title,artist,audioUrl:a.url,coverUrl:cv.url});
    }
    if(req.method==="DELETE"){let raw="";for await(const ch of req)raw+=ch;const body=JSON.parse(raw||"{}");const id=String(body.id||"");if(!id)return send(res,400,{ok:false,error:"Music ID wajib."});const ref=db.collection("music").doc(id),snap=await ref.get();if(!snap.exists)return send(res,404,{ok:false,error:"Music tidak ditemukan."});const s=snap.data();for(const p of [s.audioPath,s.coverPath]){if(!p)continue;try{await del(o,c,p,await getSha(o,c,p),`Delete music: ${s.title||id}`);}catch(e){console.warn("GitHub delete gagal",p,e.message);}}await ref.delete();return send(res,200,{ok:true});}
    return send(res,405,{ok:false,error:"Method tidak didukung."});
  }catch(e){console.error(e);return send(res,e.status||500,{ok:false,error:e.message||"Server error."});}
}
