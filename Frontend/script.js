// Browser-only demo. A key in localStorage is visible to anyone using the site.
// For a public GitHub Pages deployment, proxy Gemini requests through a backend.
const chat=document.getElementById("chat");
const input=document.getElementById("msg");
const form=document.getElementById("chat-form");
const micBtn=document.getElementById("mic-btn");
const aiStatus=document.getElementById("ai-status");
const voiceStatus=document.getElementById("voice-status");
const speechStatus=document.getElementById("speech-status");
const MODELS=["gemini-3.8-flash","gemini-3.6-flash"];
let apiKey=localStorage.getItem("jarvis_key")||"";
let voices=[];

function add(label,text,kind){
 const box=document.createElement("div");box.className="msg "+kind;
 const who=document.createElement("b");who.textContent=label;
 const p=document.createElement("p");p.textContent=text;
 box.append(who,p);chat.appendChild(box);chat.scrollTop=chat.scrollHeight;return box;
}
function status(el,text,kind){el.textContent=text;el.style.color=kind==="ok"?"#54ffad":kind==="bad"?"#ff7777":"#ffbd69";}
function getKey(){
 if(apiKey)return apiKey;
 const entered=prompt("Enter your Gemini API key:");
 if(!entered||!entered.trim())return "";
 apiKey=entered.trim();localStorage.setItem("jarvis_key",apiKey);return apiKey;
}
async function callGemini(promptText){
 const key=getKey();if(!key)throw Error("No API key entered.");
 let lastError;
 for(const model of MODELS){
  const url=`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`;
  let response,data;
  try{
   response=await fetch(url,{method:"POST",headers:{"Content-Type":"application/json","x-goog-api-key":key},
    body:JSON.stringify({systemInstruction:{parts:[{text:"You are J.A.R.V.I.S., a helpful personal AI assistant. Address the user as Boss. Reply in the language used by the user."}]},
    contents:[{role:"user",parts:[{text:promptText}]}],generationConfig:{temperature:.7,maxOutputTokens:900}})});
   data=await response.json();
  }catch(e){throw Error("Network error. Check your internet connection.");}
  if(!response.ok){
   const message=data.error?.message||`HTTP ${response.status}`;
   lastError=Error(`${model}: ${message}`);
   if(response.status===404)continue;
   throw lastError;
  }
  const answer=data.candidates?.[0]?.content?.parts?.map(x=>x.text||"").join("").trim();
  if(!answer)throw Error("Gemini returned no text. Check the request or safety response.");
  return answer;
 }
 throw lastError||Error("No configured Gemini model is available for this API key.");
}
async function askGemini(message){
 status(aiStatus,"● PROCESSING");
 const pending=add("J.A.R.V.I.S.","Thinking...","ai");
 try{
  const answer=await callGemini(message);
  pending.querySelector("p").textContent=answer;status(aiStatus,"● ONLINE","ok");speak(answer);
 }catch(e){
  pending.querySelector("p").textContent="ERROR: "+e.message;status(aiStatus,"● ERROR","bad");console.error(e);
 }
}
form.addEventListener("submit",e=>{
 e.preventDefault();const text=input.value.trim();if(!text)return;
 add("YOU",text,"user");input.value="";askGemini(text);
});

// Speech output
function loadVoices(){if("speechSynthesis"in window)voices=speechSynthesis.getVoices();}
if("speechSynthesis"in window){loadVoices();speechSynthesis.onvoiceschanged=loadVoices;status(speechStatus,"● READY","ok");}
else status(speechStatus,"○ NOT SUPPORTED","bad");
function speak(text){
 if(!("speechSynthesis"in window))return;
 speechSynthesis.cancel();const u=new SpeechSynthesisUtterance(text);u.rate=1;u.pitch=.9;
 const v=voices.find(x=>x.lang.toLowerCase().startsWith("en"));if(v)u.voice=v;speechSynthesis.speak(u);
}

// Speech input
const SR=window.SpeechRecognition||window.webkitSpeechRecognition;
if(SR){
 const rec=new SR();rec.lang="en-IN"; // Change to "te-IN" for Telugu speech recognition.
 rec.continuous=false;rec.interimResults=false;
 rec.onstart=()=>micBtn.classList.add("listening");
 rec.onresult=e=>{const text=e.results?.[0]?.[0]?.transcript;if(!text)return;input.value=text;add("YOU (VOICE)",text,"user");askGemini(text);};
 rec.onerror=e=>add("J.A.R.V.I.S.","Microphone error: "+e.error+". Check browser permission.","ai");
 rec.onend=()=>micBtn.classList.remove("listening");
 micBtn.addEventListener("click",()=>{try{rec.start();}catch(e){console.warn(e);}});
 status(voiceStatus,"● AVAILABLE","ok");
}else{micBtn.disabled=true;micBtn.title="Speech recognition is not supported in this browser.";status(voiceStatus,"○ NOT SUPPORTED","bad");}
