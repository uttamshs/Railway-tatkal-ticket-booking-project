import { Passenger, Priority, Train } from "./types";

const mins=(s:string)=>{const [h,m]=s.split(":").map(Number);return h*60+m};
const liveScore=(t:Train)=>t.availabilityType==="available"?3:t.availabilityType==="rac"?2:t.availabilityType==="waitlist"?1:0;

export function scoreTrain(t:Train, priority:Priority, passengers:Passenger[], groupTogether:boolean){
 const avail=liveScore(t), fare=1/(Math.max(t.fare,1)), arrival=1/(Math.max(mins(t.arrival),1)), comfort=t.amenities.length/6;
 let score=0.35*avail+0.15*fare+0.2*arrival+0.1*comfort;
 if(priority==="availability") score+=0.7*avail;
 if(priority==="fare") score+=1.2*fare*500;
 if(priority==="arrival") score+=1.2*arrival*500;
 if(priority==="comfort") score+=0.8*comfort;
 if(groupTogether) score+=0.12;
 if(passengers.some(p=>p.age>=60) && t.classes.some(c=>["1A","2A","3A"].includes(c))) score+=0.12;
 if(passengers.some(p=>p.age<12) && t.classes.length>0) score+=0.05;
 return score;
}

export function rankTrains(items:Train[], priority:Priority, passengers:Passenger[], groupTogether=true){return [...items].sort((a,b)=>scoreTrain(b,priority,passengers,groupTogether)-scoreTrain(a,priority,passengers,groupTogether));}

export function tradeoffs(t:Train, alternatives:Train[]){
 const cheaper=alternatives.filter(x=>x.fare<t.fare).sort((a,b)=>a.fare-b.fare)[0];
 const faster=alternatives.filter(x=>x.arrival<t.arrival).sort((a,b)=>mins(a.arrival)-mins(b.arrival))[0];
 return {
  gains:[t.availabilityType==="available"?"Better current availability":null, t.fare<=700?"Lower fare band":null, t.amenities.includes("Catering")?"Catering available":null].filter(Boolean) as string[], 
  sacrifices:[cheaper?`₹${t.fare-cheaper.fare} more than ${cheaper.number}`:null, faster?`Arrives later than ${faster.number}`:null, t.toCode!=="NDLS"?`Arrives at ${t.toCode}, not New Delhi`:null].filter(Boolean) as string[]
 };
}
