import { Passenger, Train } from "./types";

export const stationClusters = {
  jaipur: [{code:"JP",name:"Jaipur Junction",note:"Jaipur city rail hub"}],
  delhi: [
    {code:"NDLS",name:"New Delhi",note:"Central Delhi"},
    {code:"DLI",name:"Delhi Junction",note:"Old Delhi"},
    {code:"DEE",name:"Delhi Sarai Rohilla",note:"North-west Delhi"},
    {code:"DEC",name:"Delhi Cantt",note:"West Delhi"},
    {code:"SSB",name:"Shakur Basti",note:"North-west Delhi"},
  ],
} as const;

export const savedPassengers: Passenger[] = [
 {id:"p1",name:"Passenger 1",age:21,gender:"Male",idVerified:true,berth:"Any",relation:"Adult",classPreference:"Any"},
 {id:"p2",name:"Passenger 2",age:22,gender:"Female",idVerified:true,berth:"Side Lower",relation:"Adult",classPreference:"Any"},
 {id:"p3",name:"Passenger 3",age:67,gender:"Male",idVerified:true,berth:"Lower",relation:"Senior",classPreference:"2A"},
 {id:"p4",name:"Passenger 4",age:9,gender:"Female",idVerified:true,berth:"Lower",relation:"Child",classPreference:"Any"},
];

export const fallbackJourneys = [
 {number:"12016",name:"Ajmer–New Delhi Shatabdi",departure:"17:35",arrival:"22:30",toCode:"NDLS"},
 {number:"12957",name:"Swarna Jayanti Rajdhani",departure:"02:50",arrival:"07:30",toCode:"NDLS"},
 {number:"12985",name:"Jaipur–Delhi AC Double Decker",departure:"05:45",arrival:"10:25",toCode:"DEE"},
];

export const demoTrains: Train[] = [
 {id:"demo-12957",number:"12957",name:"Swarna Jayanti Rajdhani",from:"Jaipur Junction",fromCode:"JP",to:"New Delhi",toCode:"NDLS",departure:"02:50",arrival:"07:30",duration:"4h 40m",runsOn:["Mon","Tue","Wed","Thu","Fri","Sat","Sun"],classes:["1A","2A","3A"],classAvailability:["1A","2A","3A"].map(code=>({code,status:"Live check required",source:"prototype"})),fare:1060,availability:"Live check required",availabilityType:"unknown",amenities:["AC", "Bedding", "Catering"],trainType:"Rajdhani",scheduleSource:"Demo fallback timetable",liveSource:"prototype"},
 {id:"demo-12985",number:"12985",name:"Jaipur–Delhi AC Double Decker",from:"Jaipur Junction",fromCode:"JP",to:"Delhi Sarai Rohilla",toCode:"DEE",departure:"05:45",arrival:"10:25",duration:"4h 40m",runsOn:["Mon","Tue","Wed","Thu","Fri","Sat","Sun"],classes:["CC","EC"],classAvailability:["CC","EC"].map(code=>({code,status:"Live check required",source:"prototype"})),fare:490,availability:"Live check required",availabilityType:"unknown",amenities:["AC Chair Car","Charging","Catering"],trainType:"Double Decker",scheduleSource:"Demo fallback timetable",liveSource:"prototype"},
 {id:"demo-20977",number:"20977",name:"Vande Bharat Express",from:"Jaipur Junction",fromCode:"JP",to:"Delhi Cantt",toCode:"DEC",departure:"07:47",arrival:"11:30",duration:"3h 43m",runsOn:["Mon","Tue","Wed","Thu","Fri","Sat","Sun"],classes:["CC","EC"],classAvailability:["CC","EC"].map(code=>({code,status:"Live check required",source:"prototype"})),fare:1050,availability:"Live check required",availabilityType:"unknown",amenities:["AC Chair Car","Wi-Fi","Catering"],trainType:"Vande Bharat",scheduleSource:"Demo fallback timetable",liveSource:"prototype"},
 {id:"demo-12016",number:"12016",name:"Ajmer–New Delhi Shatabdi",from:"Jaipur Junction",fromCode:"JP",to:"New Delhi",toCode:"NDLS",departure:"17:35",arrival:"22:30",duration:"4h 55m",runsOn:["Mon","Tue","Wed","Thu","Fri","Sat","Sun"],classes:["CC","EC"],classAvailability:["CC","EC"].map(code=>({code,status:"Live check required",source:"prototype"})),fare:690,availability:"Live check required",availabilityType:"unknown",amenities:["AC Chair Car","Catering","Charging"],trainType:"Shatabdi",scheduleSource:"Demo fallback timetable",liveSource:"prototype"},
];
