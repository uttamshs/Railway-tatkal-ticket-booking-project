import { NextResponse } from "next/server";

const PUBLIC_BASE=process.env.RAIL_API_BASE_URL||"https://indian-railway-api.onrender.com";
const RR_BASE=process.env.RAILRADAR_BASE_URL||"https://api.railradar.in";
const TIMEOUT_MS=4500;

async function jsonWithTimeout(url:string,headers:Record<string,string>={}){
 const controller=new AbortController();
 const timer=setTimeout(()=>controller.abort(),TIMEOUT_MS);
 try{
  const r=await fetch(url,{headers,cache:"no-store",signal:controller.signal});
  const text=await r.text();
  let body:any=null;
  try{body=text?JSON.parse(text):null;}catch{body=text;}
  if(!r.ok)throw new Error(String(r.status));
  return body;
 }finally{clearTimeout(timer);}
}

function extractStatus(raw:any,date:string){
 const d=raw?.data||raw;
 const day=d?.avlDayList?.find((x:any)=>x?.availablityDate===date||x?.availabilityDate===date);
 const value=day?.availablityStatus||day?.availabilityStatus||d?.status||d?.availability;
 if(value!==undefined&&value!==null) return String(value);
 if(typeof d?.available==="number") return d.available>0?`${d.available} available`:"0 available";
 return "Live response received";
}

export async function GET(req:Request){
 const q=new URL(req.url).searchParams;
 const train=q.get("train")||"";
 const from=q.get("from")||"JP";
 const to=q.get("to")||"NDLS";
 const date=q.get("date")||"";
 const cls=q.get("class")||"3A";
 const quota=q.get("quota")||"GN";
 if(!train||!date)return NextResponse.json({error:"train and date are required"},{status:400});

 const key=process.env.RAILRADAR_API_KEY;
 const requests:Array<Promise<any>>=[];

 // Prefer the authenticated RailRadar availability feed when configured.
 if(key){
  requests.push(jsonWithTimeout(`${RR_BASE}/v1/trains/${encodeURIComponent(train)}/seats?journeyDate=${encodeURIComponent(date)}&source=${encodeURIComponent(from)}&destination=${encodeURIComponent(to)}&classCode=${encodeURIComponent(cls)}&quotaCode=${encodeURIComponent(quota)}`,{Authorization:`Bearer ${key}`})
   .then(data=>({source:"railradar",data,status:extractStatus(data,date)})));
 }

 // Keep the public adapter as a fallback. Both requests are bounded so neither can hang the UI.
 requests.push(jsonWithTimeout(`${PUBLIC_BASE}/api/availability?train=${encodeURIComponent(train)}&from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}&date=${encodeURIComponent(date)}&class=${encodeURIComponent(cls)}`)
  .then(data=>({source:"public-indian-railway-api",data,status:extractStatus(data,date)})));

 try{
  const winner=await Promise.any(requests);
  return NextResponse.json({source:winner.source,live:true,checkedAt:new Date().toISOString(),status:winner.status,data:winner.data?.data||winner.data});
 }catch{
  return NextResponse.json({source:"unavailable",live:false,error:"Live availability is temporarily unavailable. Please try again."},{status:502});
 }
}
