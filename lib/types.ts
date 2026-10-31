export type Priority = "balanced" | "availability" | "fare" | "arrival" | "comfort";
export type CopilotAction =
  | { type: "select_train"; value: string; label: string }
  | { type: "set_priority"; value: Priority; label: string }
  | { type: "switch_view"; value: "canvas" | "list"; label: string };
export type CopilotHistoryMessage = { sender: "user" | "assistant"; text: string };
export type CopilotTrainClass = { code: string; status: string; source: string; checkedAt: string | null };
export type CopilotTrainData = {
  id: string;
  number: string;
  name: string;
  fromCode: string;
  toCode: string;
  departure: string;
  arrival: string;
  duration: string;
  fare: number;
  classes: CopilotTrainClass[];
};
export type CopilotRequest = {
  message: string;
  history: CopilotHistoryMessage[];
  date: string;
  quota: string;
  priority: Priority;
  passengerAges: number[];
  selectedTrainId: string | null;
  trains: CopilotTrainData[];
};
export type CopilotResponse = { answer: string; action: CopilotAction | null };
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
