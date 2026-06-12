// src/data/constants.ts

export const DESTINATIONS = [
  { name: "Semiliguda",    km: 18,  dur: "30 min",  fare: 500  },
  { name: "Jeypore",       km: 22,  dur: "40 min",  fare: 500  },
  { name: "Boipariguda",   km: 30,  dur: "50 min",  fare: 600  },
  { name: "Kundra",        km: 35,  dur: "1 hr",    fare: 700  },
  { name: "Sunabeda",      km: 42,  dur: "1.1 hr",  fare: 850  },
  { name: "Deomali Peak",  km: 45,  dur: "1.2 hr",  fare: 900  },
  { name: "Damonjodi",     km: 50,  dur: "1.3 hr",  fare: 1000 },
  { name: "Duduma Falls",  km: 52,  dur: "1.5 hr",  fare: 1050 },
  { name: "Narayanpatna",  km: 55,  dur: "1.5 hr",  fare: 1100 },
  { name: "Gupteswar",     km: 60,  dur: "1.7 hr",  fare: 1200 },
  { name: "Nabarangpur",   km: 80,  dur: "2 hr",    fare: 1600 },
  { name: "Malkangiri",    km: 135, dur: "3 hr",    fare: 2700 },
  { name: "Rayagada",      km: 148, dur: "3 hr",    fare: 2950 },
  { name: "Vizianagaram",  km: 185, dur: "4 hr",    fare: 3700 },
  { name: "Jagdalpur",     km: 190, dur: "4 hr",    fare: 3800 },
  { name: "Visakhapatnam", km: 220, dur: "4.5 hr",  fare: 4400 },
];

export const DAY_TRIPS = [
  { name: "Deomali Peak",      emoji: "⛰️", tag: "Full Day",   fare: 2000, km: 53, desc: "Odisha's highest peak at 1,672m" },
  { name: "Gupteswar Cave",    emoji: "🕌", tag: "Pilgrimage", fare: 3000, km: 76, desc: "Ancient Shiva shrine in sacred forest" },
  { name: "Duduma Falls",      emoji: "💧", tag: "Waterfall",  fare: 2700, km: 68, desc: "500ft cascade over Machkund canyon" },
  { name: "Kolab Reservoir",   emoji: "🌅", tag: "Scenic",     fare: 1000, km: 14, desc: "Sunset boating on calm blue waters" },
  { name: "Sunabeda Wildlife", emoji: "🐯", tag: "Wildlife",   fare: 1500, km: 39, desc: "Tiger reserve — dawn safari drives" },
];

export const PICKUP_TIMES = [
  "05:00 AM","06:00 AM","07:00 AM","08:00 AM","09:00 AM",
  "10:00 AM","11:00 AM","12:00 PM","01:00 PM","02:00 PM",
  "04:00 PM","06:00 PM","08:00 PM","10:00 PM",
];

export const SUPPORT_PHONE = "+919668021577";
export const SUPPORT_WA    = "https://wa.me/919668021577";

export const fmt    = (n: number) => "₹" + n.toLocaleString("en-IN");
export const genRef = () => "GR-" + Math.floor(1000 + Math.random() * 9000);
