import { useState, useEffect, useRef, useMemo } from "react";
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, BarChart, Bar } from "recharts";
import { Search, MapPin, AlertTriangle, X, Send, Loader, RefreshCw, Thermometer } from "lucide-react";

// ═══════════════════════════════════════════════════════════════════════════════
// CONSTANTS & UTILITIES
// ═══════════════════════════════════════════════════════════════════════════════

const WEATHER_ICONS = {
  thunderstorm:"⛈️", drizzle:"🌦️", rain:"🌧️", snow:"❄️",
  fog:"🌫️", mist:"🌫️", haze:"🌫️", clear:"☀️", clouds:"☁️",
};

function getWeatherTypeFromCondition(cond) {
  if (!cond) return "clear";
  const c = cond.toLowerCase();
  if (c.includes("thunder") || c.includes("storm")) return "thunderstorm";
  if (c.includes("drizzle")) return "drizzle";
  if (c.includes("rain") || c.includes("shower")) return "rain";
  if (c.includes("snow") || c.includes("sleet") || c.includes("blizzard")) return "snow";
  if (c.includes("fog") || c.includes("mist") || c.includes("haze") || c.includes("smoke")) return "fog";
  if (c.includes("clear") || c.includes("sunny")) return "clear";
  return "clouds";
}

function getTimeOfDay(h) {
  if (h >= 6  && h < 12) return "morning";
  if (h >= 12 && h < 17) return "afternoon";
  if (h >= 17 && h < 20) return "evening";
  return "night";
}

function getBackground(tod, wtype) {
  const overrides = {
    thunderstorm:"linear-gradient(160deg,#0d1117 0%,#1a2a6c 50%,#2c3e50 100%)",
    rain:        "linear-gradient(160deg,#1e3a5f 0%,#2d5986 50%,#3d7ab5 100%)",
    drizzle:     "linear-gradient(160deg,#2c4a6e 0%,#3d6694 100%)",
    snow:        "linear-gradient(160deg,#a8bfcc 0%,#c9dde8 50%,#e0ecf3 100%)",
    fog:         "linear-gradient(160deg,#7a8d96 0%,#b0bec5 50%,#cfd8dc 100%)",
  };
  const tod_bgs = {
    morning:   "linear-gradient(160deg,#f7971e 0%,#f5a733 35%,#69b9ef 65%,#1a6ec4 100%)",
    afternoon: "linear-gradient(160deg,#0575e6 0%,#1a9be8 50%,#21d4fd 100%)",
    evening:   "linear-gradient(160deg,#c94b4b 0%,#e0703a 40%,#6b2580 100%)",
    night:     "linear-gradient(160deg,#0f0c29 0%,#302b63 50%,#24243e 100%)",
  };
  return overrides[wtype] || tod_bgs[tod];
}

function getMoonPhase() {
  const known = new Date(2000,0,6,18,14);
  const diff = (Date.now() - known) / 86400000;
  const phase = ((diff % 29.53) + 29.53) % 29.53;
  if (phase < 1.85)  return {icon:"🌑",name:"New Moon"};
  if (phase < 7.38)  return {icon:"🌒",name:"Waxing Crescent"};
  if (phase < 9.22)  return {icon:"🌓",name:"First Quarter"};
  if (phase < 14.77) return {icon:"🌔",name:"Waxing Gibbous"};
  if (phase < 16.61) return {icon:"🌕",name:"Full Moon"};
  if (phase < 22.15) return {icon:"🌖",name:"Waning Gibbous"};
  if (phase < 23.99) return {icon:"🌗",name:"Last Quarter"};
  return {icon:"🌘",name:"Waning Crescent"};
}

const AQI_COLORS = {
  "Good":"#00e676","Fair":"#ffee58","Moderate":"#ff9800","Poor":"#f44336","Very Poor":"#9c27b0"
};

const CLAUDE = async (system, userMsg, useSearch = false) => {
  const body = {
    model: "claude-sonnet-4-6",
    max_tokens: 1500,
    system,
    messages: [{ role: "user", content: userMsg }],
  };
  if (useSearch) body.tools = [{ type: "web_search_20250305", name: "web_search" }];

  const r = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": import.meta.env.VITE_ANTHROPIC_KEY=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,  // ← your key
      "anthropic-version": "2023-06-01",                 // ← required
    },
    body: JSON.stringify(body),
  });
  const d = await r.json();
  return d.content.filter(b => b.type === "text").map(b => b.text).join("");
};

// ═══════════════════════════════════════════════════════════════════════════════
// GLOBAL CSS
// ═══════════════════════════════════════════════════════════════════════════════

