import { NextResponse } from "next/server";

const PUBLIC_BASE=process.env.RAIL_API_BASE_URL||"https://indian-railway-api.onrender.com";
const RR_BASE=process.env.RAILRADAR_BASE_URL||"https://api.railradar.in";

const searchCache = new Map<string, { payload: unknown; expiresAt: number }>();
const CACHE_TTL_MS = 15 * 60 * 1000;

async function fetchJson(url:string, headers:Record<string,string>={}, timeoutMs = 4500){
 const controller = new AbortController();
 const timeout = setTimeout(() => controller.abort(), timeoutMs);
 try {
  const r=await fetch(url,{headers,cache:"no-store",signal:controller.signal});
  if(!r.ok) throw new Error(`upstream ${r.status}`);
  return r.json();
 } finally {
  clearTimeout(timeout);
 }
}

export async function GET(req:Request){
 const {searchParams}=new URL(req.url);
 const from=searchParams.get("from")||"JP";
 const to=searchParams.get("to")||"NDLS";
 const date=searchParams.get("date")||new Date().toISOString().slice(0,10);
 const byCity=searchParams.get("byCity")==="true";
 const cacheKey=`${from}:${to}:${date}:${byCity}`;
 const cached=searchCache.get(cacheKey);
 if(cached && cached.expiresAt>Date.now()) return NextResponse.json(cached.payload);
 try{
  const data=await fetchJson(`${PUBLIC_BASE}/api/trains?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}&date=${encodeURIComponent(date)}`);
  const payload={source:"public-indian-railway-api",live:true,checkedAt:new Date().toISOString(),data:data?.data||[]};
  searchCache.set(cacheKey,{payload,expiresAt:Date.now()+CACHE_TTL_MS});
  return NextResponse.json(payload);
 }catch(publicError){
  const key=process.env.RAILRADAR_API_KEY;
  if(key){
   try{
    const data=await fetchJson(`${RR_BASE}/v1/trains/between/${encodeURIComponent(from)}/${encodeURIComponent(to)}?date=${encodeURIComponent(date)}&byCity=${byCity}&live=true`,{Authorization:`Bearer ${key}`});
    const payload={source:"railradar",live:true,checkedAt:new Date().toISOString(),data:data?.data?.trains||data?.data||[]};
    searchCache.set(cacheKey,{payload,expiresAt:Date.now()+CACHE_TTL_MS});
    return NextResponse.json(payload);
   }catch(rrError){return NextResponse.json({source:"unavailable",live:false,error:"Railway data service unavailable",details:String(rrError)}, {status:502});}
  }
  return NextResponse.json({source:"unavailable",live:false,error:"Live railway data is unavailable. Add RAIL_API_BASE_URL or RAILRADAR_API_KEY."},{status:502});
 }
}
