import type { SupabaseClient } from '@supabase/supabase-js';
import { resourceMimeType } from './resource-validation';

export function uploadPrivateResourceFile(db:SupabaseClient,file:File,storagePath:string,onProgress:(percent:number)=>void,signal?:AbortSignal):Promise<void>{
  return new Promise(async(resolve,reject)=>{
    const {data:{session},error:sessionError}=await db.auth.getSession();
    if(sessionError||!session?.access_token){reject(new Error('Your session has expired. Sign in again and retry.'));return;}
    const base=(import.meta.env.VITE_SUPABASE_URL as string|undefined)?.replace(/\/$/,'');
    if(!base){reject(new Error('Supabase URL is not configured.'));return;}
    const path=storagePath.split('/').map(encodeURIComponent).join('/');
    const xhr=new XMLHttpRequest();let settled=false;
    const fail=(error:Error)=>{if(settled)return;settled=true;reject(error);};
    const onAbort=()=>xhr.abort();
    if(signal?.aborted){fail(new Error('Upload cancelled.'));return;}
    signal?.addEventListener('abort',onAbort,{once:true});
    xhr.open('POST',`${base}/storage/v1/object/classflow-resources/${path}`);
    xhr.setRequestHeader('apikey',import.meta.env.VITE_SUPABASE_ANON_KEY as string);
    xhr.setRequestHeader('Authorization',`Bearer ${session.access_token}`);
    xhr.setRequestHeader('Content-Type',resourceMimeType(file));
    xhr.setRequestHeader('x-upsert','false');xhr.timeout=10*60*1000;
    xhr.upload.onprogress=(event)=>{if(event.lengthComputable)onProgress(Math.min(99,Math.round(event.loaded/event.total*100)));};
    xhr.onload=()=>{signal?.removeEventListener('abort',onAbort);if(xhr.status>=200&&xhr.status<300){onProgress(100);if(!settled){settled=true;resolve();}return;}let message=`Storage rejected the upload (${xhr.status}).`;try{const body=JSON.parse(xhr.responseText);message=body.message||body.error||message;}catch{}fail(new Error(message));};
    xhr.onerror=()=>{signal?.removeEventListener('abort',onAbort);fail(new Error('Network error while uploading this file.'))};
    xhr.ontimeout=()=>{signal?.removeEventListener('abort',onAbort);fail(new Error('Upload timed out. Retry this file.'))};
    xhr.onabort=()=>{signal?.removeEventListener('abort',onAbort);fail(new Error('Upload cancelled.'))};
    xhr.send(file);
  });
}