const GLOBAL_CSS = `
  *{margin:0;padding:0;box-sizing:border-box}
  body{font-family:system-ui,-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif}

  @keyframes rainFall{
    0%{transform:translateY(-30px) rotate(14deg);opacity:0}
    5%{opacity:.75}95%{opacity:.75}
    100%{transform:translateY(110vh) rotate(14deg);opacity:0}
  }
  .rain-drop{position:absolute;width:1.5px;background:linear-gradient(transparent,rgba(174,214,241,.75));border-radius:2px;pointer-events:none;animation:rainFall linear infinite}

  @keyframes snowFall{
    0%{transform:translateY(-20px) translateX(0);opacity:0}
    5%{opacity:.9}40%{transform:translateY(40vh) translateX(22px)}
    60%{transform:translateY(60vh) translateX(-16px)}95%{opacity:.9}
    100%{transform:translateY(110vh) translateX(8px);opacity:0}
  }
  .snow-flake{position:absolute;background:white;border-radius:50%;pointer-events:none;animation:snowFall ease-in-out infinite}

  @keyframes twinkle{0%,100%{opacity:.2;transform:scale(1)}50%{opacity:1;transform:scale(1.5)}}
  .star{position:absolute;background:white;border-radius:50%;pointer-events:none;animation:twinkle ease-in-out infinite}

  @keyframes lightning{0%,86%,100%{opacity:0}87%,89%{opacity:.2}88%{opacity:.75}}
  .lightning-flash{position:fixed;inset:0;background:white;pointer-events:none;animation:lightning 6s ease-in-out infinite}

  @keyframes fogDrift{0%,100%{transform:translateX(-4%)}50%{transform:translateX(4%)}}
  .fog-overlay{position:fixed;inset:0;pointer-events:none;background:radial-gradient(ellipse 80% 55% at 50% 50%,rgba(255,255,255,.14),transparent);animation:fogDrift 9s ease-in-out infinite}

  .glass{backdrop-filter:blur(22px);-webkit-backdrop-filter:blur(22px);background:rgba(255,255,255,.12);border:1px solid rgba(255,255,255,.25);border-radius:22px;box-shadow:0 8px 32px rgba(0,0,0,.28);color:white;transition:background .25s}
  .glass:hover{background:rgba(255,255,255,.18)}
  .glass-subtle{backdrop-filter:blur(14px);-webkit-backdrop-filter:blur(14px);background:rgba(255,255,255,.09);border:1px solid rgba(255,255,255,.18);border-radius:16px;box-shadow:0 4px 16px rgba(0,0,0,.2);color:white;transition:background .2s,transform .2s}
  .glass-subtle:hover{background:rgba(255,255,255,.15);transform:translateY(-2px)}

  .glass-input{background:rgba(255,255,255,.15);border:1px solid rgba(255,255,255,.3);border-radius:50px;color:white;outline:none;width:100%;transition:background .2s,border-color .2s}
  .glass-input::placeholder{color:rgba(255,255,255,.55)}
  .glass-input:focus{background:rgba(255,255,255,.25);border-color:rgba(255,255,255,.55)}

  .glass-btn{background:rgba(255,255,255,.15);border:1px solid rgba(255,255,255,.3);border-radius:50px;color:white;cursor:pointer;backdrop-filter:blur(10px);display:flex;align-items:center;justify-content:center;transition:background .2s,transform .15s}
  .glass-btn:hover{background:rgba(255,255,255,.3)}
  .glass-btn:active{transform:scale(.96)}

  .forecast-row{overflow-x:auto;display:flex;gap:12px;padding-bottom:6px}
  .forecast-row::-webkit-scrollbar{height:4px}
  .forecast-row::-webkit-scrollbar-thumb{background:rgba(255,255,255,.35);border-radius:2px}

  .chat-scroll{overflow-y:auto;display:flex;flex-direction:column;gap:10px}
  .chat-scroll::-webkit-scrollbar{width:4px}
  .chat-scroll::-webkit-scrollbar-thumb{background:rgba(255,255,255,.3);border-radius:2px}

  @keyframes fadeUp{from{opacity:0;transform:translateY(14px)}to{opacity:1;transform:translateY(0)}}
  .fade-up{animation:fadeUp .45s ease forwards}

  @keyframes slideUp{from{opacity:0;transform:translateY(22px) scale(.95)}to{opacity:1;transform:translateY(0) scale(1)}}
  .slide-up{animation:slideUp .38s cubic-bezier(.34,1.56,.64,1)}

  @keyframes spin{to{transform:rotate(360deg)}}
  .spin{animation:spin 1s linear infinite;display:inline-flex}

  @keyframes alertSlide{from{transform:translateY(-100%)}to{transform:translateY(0)}}
  .alert-slide{animation:alertSlide .35s ease}

  @media(max-width:640px){
    .stats-grid{grid-template-columns:repeat(2,1fr)!important}
    .main-temp{font-size:80px!important}
    .header-row{flex-wrap:wrap}
  }
  @media(max-width:380px){.main-temp{font-size:64px!important}}
`;

// ═══════════════════════════════════════════════════════════════════════════════
// WEATHER PARTICLE EFFECTS
// ═══════════════════════════════════════════════════════════════════════════════

