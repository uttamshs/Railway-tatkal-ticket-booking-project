export type Priority = "balanced" | "availability" | "fare" | "arrival" | "comfort";
export type Berth = "Any" | "Lower" | "Middle" | "Upper" | "Side Lower" | "Side Upper";
export type LegDirection = "outbound" | "return";
export type Passenger = { id:string; name:string; age:number; gender:string; berth:Berth; idVerified:boolean; relation?:string; classPreference?:string };
export type ClassAvailability = { code:string; status:string; fare?:number; source:"live"|"prototype" };
export type Train = {
 id:string; number:string; name:string; from:string; fromCode:string; to:string; toCode:string;
 departure:string; arrival:string; duration:string; runsOn:string[]; classes:string[];
 classAvailability:ClassAvailability[]; fare:number; availability:string; availabilityType:"available"|"rac"|"waitlist"|"unknown";
 platform?:string; running?:string; punctuality?:string; amenities:string[]; trainType?:string;
 scheduleSource:string; liveSource:"live"|"prototype"; lastUpdated?:string;
};
export type LegPlan = { id:string; from:string; fromCode:string; to:string; toCode:string; date:string; train:Train|null; classCode:string; quota:string };
