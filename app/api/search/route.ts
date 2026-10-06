import { NextResponse } from "next/server";

const PUBLIC_BASE=process.env.RAIL_API_BASE_URL||"https://indian-railway-api.onrender.com";
const RR_BASE=process.env.RAILRADAR_BASE_URL||"https://api.railradar.in";

async function fetchJson(url:string, headers:Record<string,string>={}){
 const r=await fetch(url,{headers,cache:"no-store"});
 if(!r.ok) throw new Error(`upstream ${r.status}`);
 return r.json();
}

export async function GET(req:Request){
 const {searchParams}=new URL(req.url);
 const from=searchParams.get("from")||"JP";
 const to=searchParams.get("to")||"NDLS";
 const date=searchParams.get("date")||new Date().toISOString().slice(0,10);
 const byCity=searchParams.get("byCity")==="true";
 try{
  const data=await fetchJson(`${PUBLIC_BASE}/api/trains?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}&date=${encodeURIComponent(date)}`);
  return NextResponse.json({source:"public-indian-railway-api",live:true,checkedAt:new Date().toISOString(),data:data?.data||[]});
 }catch(publicError){
  const key=process.env.RAILRADAR_API_KEY;
  if(key){
   try{
    const data=await fetchJson(`${RR_BASE}/v1/trains/between/${encodeURIComponent(from)}/${encodeURIComponent(to)}?date=${encodeURIComponent(date)}&byCity=${byCity}&live=true`,{Authorization:`Bearer ${key}`});
    return NextResponse.json({source:"railradar",live:true,checkedAt:new Date().toISOString(),data:data?.data?.trains||data?.data||[]});
   }catch(rrError){return NextResponse.json({source:"unavailable",live:false,error:"Railway data service unavailable",details:String(rrError)}, {status:502});}
  }
  return NextResponse.json({source:"unavailable",live:false,error:"Live railway data is unavailable. Add RAIL_API_BASE_URL or RAILRADAR_API_KEY."},{status:502});
 }
}
