import { createClient } from 'npm:@supabase/supabase-js@2.57.4';
import { AccessToken } from 'npm:livekit-server-sdk@2.13.3';
const cors={ 'Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'authorization, x-client-info, apikey, content-type','Access-Control-Allow-Methods':'POST, OPTIONS' };
const json=(body:unknown,status=200)=>new Response(JSON.stringify(body),{status,headers:{...cors,'Content-Type':'application/json'}});
Deno.serve(async(req)=>{
 if(req.method==='OPTIONS')return new Response('ok',{headers:cors});if(req.method!=='POST')return json({error:'Method not allowed'},405);
 const url=Deno.env.get('SUPABASE_URL'),anon=Deno.env.get('SUPABASE_ANON_KEY'),service=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');if(!url||!anon||!service)return json({error:'Backend integration is incomplete.'},503);
 const livekitUrl=Deno.env.get('LIVEKIT_URL'),apiKey=Deno.env.get('LIVEKIT_API_KEY'),apiSecret=Deno.env.get('LIVEKIT_API_SECRET');if(!livekitUrl||!apiKey||!apiSecret)return json({error:'Audio and video calls are not configured for this campus.'},503);
 const authorization=req.headers.get('Authorization');if(!authorization)return json({error:'Sign in is required.'},401);const userClient=createClient(url,anon,{global:{headers:{Authorization:authorization}},auth:{persistSession:false}});const {data:{user}}=await userClient.auth.getUser();if(!user)return json({error:'Session is invalid.'},401);
 const body=await req.json().catch(()=>({}));const conversationId=body.conversation_id;const callType=body.call_type==='video'?'video':'audio';if(typeof conversationId!=='string')return json({error:'conversation_id is required.'},400);
 const {data:membership,error:memberError}=await userClient.from('conversation_members').select('conversation_id').eq('conversation_id',conversationId).eq('user_id',user.id).maybeSingle();if(memberError||!membership)return json({error:'You are not a member of this conversation.'},403);
 const db=createClient(url,service,{auth:{persistSession:false}});const roomName=`cf-${conversationId.slice(0,8)}-${crypto.randomUUID().slice(0,12)}`;const {error:insertError}=await db.from('calls').insert({conversation_id:conversationId,room_name:roomName,call_type:callType,started_by:user.id});if(insertError)return json({error:'Call could not be created.'},502);
 const token=new AccessToken(apiKey,apiSecret,{identity:user.id,name:String(user.user_metadata?.full_name||'ClassFlow member'),ttl:'1h'});token.addGrant({roomJoin:true,room:roomName,canPublish:true,canSubscribe:true,canPublishData:true});return json({url:livekitUrl,token:await token.toJwt(),room_name:roomName,call_type:callType});
});
