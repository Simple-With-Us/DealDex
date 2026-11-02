import assert from 'node:assert/strict';
import { test } from 'node:test';
import middleware from '../../../server/middleware/datadog.ts';
const keys=['DD_API_KEY','DATADOG_API_KEY','DD_REQUIRE','VERCEL_ENV'];
async function withEnv(values:Record<string,string>, fn:()=>Promise<void>){
 const before=Object.fromEntries(keys.map(k=>[k,process.env[k]]));
 for(const k of keys)delete process.env[k];Object.assign(process.env,values);
 try{await fn();}finally{for(const k of keys){if(before[k]===undefined)delete process.env[k];else process.env[k]=before[k];}}
}
const event={url:new URL('https://example.invalid/test'),req:{method:'GET',headers:new Headers()}};
test('production dark middleware preserves response and makes no fetch',async()=>withEnv({VERCEL_ENV:'production'},async()=>{
 const fetchBefore=globalThis.fetch;let calls=0;globalThis.fetch=(async()=>{calls++;throw Error('unexpected fetch');}) as typeof fetch;
 try{const response=new Response('ok',{status:201});let nextCalls=0;assert.equal(await middleware(event,()=>{nextCalls++;return response;}),response);assert.equal(nextCalls,1);assert.equal(calls,0);}finally{globalThis.fetch=fetchBefore;}
}));
test('explicit require keeps503 and never invokes app',async()=>withEnv({VERCEL_ENV:'production',DD_REQUIRE:'1'},async()=>{
 let called=false;const response=await middleware(event,()=>{called=true;return new Response('bad');});assert.equal((response as Response).status,503);assert.equal(called,false);
}));
test('dark middleware preserves app error',async()=>withEnv({VERCEL_ENV:'production'},async()=>{
 const error=new Error('app error');await assert.rejects(()=>middleware(event,()=>{throw error;}),e=>e===error);
}));