function WeatherEffects({wtype,tod}) {
  const drops = useMemo(()=>{
    if (wtype!=="rain"&&wtype!=="drizzle") return [];
    const n=wtype==="rain"?90:45;
    return Array.from({length:n},(_,i)=>({id:i,left:Math.random()*100,height:8+Math.random()*22,dur:0.38+Math.random()*0.55,delay:Math.random()*2.5}));
  },[wtype]);
  const flakes = useMemo(()=>{
    if (wtype!=="snow") return [];
    return Array.from({length:65},(_,i)=>({id:i,left:Math.random()*100,size:3+Math.random()*5,dur:3.5+Math.random()*5,delay:Math.random()*6}));
  },[wtype]);
  const stars = useMemo(()=>{
    if (wtype!=="clear"||tod!=="night") return [];
    return Array.from({length:90},(_,i)=>({id:i,left:Math.random()*100,top:Math.random()*72,size:1+Math.random()*2.5,dur:1.8+Math.random()*3.5,delay:Math.random()*4}));
  },[wtype,tod]);
  return (
    <div style={{position:"fixed",inset:0,pointerEvents:"none",zIndex:0,overflow:"hidden"}}>
      {drops.map(d=><div key={d.id} className="rain-drop" style={{left:`${d.left}%`,height:`${d.height}px`,animationDuration:`${d.dur}s`,animationDelay:`${d.delay}s`}}/>)}
      {flakes.map(f=><div key={f.id} className="snow-flake" style={{left:`${f.left}%`,top:"-20px",width:`${f.size}px`,height:`${f.size}px`,animationDuration:`${f.dur}s`,animationDelay:`${f.delay}s`}}/>)}
      {stars.map(s=><div key={s.id} className="star" style={{left:`${s.left}%`,top:`${s.top}%`,width:`${s.size}px`,height:`${s.size}px`,animationDuration:`${s.dur}s`,animationDelay:`${s.delay}s`}}/>)}
      {wtype==="thunderstorm"&&<div className="lightning-flash"/>}
      {(wtype==="fog"||wtype==="mist"||wtype==="haze")&&<div className="fog-overlay"/>}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// LANDING SCREEN
// ═══════════════════════════════════════════════════════════════════════════════

function LandingScreen({onSearch, loading}) {
  const [val, setVal] = useState("");
  const popular = ["Ahmedabad","Tokyo","New York","London","Mumbai","Dubai","Paris","Sydney"];
  return (
    <div style={{minHeight:"100vh",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",
      background:"linear-gradient(160deg,#0f0c29 0%,#302b63 50%,#24243e 100%)",padding:24,textAlign:"center"}}>
      <WeatherEffects wtype="clear" tod="night"/>
      <div style={{position:"relative",zIndex:1,maxWidth:560,width:"100%"}}>
        <div style={{fontSize:80,marginBottom:16,lineHeight:1}}>🌦️</div>
        <h1 style={{fontSize:32,fontWeight:700,color:"white",marginBottom:8,letterSpacing:-0.5}}>AI Weather Forecast</h1>
        <p style={{color:"rgba(255,255,255,.65)",fontSize:15,marginBottom:36,lineHeight:1.7}}>
          Real-time weather · AI assistant · Animated effects<br/>
          Disaster alerts · Air quality · 7-day forecast
        </p>
        <div style={{display:"flex",gap:10,marginBottom:24}}>
          <input className="glass-input" value={val} onChange={e=>setVal(e.target.value)}
            onKeyDown={e=>e.key==="Enter"&&val.trim()&&onSearch(val.trim())}
            placeholder="Enter any city — Tokyo, London, Ahmedabad…"
            style={{flex:1,padding:"14px 20px",fontSize:15}}/>
          <button className="glass-btn" onClick={()=>val.trim()&&onSearch(val.trim())}
            style={{padding:"14px 22px",fontWeight:600,fontSize:15,gap:8,whiteSpace:"nowrap",borderRadius:50}}>
            {loading?<span className="spin"><Loader size={18}/></span>:<><Search size={17}/> Search</>}
          </button>
        </div>
        <div style={{display:"flex",flexWrap:"wrap",gap:8,justifyContent:"center"}}>
          {popular.map(c=>(
            <button key={c} onClick={()=>onSearch(c)} className="glass-btn"
              style={{padding:"8px 16px",fontSize:13,borderRadius:30}}>
              {c}
            </button>
          ))}
        </div>
        <div style={{marginTop:32,padding:"14px 20px",background:"rgba(99,179,237,.1)",borderRadius:14,
          border:"1px solid rgba(99,179,237,.2)"}}>
          <p style={{fontSize:12,color:"rgba(255,255,255,.75)",lineHeight:1.8}}>
            ✨ <strong>No API key needed</strong> — powered by Claude AI with live web search.<br/>
            🤖 Ask the AI assistant anything about weather, travel, or safety.
          </p>
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// AI CHAT PANEL
// ═══════════════════════════════════════════════════════════════════════════════

function AIChat({weather, onClose}) {
  const loc  = weather?.city ? `${weather.city}, ${weather.country}` : "your location";
  const cond = weather?.description || weather?.condition || "unknown";
  const temp = weather?.temp_c != null ? `${Math.round(weather.temp_c)}°C` : "?";

  const [msgs,setMsgs] = useState([{role:"assistant",
    content:`👋 Hi! It's ${temp} with ${cond} in ${loc}. Ask me anything — travel tips, what to wear, UV safety, or outdoor activities!`}]);
  const [inp,setInp]  = useState("");
  const [busy,setBusy] = useState(false);
  const bottomRef = useRef(null);
  useEffect(()=>{bottomRef.current?.scrollIntoView({behavior:"smooth"})},[msgs]);

  const SUGGESTIONS = ["Should I carry an umbrella?","Is it safe to travel today?","What should I wear?","UV index advice?","Best time for outdoor activities?"];

  const send = async (text) => {
    const msg=(text??inp).trim(); if(!msg||busy) return;
    setInp("");
    const next=[...msgs,{role:"user",content:msg}];
    setMsgs(next); setBusy(true);
    try {
      const sysPrompt = weather
        ? `You are a friendly AI weather assistant. Current conditions in ${loc}: ${cond}, temperature ${temp}, feels like ${Math.round(weather.feels_like_c??0)}°C, humidity ${weather.humidity}%, wind ${weather.wind_ms} m/s, pressure ${weather.pressure_hpa} hPa, UV index ${weather.uv_index??'unknown'}, AQI ${weather.aqi_label||'unknown'}. Give concise, practical advice using weather emojis.`
        : "You are a helpful AI weather assistant.";
      const res = await fetch("https://api.anthropic.com/v1/messages",{
        method:"POST", headers:{"Content-Type":"application/json"},
        body:JSON.stringify({model:"claude-sonnet-4-6",max_tokens:600,system:sysPrompt,messages:next.slice(-10)})
      });
      const d = await res.json();
      setMsgs(p=>[...p,{role:"assistant",content:d.content?.[0]?.text||"Sorry, try again."}]);
    } catch {
      setMsgs(p=>[...p,{role:"assistant",content:"⚠️ Network error. Please try again."}]);
    }
    setBusy(false);
  };

  return (
    <div className="glass slide-up" style={{position:"fixed",bottom:90,right:20,width:350,maxHeight:530,
      display:"flex",flexDirection:"column",zIndex:1000,overflow:"hidden",borderRadius:24}}>
      <div style={{padding:"14px 18px",borderBottom:"1px solid rgba(255,255,255,.15)",display:"flex",alignItems:"center",justifyContent:"space-between"}}>
        <div style={{display:"flex",alignItems:"center",gap:10}}>
          <span style={{fontSize:24}}>🤖</span>
          <div>
            <div style={{fontWeight:600,fontSize:14}}>AI Weather Assistant</div>
            <div style={{fontSize:11,opacity:.6}}>Powered by Claude</div>
          </div>
        </div>
        <button onClick={onClose} className="glass-btn" style={{padding:7,borderRadius:"50%",border:"none"}}><X size={15}/></button>
      </div>
      <div className="chat-scroll" style={{flex:1,padding:"14px 14px 8px",minHeight:0}}>
        {msgs.map((m,i)=>(
          <div key={i} style={{padding:"10px 14px",borderRadius:14,maxWidth:"88%",fontSize:13,lineHeight:1.6,
            alignSelf:m.role==="user"?"flex-end":"flex-start",
            background:m.role==="user"?"rgba(99,179,237,.3)":"rgba(255,255,255,.1)",
            border:`1px solid ${m.role==="user"?"rgba(99,179,237,.4)":"rgba(255,255,255,.18)"}`}}>
            {m.content}
          </div>
        ))}
        {busy&&<div style={{alignSelf:"flex-start",padding:"10px 14px",borderRadius:14,background:"rgba(255,255,255,.1)",border:"1px solid rgba(255,255,255,.18)",fontSize:13,display:"flex",alignItems:"center",gap:8}}>
          <span className="spin"><Loader size={13}/></span> Thinking…
        </div>}
        <div ref={bottomRef}/>
      </div>
      {msgs.length===1&&(
        <div style={{padding:"0 14px 10px",display:"flex",flexWrap:"wrap",gap:6}}>
          {SUGGESTIONS.map((s,i)=><button key={i} onClick={()=>send(s)} className="glass-btn" style={{fontSize:11,padding:"5px 11px",borderRadius:20}}>{s}</button>)}
        </div>
      )}
      <div style={{padding:"10px 14px",borderTop:"1px solid rgba(255,255,255,.15)",display:"flex",gap:8}}>
        <input className="glass-input" value={inp} onChange={e=>setInp(e.target.value)}
          onKeyDown={e=>e.key==="Enter"&&send()} placeholder="Ask about the weather…"
          style={{flex:1,padding:"9px 14px",fontSize:13,borderRadius:14}}/>
        <button onClick={()=>send()} className="glass-btn" style={{padding:"9px 12px",borderRadius:12,flexShrink:0}}><Send size={15}/></button>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN APP
// ═══════════════════════════════════════════════════════════════════════════════

export default function App() {
  const [weather,  setWeather]  = useState(null);
  const [quakes,   setQuakes]   = useState([]);
  const [alertIdx, setAlertIdx] = useState(0);
  const [showAlert,setShowAlert]= useState(true);
  const [time,     setTime]     = useState(new Date());
  const [chatOpen, setChatOpen] = useState(false);
  const [loading,  setLoading]  = useState(false);
  const [qLoading, setQLoading] = useState(false);
  const [error,    setError]    = useState("");
  const [searchVal,setSearchVal]= useState("");
  const [unit,     setUnit]     = useState("C");

  useEffect(()=>{
    const el=document.createElement("style");
    el.textContent=GLOBAL_CSS;
    document.head.appendChild(el);
    return ()=>document.head.removeChild(el);
  },[]);

  useEffect(()=>{
    const t=setInterval(()=>setTime(new Date()),1000);
    return ()=>clearInterval(t);
  },[]);

  useEffect(()=>{
    if(quakes.length<2) return;
    const t=setInterval(()=>setAlertIdx(i=>(i+1)%quakes.length),5000);
    return ()=>clearInterval(t);
  },[quakes.length]);

  const fetchWeather = async (city) => {
    setLoading(true); setError(""); setWeather(null);
    try {
      const raw = await CLAUDE(
        `You are a weather data API. Use web search to get the CURRENT REAL weather for the city requested. Return ONLY valid JSON — no markdown fences, no explanation, no extra text. Just the raw JSON object.`,
        `Search for current weather in "${city}" right now and return this exact JSON with real current data filled in:
{"city":"","country":"","temp_c":0,"feels_like_c":0,"temp_max_c":0,"temp_min_c":0,"condition":"","description":"","humidity":0,"wind_ms":0,"wind_deg":0,"pressure_hpa":0,"visibility_km":0,"clouds_pct":0,"sunrise":"06:00","sunset":"20:00","aqi_label":"Good","uv_index":0,"forecast":[{"day":"","min_c":0,"max_c":0,"condition":"","rain_pct":0},{"day":"","min_c":0,"max_c":0,"condition":"","rain_pct":0},{"day":"","min_c":0,"max_c":0,"condition":"","rain_pct":0},{"day":"","min_c":0,"max_c":0,"condition":"","rain_pct":0},{"day":"","min_c":0,"max_c":0,"condition":"","rain_pct":0}],"hourly":[{"time":"","temp_c":0,"rain_pct":0},{"time":"","temp_c":0,"rain_pct":0},{"time":"","temp_c":0,"rain_pct":0},{"time":"","temp_c":0,"rain_pct":0},{"time":"","temp_c":0,"rain_pct":0},{"time":"","temp_c":0,"rain_pct":0},{"time":"","temp_c":0,"rain_pct":0},{"time":"","temp_c":0,"rain_pct":0}]}`,
        true
      );
      const clean = raw.replace(/```json|```/g,"").trim();
      const start = clean.indexOf("{");
      const end   = clean.lastIndexOf("}");
      const data  = JSON.parse(clean.slice(start, end+1));
      setWeather(data);
    } catch(e) {
      setError("Could not load weather. Try another city name.");
    }
    setLoading(false);
  };

  const fetchQuakes = async () => {
    setQLoading(true);
    try {
      const raw = await CLAUDE(
        `You are an earthquake data API. Use web search to find significant earthquakes from the past 7 days. Return ONLY valid JSON array — no markdown, no explanation.`,
        `Search for significant earthquakes worldwide in the last 7 days and return this JSON array (3-5 recent events):
[{"mag":6.5,"place":"100km NE of Tokyo, Japan","time":"2025-06-22 14:30 UTC","alert":"orange"},{"mag":7.1,"place":"Southern Chile","time":"2025-06-20 08:15 UTC","alert":"red"}]`,
        true
      );
      const clean = raw.replace(/```json|```/g,"").trim();
      const s = clean.indexOf("["), e = clean.lastIndexOf("]");
      const list = JSON.parse(clean.slice(s, e+1));
      if (list.length) {
        setQuakes(list); setShowAlert(true); setAlertIdx(0);
        if (navigator.vibrate) navigator.vibrate([400,150,400]);
        if ("speechSynthesis" in window && list[0].mag >= 6) {
          const u = new SpeechSynthesisUtterance("緊急地震速報です。強い地震が発生しました。安全な場所に避難してください。");
          u.lang="ja-JP"; u.rate=0.9; u.volume=0.8;
          window.speechSynthesis.cancel(); window.speechSynthesis.speak(u);
        }
      }
    } catch {}
    setQLoading(false);
  };

  // ── Derived ──
  const wtype = getWeatherTypeFromCondition(weather?.condition);
  const tod   = getTimeOfDay(time.getHours());
  const bg    = weather ? getBackground(tod, wtype) : "linear-gradient(160deg,#0f0c29 0%,#302b63 50%,#24243e 100%)";
  const moon  = getMoonPhase();

  const toTemp = (c) => unit==="C" ? `${Math.round(c)}°C` : `${Math.round(c*9/5+32)}°F`;

  if (!weather && !loading) {
    return <LandingScreen onSearch={fetchWeather} loading={loading}/>;
  }

  return (
    <div style={{minHeight:"100vh",background:bg,position:"relative",
      fontFamily:"system-ui,-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif",
      transition:"background 4s ease"}}>
      <WeatherEffects wtype={wtype} tod={tod}/>

      {/* ── Alert banner ── */}
      {quakes.length>0&&showAlert&&(
        <div className="alert-slide" style={{position:"relative",zIndex:100,
          background:quakes[alertIdx]?.alert==="red"?"rgba(183,28,28,.88)":"rgba(204,82,0,.88)",
          backdropFilter:"blur(12px)",padding:"11px 20px",display:"flex",alignItems:"center",gap:12}}>
          <AlertTriangle size={18} style={{flexShrink:0}}/>
          <div style={{flex:1,fontSize:13,fontWeight:500}}>
            🚨 <strong>M{quakes[alertIdx]?.mag}</strong> — {quakes[alertIdx]?.place}
            <span style={{opacity:.75,marginLeft:8,fontSize:12}}>{quakes[alertIdx]?.time}</span>
            {quakes.length>1&&<span style={{marginLeft:8,opacity:.6,fontSize:11}}>({alertIdx+1}/{quakes.length})</span>}
          </div>
          <button onClick={()=>setShowAlert(false)} style={{background:"none",border:"none",color:"white",cursor:"pointer",padding:4}}><X size={16}/></button>
        </div>
      )}

      {/* ── Content ── */}
      <div style={{position:"relative",zIndex:1,maxWidth:900,margin:"0 auto",padding:"20px 16px 130px"}}>

        {/* ── Header ── */}
        <div className="header-row" style={{display:"flex",gap:10,marginBottom:22,alignItems:"center"}}>
          <input className="glass-input" value={searchVal} onChange={e=>setSearchVal(e.target.value)}
            onKeyDown={e=>e.key==="Enter"&&searchVal.trim()&&fetchWeather(searchVal.trim())}
            placeholder="🔍  Search another city…"
            style={{flex:1,padding:"11px 18px",fontSize:14,minWidth:0}}/>
          <button onClick={()=>searchVal.trim()&&fetchWeather(searchVal.trim())} className="glass-btn"
            style={{padding:"11px 16px",fontWeight:600,fontSize:13,gap:6,whiteSpace:"nowrap"}}>
            {loading?<span className="spin"><Loader size={14}/></span>:<Search size={15}/>} Search
          </button>
          <button onClick={fetchQuakes} className="glass-btn"
            style={{padding:"11px 14px",gap:6,fontSize:13,whiteSpace:"nowrap"}} title="Check earthquake alerts">
            {qLoading?<span className="spin"><Loader size={14}/></span>:<AlertTriangle size={14}/>} Alerts
          </button>
          <button onClick={()=>setUnit(u=>u==="C"?"F":"C")} className="glass-btn"
            style={{padding:"11px 14px",fontWeight:700,fontSize:14}}>°{unit}</button>
        </div>

        {/* ── Clock ── */}
        <div style={{textAlign:"center",marginBottom:22,color:"white"}}>
          <div style={{fontSize:56,fontWeight:200,letterSpacing:-2,textShadow:"0 2px 24px rgba(0,0,0,.35)",lineHeight:1}}>
            {time.toLocaleTimeString("en",{hour:"2-digit",minute:"2-digit",second:"2-digit"})}
          </div>
          <div style={{fontSize:15,opacity:.8,marginTop:8}}>
            {time.toLocaleDateString("en",{weekday:"long",year:"numeric",month:"long",day:"numeric"})}
            &nbsp;·&nbsp;<span style={{opacity:.65}}>{Intl.DateTimeFormat().resolvedOptions().timeZone}</span>
          </div>
        </div>

        {error&&<div className="glass" style={{padding:"12px 18px",marginBottom:16,background:"rgba(244,67,54,.2)",borderColor:"rgba(244,67,54,.4)",borderRadius:14}}>⚠️ {error}</div>}

        {loading&&(
          <div style={{textAlign:"center",padding:70,color:"white"}}>
            <div className="spin" style={{fontSize:44,display:"inline-block"}}>🌀</div>
            <div style={{marginTop:18,opacity:.7,fontSize:15}}>Searching live weather data…</div>
            <div style={{marginTop:8,opacity:.45,fontSize:13}}>Claude is looking this up for you</div>
          </div>
        )}

        {weather&&!loading&&(
          <div className="fade-up">

            {/* ── Hero ── */}
            <div className="glass" style={{padding:"32px 28px",marginBottom:16,textAlign:"center",borderRadius:28}}>
              <div style={{display:"flex",alignItems:"center",justifyContent:"center",gap:8,marginBottom:14,color:"white"}}>
                <MapPin size={16} style={{opacity:.8}}/>
                <span style={{fontSize:20,fontWeight:500}}>{weather.city}, {weather.country}</span>
                <button onClick={()=>fetchWeather(weather.city)} className="glass-btn" style={{padding:"4px 9px",marginLeft:4,border:"none"}}>
                  {loading?<span className="spin"><Loader size={13}/></span>:<RefreshCw size={13}/>}
                </button>
              </div>
              <div style={{fontSize:80,lineHeight:1,marginBottom:6}}>{WEATHER_ICONS[wtype]??"🌡️"}</div>
              <div className="main-temp" style={{fontSize:106,fontWeight:200,letterSpacing:-5,lineHeight:1,color:"white",marginBottom:6}}>
                {toTemp(weather.temp_c)}
              </div>
              <div style={{fontSize:22,textTransform:"capitalize",opacity:.95,color:"white",marginBottom:8}}>
                {weather.description||weather.condition}
              </div>
              <div style={{fontSize:14,opacity:.7,color:"white"}}>
                Feels like {toTemp(weather.feels_like_c)} &nbsp;·&nbsp;
                H: {toTemp(weather.temp_max_c)} &nbsp;·&nbsp;
                L: {toTemp(weather.temp_min_c)}
              </div>
              <div style={{display:"flex",justifyContent:"center",gap:28,marginTop:22,paddingTop:22,borderTop:"1px solid rgba(255,255,255,.15)",flexWrap:"wrap"}}>
                {[
                  {icon:"🌅",label:"Sunrise",val:weather.sunrise},
                  {icon:"🌇",label:"Sunset", val:weather.sunset},
                  {icon:moon.icon,label:"Moon",val:moon.name},
                ].map((x,i)=>(
                  <div key={i} style={{display:"flex",alignItems:"center",gap:10,color:"white"}}>
                    <span style={{fontSize:26}}>{x.icon}</span>
                    <div>
                      <div style={{fontSize:11,opacity:.6,textTransform:"uppercase",letterSpacing:.5}}>{x.label}</div>
                      <div style={{fontSize:15,fontWeight:500}}>{x.val}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* ── Stats ── */}
            <div className="stats-grid" style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:12,marginBottom:16}}>
              {[
                {icon:"💧",label:"Humidity",   val:`${weather.humidity}%`},
                {icon:"💨",label:"Wind",        val:`${weather.wind_ms} m/s`},
                {icon:"👁️",label:"Visibility", val:`${weather.visibility_km} km`},
                {icon:"📊",label:"Pressure",    val:`${weather.pressure_hpa} hPa`},
                {icon:"☁️",label:"Cloud Cover", val:`${weather.clouds_pct}%`},
                {icon:"☀️",label:"UV Index",    val:`${weather.uv_index??"-"}`},
                weather.aqi_label?{icon:"🌿",label:"Air Quality",val:weather.aqi_label,color:AQI_COLORS[weather.aqi_label]}:null,
                {icon:moon.icon,label:"Moon Phase",val:moon.name.split(" ").slice(0,2).join(" ")},
              ].filter(Boolean).map((s,i)=>(
                <div key={i} className="glass-subtle" style={{padding:"16px 10px",textAlign:"center"}}>
                  <div style={{fontSize:28,marginBottom:7}}>{s.icon}</div>
                  <div style={{fontSize:10,opacity:.6,textTransform:"uppercase",letterSpacing:.6,color:"white",marginBottom:5}}>{s.label}</div>
                  <div style={{fontSize:15,fontWeight:600,color:s.color??"white"}}>{s.val}</div>
                </div>
              ))}
            </div>

            {/* ── Forecast ── */}
            {weather.forecast?.length>0&&(
              <div className="glass" style={{padding:"22px 20px",marginBottom:16,borderRadius:24}}>
                <div style={{fontSize:11,textTransform:"uppercase",letterSpacing:1.2,opacity:.65,color:"white",marginBottom:16}}>
                  📅 {weather.forecast.length}-Day Forecast
                </div>
                <div className="forecast-row">
                  {weather.forecast.map((d,i)=>(
                    <div key={i} className="glass-subtle" style={{minWidth:110,padding:"16px 10px",textAlign:"center",flexShrink:0}}>
                      <div style={{fontSize:11,opacity:.7,color:"white",marginBottom:10}}>{d.day}</div>
                      <div style={{fontSize:30,marginBottom:10}}>{WEATHER_ICONS[getWeatherTypeFromCondition(d.condition)]??"🌤"}</div>
                      <div style={{fontSize:16,fontWeight:600,color:"white"}}>{toTemp(d.max_c)}</div>
                      <div style={{fontSize:13,opacity:.6,color:"white"}}>{toTemp(d.min_c)}</div>
                      {d.rain_pct>0&&<div style={{fontSize:11,marginTop:7,color:"#63b3ed"}}>💧 {d.rain_pct}%</div>}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* ── Temp Chart ── */}
            {weather.hourly?.length>0&&(
              <div className="glass" style={{padding:"22px 20px",marginBottom:16,borderRadius:24}}>
                <div style={{fontSize:11,textTransform:"uppercase",letterSpacing:1.2,opacity:.65,color:"white",marginBottom:16}}>
                  📈 24-Hour Temperature Trend
                </div>
                <ResponsiveContainer width="100%" height={190}>
                  <AreaChart data={weather.hourly.map(h=>({...h,temp:unit==="C"?h.temp_c:Math.round(h.temp_c*9/5+32)}))} margin={{top:5,right:5,bottom:0,left:-12}}>
                    <defs>
                      <linearGradient id="tg" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%"  stopColor="#63b3ed" stopOpacity={.5}/>
                        <stop offset="95%" stopColor="#63b3ed" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <XAxis dataKey="time" stroke="rgba(255,255,255,.35)" tick={{fill:"rgba(255,255,255,.7)",fontSize:11}}/>
                    <YAxis stroke="rgba(255,255,255,.35)" tick={{fill:"rgba(255,255,255,.7)",fontSize:11}}/>
                    <Tooltip contentStyle={{background:"rgba(8,8,28,.92)",border:"1px solid rgba(255,255,255,.2)",borderRadius:10,color:"white",fontSize:12}}
                      formatter={v=>[`${v}°${unit}`,"Temp"]}/>
                    <Area type="monotone" dataKey="temp" stroke="#63b3ed" fill="url(#tg)" strokeWidth={2.5} dot={{fill:"#63b3ed",r:3.5,strokeWidth:0}}/>
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            )}

            {/* ── Rain chart ── */}
            {weather.hourly?.length>0&&(
              <div className="glass" style={{padding:"22px 20px",marginBottom:16,borderRadius:24}}>
                <div style={{fontSize:11,textTransform:"uppercase",letterSpacing:1.2,opacity:.65,color:"white",marginBottom:16}}>
                  🌧️ Rain Probability — Next 24 Hours
                </div>
                <ResponsiveContainer width="100%" height={150}>
                  <BarChart data={weather.hourly} margin={{top:5,right:5,bottom:0,left:-12}}>
                    <XAxis dataKey="time" stroke="rgba(255,255,255,.35)" tick={{fill:"rgba(255,255,255,.7)",fontSize:11}}/>
                    <YAxis stroke="rgba(255,255,255,.35)" tick={{fill:"rgba(255,255,255,.7)",fontSize:11}} domain={[0,100]} unit="%"/>
                    <Tooltip contentStyle={{background:"rgba(8,8,28,.92)",border:"1px solid rgba(255,255,255,.2)",borderRadius:10,color:"white",fontSize:12}}
                      formatter={v=>[`${v}%`,"Rain chance"]}/>
                    <Bar dataKey="rain_pct" fill="rgba(99,179,237,.65)" radius={[5,5,0,0]}/>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}

            {/* ── AQI ── */}
            {weather.aqi_label&&(
              <div className="glass" style={{padding:"22px 20px",marginBottom:16,borderRadius:24}}>
                <div style={{fontSize:11,textTransform:"uppercase",letterSpacing:1.2,opacity:.65,color:"white",marginBottom:16}}>🌿 Air Quality</div>
                <div style={{display:"flex",alignItems:"center",gap:18}}>
                  <div style={{width:60,height:60,borderRadius:"50%",background:AQI_COLORS[weather.aqi_label]??"#888",display:"flex",alignItems:"center",justifyContent:"center",fontSize:14,fontWeight:700,color:"white",boxShadow:`0 0 22px ${AQI_COLORS[weather.aqi_label]??"#888"}77`}}>
                    AQI
                  </div>
                  <div>
                    <div style={{fontSize:26,fontWeight:600,color:"white"}}>{weather.aqi_label}</div>
                    <div style={{fontSize:13,opacity:.6,color:"white"}}>Overall air quality index</div>
                  </div>
                </div>
              </div>
            )}

            {/* ── Earthquake panel ── */}
            {quakes.length>0&&(
              <div className="glass" style={{padding:"22px 20px",marginBottom:16,borderRadius:24,background:"rgba(127,0,0,.18)",borderColor:"rgba(183,28,28,.35)"}}>
                <div style={{fontSize:11,textTransform:"uppercase",letterSpacing:1.2,marginBottom:14,color:"#fca5a5",fontWeight:700}}>
                  🚨 Significant Earthquakes — Last 7 Days
                </div>
                <div style={{display:"flex",flexDirection:"column",gap:10}}>
                  {quakes.map((q,i)=>(
                    <div key={i} style={{padding:"13px 16px",borderRadius:14,
                      background:q.alert==="red"?"rgba(183,28,28,.28)":"rgba(204,82,0,.22)",
                      border:`1px solid ${q.alert==="red"?"rgba(183,28,28,.45)":"rgba(204,82,0,.35)"}`}}>
                      <div style={{fontWeight:700,fontSize:16,color:"white"}}>{q.alert==="red"?"🔴":"🟠"} Magnitude {q.mag}</div>
                      <div style={{fontSize:13,opacity:.85,color:"white",marginTop:4}}>📍 {q.place}</div>
                      <div style={{fontSize:11,opacity:.6,color:"white",marginTop:3}}>🕒 {q.time}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div style={{textAlign:"center",opacity:.4,fontSize:12,paddingTop:12,color:"white"}}>
              Powered by Claude AI with live web search &nbsp;·&nbsp; Data updated: {time.toLocaleTimeString()}
            </div>
          </div>
        )}
      </div>

      {chatOpen&&<AIChat weather={weather} onClose={()=>setChatOpen(false)}/>}

      <button onClick={()=>setChatOpen(p=>!p)} style={{position:"fixed",bottom:26,right:26,width:60,height:60,borderRadius:"50%",
        display:"flex",alignItems:"center",justifyContent:"center",fontSize:27,zIndex:1001,cursor:"pointer",
        border:"1px solid rgba(255,255,255,.32)",background:chatOpen?"rgba(99,179,237,.55)":"rgba(99,179,237,.3)",
        backdropFilter:"blur(18px)",boxShadow:"0 4px 26px rgba(99,179,237,.45)",color:"white",
        transition:"background .2s,transform .2s,box-shadow .2s"}}
        title="AI Weather Assistant"
        onMouseOver={e=>{e.currentTarget.style.transform="scale(1.1)";e.currentTarget.style.boxShadow="0 6px 32px rgba(99,179,237,.65)"}}
        onMouseOut={e=>{e.currentTarget.style.transform="scale(1)";e.currentTarget.style.boxShadow="0 4px 26px rgba(99,179,237,.45)"}}>
        🤖
      </button>
    </div>
  );
}
