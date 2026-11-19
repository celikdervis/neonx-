import {initializeApp,getApps,getApp} from 'https://www.gstatic.com/firebasejs/12.16.0/firebase-app.js';
import {getAuth,onAuthStateChanged,signInAnonymously} from 'https://www.gstatic.com/firebasejs/12.16.0/firebase-auth.js';
import {getDatabase,ref,set,get,update,onValue,serverTimestamp} from 'https://www.gstatic.com/firebasejs/12.16.0/firebase-database.js';

const firebaseConfig={apiKey:'AIzaSyBLpXHGGTHXykKrnu8_Hv1i71oc3tpTNvY',authDomain:'neonxi.firebaseapp.com',databaseURL:'https://neonxi-default-rtdb.europe-west1.firebasedatabase.app',projectId:'neonxi',storageBucket:'neonxi.firebasestorage.app',messagingSenderId:'667191549799',appId:'1:667191549799:web:1e40feacbee09ed7f3d9c2'};
const app=getApps().length?getApp():initializeApp(firebaseConfig),auth=getAuth(app),db=getDatabase(app);
const $=id=>document.getElementById(id),state={uid:'',room:'',roomData:null,off:null,mode:'duel',solo:false,speech:null,recordingMode:'',transcript:'',blobUrl:'',turnBusy:false,originalPcm:null,secretAnswer:''};
const toast=msg=>{const el=$('toast');el.textContent=msg;el.classList.add('show');clearTimeout(toast.t);toast.t=setTimeout(()=>el.classList.remove('show'),3000)};
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const roomRef=()=>ref(db,'reverseXI/rooms/'+state.room);
const uid=()=>state.uid;
const normalize=s=>String(s||'').toLocaleLowerCase('tr-TR').normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/ı/g,'i').replace(/æ/g,'ae').replace(/œ/g,'oe').replace(/ß/g,'ss').replace(/ø/g,'o').replace(/ł/g,'l').replace(/đ/g,'d').replace(/þ/g,'th').replace(/ð/g,'d').replace(/[^a-z0-9]/g,'');
function distance(a,b){const row=Array.from({length:b.length+1},(_,i)=>i);for(let i=1;i<=a.length;i++){let prev=row[0];row[0]=i;for(let j=1;j<=b.length;j++){const old=row[j];row[j]=Math.min(row[j]+1,row[j-1]+1,prev+(a[i-1]===b[j-1]?0:1));prev=old}}return row[b.length]}
function answerMatches(guess,answer){const g=normalize(guess),a=normalize(answer);if(!g||!a)return false;if(g===a)return true;if(g.length>=4&&a.includes(g))return true;const aliases=(answer+'|'+answer.replace(/khvicha/i,'khvicha')+'|'+answer.replace(/kvaratskhelia/i,'kvaratskhelia')).split('|').map(normalize);if(aliases.includes(g))return true;if(Math.min(g.length,a.length)>=5&&Math.abs(g.length-a.length)<=Math.max(2,Math.floor(a.length*.2))&&distance(g,a)<=Math.max(2,Math.floor(a.length*.2)))return true;return false}
async function ensureAuth(){if(auth.currentUser){state.uid=auth.currentUser.uid;return}await new Promise((resolve,reject)=>{const off=onAuthStateChanged(auth,async user=>{off();try{if(user){state.uid=user.uid;resolve()}else{const result=await signInAnonymously(auth);state.uid=result.user.uid;resolve()}}catch(e){reject(e)}} ,reject)})}
function makeCode(){return Array.from({length:6},()=>'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'[Math.floor(Math.random()*32)]).join('')}
function renderRoom(data){state.roomData=data;const speakerSide=data.currentSpeaker||'A';if(mySide()===speakerSide)state.secretAnswer=state.secretAnswer||localStorage.getItem('nxReverseXI:'+state.room+':'+uid())||'';$('name-a').textContent=data.players?.A?.name||'Bekleniyor…';$('name-b').textContent=data.players?.B?.name||'Bekleniyor…';$('player-a').classList.toggle('active',data.currentSpeaker==='A');$('player-b').classList.toggle('active',data.currentSpeaker==='B');$('step-no').textContent='TUR '+(data.turn||1);$('room-label').textContent=state.room;$('chat-lines').innerHTML=Object.values(data.guesses||{}).map(x=>'<div class="chat-item"><b>'+esc(x.byName)+':</b> '+esc(x.guess)+' · '+(x.correct?'DOĞRU':'YANLIŞ')+'</div>').join('')||'<span class="hint">Henüz tahmin yok.</span>';updateStage()}
function mySide(){const d=state.roomData;if(d?.players?.A?.uid===uid())return'A';if(d?.players?.B?.uid===uid())return'B';return''}
function updateStage(){const d=state.roomData;if(!d)return;['speaker-panel','listen-panel','guess-panel','result-panel','waiting-panel'].forEach(id=>$(id).hidden=true);if(!d.players?.B){$('step-title').textContent='Arkadaşını bekliyoruz';$('step-desc').textContent='Oda kodunu arkadaşınla paylaş. Katıldığında ilk tur başlayacak.';$('waiting-panel').hidden=false;return}const side=mySide(),speaker=d.currentSpeaker||'A',imitator=speaker==='A'?'B':'A',phase=d.phase||'speak';let title='',desc='';if(phase==='speak'){title=speaker+' oyuncusu futbolcu ismini söylüyor';desc='İsmi normal şekilde söyle ve sistemin doğru anladığını onayla.';if(side===speaker)$('speaker-panel').hidden=false;else $('waiting-panel').hidden=false}else if(phase==='imitate'){title=imitator+' oyuncusu ters sesi taklit ediyor';desc='Ters sesi dinle ve duyduğun şekilde kaydet.';if(side===imitator){$('listen-panel').hidden=false;setAudio('reverse-audio',d.reverseOriginal)}else $('waiting-panel').hidden=false}else if(phase==='guess'){title=imitator+' oyuncusu tahmin ediyor';desc='Kendi sesinin tekrar ters çevrilmiş hâlini dinleyip futbolcuyu bul.';if(side===imitator){$('guess-panel').hidden=false;setAudio('final-audio',d.reverseImitation)}else $('waiting-panel').hidden=false}else if(phase==='checking'){title='Cevap kontrol ediliyor';desc='A oyuncusu cevabı doğruluyor.';$('waiting-panel').hidden=false}else if(phase==='result'){title='Tur tamamlandı';desc='Sıradaki tur için devam et.';$('result-panel').hidden=false;$('result-title').textContent=d.lastResult?.correct?'DOĞRU TAHMİN!':'TUR TAMAMLANDI';$('result-copy').textContent='Doğru cevap: '+(d.lastResult?.answer||'')+' · Tahmin: '+(d.lastResult?.guess||'');$('next-turn').hidden=side!==d.currentSpeaker}$('step-title').textContent=title;$('step-desc').textContent=desc}
function setAudio(id,data){const el=$(id);if(!data)return;if(el.dataset.src===data)return;el.dataset.src=data;el.src=data}
async function createRoom(roomCode='',playerName=''){
 try{
  await ensureAuth();
  let code=String(roomCode||'').toUpperCase().replace(/[^A-Z0-9]/g,'');
  if(!code){code=makeCode();while((await get(ref(db,'reverseXI/rooms/'+code))).exists())code=makeCode()}
  state.room=code;
  const name=String(playerName||'Oyuncu '+Math.floor(100+Math.random()*900)).trim().slice(0,24);
  await set(roomRef(),{createdAt:serverTimestamp(),hostUid:uid(),game_type:'reverse-xi',room_code:code,status:'waiting',players:{A:{uid:uid(),name}},currentSpeaker:'A',turn:1,phase:'speak',guesses:{}});
  openRoom();
  history.replaceState(null,'',location.pathname+'?room='+code)
 }catch(e){toast('Oda oluşturulamadı: '+e.message)}
}
async function joinRoom(code,playerName=''){
 code=String(code||'').toUpperCase().replace(/[^A-Z0-9]/g,'');
 if(code.length!==6){toast('6 haneli oda kodunu gir.');return}
 try{
  await ensureAuth();
  const r=ref(db,'reverseXI/rooms/'+code),snap=await get(r);
  if(!snap.exists()){toast('Bu oda bulunamadı.');return}
  const d=snap.val();
  if(d.players?.A?.uid===uid()||d.players?.B?.uid===uid()){state.room=code;openRoom();return}
  if(d.players?.B){toast('Bu oda dolu.');return}
  const name=String(playerName||'Oyuncu '+Math.floor(100+Math.random()*900)).trim().slice(0,24);
  state.room=code;
  await update(r,{game_type:'reverse-xi',room_code:code,status:'playing',players:{...d.players,B:{uid:uid(),name}}});
  openRoom();
  history.replaceState(null,'',location.pathname+'?room='+code)
 }catch(e){toast('Odaya katılınamadı: '+e.message)}
}
async function validateIncomingGuess(data){
 if(data.phase!=='checking'||mySide()!==(data.currentSpeaker||'A')||!data.pendingGuess||state.validatingGuess===data.pendingGuess.id)return;
 state.validatingGuess=data.pendingGuess.id;
 const secret=state.secretAnswer||localStorage.getItem('nxReverseXI:'+state.room+':'+uid())||'';
 if(!secret){state.validatingGuess='';toast('Soru sahibinin cevap anahtarı bulunamadı.');return}
 const guess=data.pendingGuess.guess;
 const result={guess,correct:answerMatches(guess,secret),answer:secret,byName:data.pendingGuess.byName||'Oyuncu',createdAt:data.pendingGuess.createdAt||Date.now()};
 try{await update(roomRef(),{['guesses/'+data.pendingGuess.id]:result,lastResult:result,phase:'result'})}
 catch(e){state.validatingGuess='';toast('Cevap kontrol edilemedi: '+e.message)}
}
function openRoom(){$('intro').hidden=true;$('game').hidden=false;$('room-label').textContent=state.room;if(state.off)state.off();state.off=onValue(roomRef(),s=>{if(!s.exists()){toast('Oda kapatıldı.');return}const data=s.val();renderRoom(data);validateIncomingGuess(data)})}
// ---- Microphone ---------------------------------------------------------
// One capture pipeline for every platform: raw PCM from an AudioContext,
// resampled to 22.05 kHz, reversed and sent as a WAV data URL. This avoids
// MediaRecorder format differences (webm/mp4) and Safari decode failures.
// The AudioContext is resumed inside the tap, before the permission prompt,
// because iOS only lets audio start during a user gesture.
const MIC_RATE=22050,MIC_MAX_SECONDS=15,MIC_MIN_SECONDS=.3,MIC_SILENCE_PEAK=.01,MIC_RESUME_TIMEOUT=4000;
const mic={stream:null,ctx:null,capture:null,starting:false,cancelledInBackground:false};
// Real-device diagnostics: open the page with ?micdebug=1 to show a live panel
// (permission, AudioContext, track, level, last error) that testers can screenshot.
// It never takes taps (pointer-events:none), so the game stays playable under it.
const MIC_DEBUG=new URLSearchParams(location.search).get('micdebug')==='1',micInfo={};
function micDiag(key,value){
 micInfo[key]=value;
 if(!MIC_DEBUG)return;
 let panel=document.getElementById('nx-mic-debug');
 if(!panel){panel=document.createElement('pre');panel.id='nx-mic-debug';panel.style.cssText='position:fixed;left:6px;right:6px;top:max(6px,env(safe-area-inset-top));z-index:99999;max-height:28vh;overflow:hidden;margin:0;padding:6px 8px;border:1px solid #cfff35;border-radius:10px;background:rgba(2,7,5,.88);color:#dfffb0;font:10px/1.3 ui-monospace,Menlo,monospace;white-space:pre-wrap;word-break:break-all;pointer-events:none';document.body.appendChild(panel)}
 const order=['permission','audioContext','track','lastTake','lastUpload','lastError','visibility','platform','apis','ua'];
 panel.textContent='RE:VERSE MIC DEBUG\n'+order.filter(k=>k in micInfo).map(k=>k+': '+micInfo[k]).join('\n');
}
function micDiagError(where,error){micDiag('lastError',where+' · '+(error?.name||'')+' · '+(error?.message||error))}
micDiag('ua',navigator.userAgent);micDiag('platform',(isIOSAudio()?'iOS':/Android/i.test(navigator.userAgent||'')?'Android':'other')+' · mobile='+isMobileAudio()+' · secure='+window.isSecureContext);
micDiag('apis','mediaDevices='+!!navigator.mediaDevices?.getUserMedia+' · AudioContext='+!!(window.AudioContext||window.webkitAudioContext)+' · SpeechRecognition='+!!(window.SpeechRecognition||window.webkitSpeechRecognition));
navigator.permissions?.query?.({name:'microphone'}).then(p=>{micDiag('permission',p.state);p.onchange=()=>micDiag('permission',p.state)}).catch(()=>micDiag('permission','unavailable'));
function setLevel(button,level){button.style.setProperty('--nx-level',level.toFixed(3))}
function isIOSAudio(){return /iPhone|iPad|iPod/.test(navigator.userAgent||'')||(navigator.platform==='MacIntel'&&navigator.maxTouchPoints>1)}
// On phones the speech recognizer and the recorder compete for the single
// microphone; running both leaves one of them with silence.
function isMobileAudio(){return isIOSAudio()||/Android/i.test(navigator.userAgent||'')}
function micError(error){
 micDiagError('getUserMedia',error);
 const name=error?.name||'',ios=isIOSAudio();
 const text=name==='NotAllowedError'||name==='SecurityError'||name==='PermissionDeniedError'
  ?(ios?'Mikrofon izni verilmedi. Safari\'de adres çubuğundaki "aA" › Web Sitesi Ayarları › Mikrofon › İzin Ver adımlarını izleyip tekrar dene.':'Mikrofon izni verilmedi. Adres çubuğundaki kilit simgesinden mikrofona izin verip tekrar dene.')
  :name==='NotFoundError'||name==='OverconstrainedError'||name==='DevicesNotFoundError'?'Bu cihazda kullanılabilir mikrofon bulunamadı.'
  :name==='NotReadableError'||name==='AbortError'||name==='TrackStartError'?'Mikrofon başka bir uygulama (ör. telefon görüşmesi) tarafından kullanılıyor. Onu kapatıp tekrar dene.'
  :name==='Unsupported'||name==='NotSupportedError'?'Bu tarayıcı mikrofon erişimine izin vermiyor. Bağlantıyı Safari veya Chrome\'da aç; uygulama içi tarayıcılar genellikle mikrofonu desteklemez.'
  :'Mikrofon açılamadı. Tekrar dene.';
 const out=new Error(text);out.code=name;return out;
}
function audioContext(){
 const AC=window.AudioContext||window.webkitAudioContext;
 if(!AC)throw micError({name:'Unsupported'});
 if(!mic.ctx||mic.ctx.state==='closed'){mic.ctx=new AC();mic.ctx.onstatechange=()=>micDiag('audioContext',mic.ctx.state+' @ '+mic.ctx.sampleRate+' Hz')}
 micDiag('audioContext',mic.ctx.state+' @ '+mic.ctx.sampleRate+' Hz');
 return mic.ctx;
}
function trackUsable(track){return !!track&&track.readyState==='live'&&track.enabled&&!track.muted}
function releaseMicrophone(){mic.stream?.getTracks().forEach(t=>{try{t.stop()}catch{}});mic.stream=null}
async function getStream(){
 if(trackUsable(mic.stream?.getAudioTracks?.()[0]))return mic.stream;
 releaseMicrophone();
 if(!navigator.mediaDevices?.getUserMedia)throw micError({name:'Unsupported'});
 let stream;
 try{stream=await navigator.mediaDevices.getUserMedia({audio:{echoCancellation:true,noiseSuppression:true,autoGainControl:true}})}catch(e){throw micError(e)}
 const track=stream.getAudioTracks()[0];
 if(!track){stream.getTracks().forEach(t=>t.stop());throw micError({name:'NotFoundError'})}
 // iOS ends or mutes capture on calls, Siri and backgrounding; never reuse such a track.
 const trackInfo=e=>{const t=track.getSettings?.()||{};micDiag('track',(e?e+' · ':'')+track.readyState+(track.muted?' · MUTED':'')+' · '+(track.label||'mic').slice(0,32)+' · '+(t.sampleRate||'?')+' Hz · ec='+t.echoCancellation+' ns='+t.noiseSuppression+' agc='+t.autoGainControl)};
 trackInfo();track.addEventListener('mute',()=>trackInfo('mute'));track.addEventListener('unmute',()=>trackInfo('unmute'));
 track.addEventListener('ended',()=>{trackInfo('ended');if(mic.stream===stream)mic.stream=null;if(mic.capture?.stream===stream)abortCapture('Mikrofon bağlantısı kesildi. Kaydı tekrar başlat.')});
 mic.stream=stream;return stream;
}
function recordButton(mode){return $(mode==='name'?'record-name':'record-imitation')}
function resetRecordButton(button){button.classList.remove('recording');button.textContent='🎙 KAYDI BAŞLAT';setLevel(button,0)}
function startSpeech(){
 const SR=window.SpeechRecognition||window.webkitSpeechRecognition;
 if(!SR||isMobileAudio())return;
 const speech=new SR();speech.lang='tr-TR';speech.interimResults=true;speech.continuous=true;speech.maxAlternatives=3;
 speech.onresult=e=>{state.transcript=Array.from(e.results).map(r=>r[0]?.transcript||'').join(' ').trim()};
 speech.onerror=()=>{$('speech-fallback').hidden=false;$('manual-name').hidden=false};
 state.speech=speech;try{speech.start()}catch{$('speech-fallback').hidden=false;$('manual-name').hidden=false}
}
function stopSpeech(){try{state.speech?.stop()}catch{}state.speech=null}
async function startCapture(mode){
 const button=recordButton(mode);
 mic.starting=true;button.disabled=true;
 try{
  const ctx=audioContext(),resumed=ctx.resume();
  const stream=await getStream();
  await Promise.race([resumed,new Promise(resolve=>setTimeout(resolve,MIC_RESUME_TIMEOUT))]).catch(()=>{});
  if(ctx.state!=='running')throw new Error('Ses sistemi başlatılamadı. Mikrofon tuşuna tekrar dokun.');
  const source=ctx.createMediaStreamSource(stream),processor=ctx.createScriptProcessor(4096,1,1);
  const capture={mode,button,stream,source,processor,chunks:[],frames:0,rate:ctx.sampleRate,second:0,level:0};
  processor.onaudioprocess=e=>{
   if(mic.capture!==capture)return;
   const data=e.inputBuffer.getChannelData(0);capture.chunks.push(new Float32Array(data));capture.frames+=data.length;
   let sum=0;for(let i=0;i<data.length;i+=4)sum+=data[i]*data[i];capture.level=Math.max(Math.min(1,Math.sqrt(sum/(data.length/4))*7),capture.level*.75);setLevel(button,capture.level);
   e.outputBuffer.getChannelData(0).fill(0);
   const second=Math.floor(capture.frames/capture.rate);
   if(second!==capture.second){capture.second=second;button.textContent='■ KAYDI DURDUR · '+second+' sn'}
   if(capture.frames>=capture.rate*MIC_MAX_SECONDS){toast('Kayıt '+MIC_MAX_SECONDS+' saniyede otomatik durdu.');stopCapture()}
  };
  source.connect(processor);processor.connect(ctx.destination);
  mic.capture=capture;state.recordingMode=mode;state.transcript='';
  button.classList.add('recording');button.textContent='■ KAYDI DURDUR';
  if(mode==='name')startSpeech();
  toast('Kayıt başladı. Bitirdiğinde aynı mikrofon tuşuna tekrar bas.');
 }finally{mic.starting=false;button.disabled=false}
}
function detachCapture(c){c.processor.onaudioprocess=null;try{c.source.disconnect();c.processor.disconnect()}catch{}}
function abortCapture(message){
 const c=mic.capture;if(!c)return;
 mic.capture=null;stopSpeech();detachCapture(c);state.recordingMode='';resetRecordButton(c.button);
 if(message)toast(message);
}
function capturedPcm(c){
 const total=c.chunks.reduce((n,x)=>n+x.length,0),raw=new Float32Array(total);
 let offset=0;for(const chunk of c.chunks){raw.set(chunk,offset);offset+=chunk.length}
 if(c.rate===MIC_RATE)return raw;
 const length=Math.floor(total*MIC_RATE/c.rate),out=new Float32Array(length),step=c.rate/MIC_RATE;
 for(let i=0;i<length;i++){const pos=i*step,lo=Math.floor(pos),hi=Math.min(total-1,lo+1),frac=pos-lo;out[i]=raw[lo]*(1-frac)+raw[hi]*frac}
 return out;
}
function stopCapture(){
 const c=mic.capture;if(!c)return;
 mic.capture=null;stopSpeech();detachCapture(c);state.recordingMode='';resetRecordButton(c.button);
 const pcm=capturedPcm(c);
 let peak=0;for(let i=0;i<pcm.length;i++){const v=Math.abs(pcm[i]);if(v>peak)peak=v}
 micDiag('lastTake',c.mode+' · '+(pcm.length/MIC_RATE).toFixed(2)+' s · peak '+peak.toFixed(3)+' · captured at '+c.rate+' Hz');
 if(pcm.length<MIC_RATE*MIC_MIN_SECONDS){toast('Kayıt çok kısa. Biraz daha uzun konuşup tekrar dene.');return}
 if(peak<MIC_SILENCE_PEAK){toast('Ses algılanmadı. Mikrofonun açık olduğundan ve başka bir uygulamanın kullanmadığından emin olup tekrar dene.');return}
 finishRecording(pcm,c.mode);
}
async function reversedDataUrl(pcm){const out=new Float32Array(pcm.length);for(let i=0;i<pcm.length;i++)out[pcm.length-1-i]=pcm[i];const url=await blobData(encodeWav(out,MIC_RATE));micDiag('lastUpload',Math.round(url.length/1024)+' KB data URL');return url}
function finishRecording(pcm,mode){
 if(mode==='name'){
  state.originalPcm=pcm;const transcript=state.transcript.trim(),typed=isMobileAudio()&&!transcript;
  $('heard-name').textContent=transcript||(typed?'Ses kaydedildi':'Ses çözümlenemedi');
  $('heard-result').querySelector('p').textContent=typed?'Futbolcunun adını aşağıya yazıp onayla.':'Doğru anladım mı?';
  $('heard-result').hidden=false;$('record-name').hidden=true;$('manual-name').value=transcript;$('speech-fallback').hidden=typed;$('manual-name').hidden=false;
  if(!transcript)$('manual-name').focus();
 }else if(mode==='imitation'){
  (async()=>{try{toast('Ses gönderiliyor…');await update(roomRef(),{reverseImitation:await reversedDataUrl(pcm),phase:'guess',imitationBy:uid()})}catch(e){toast('Ses gönderilemedi: '+(e.message||'bağlantını kontrol et.'))}})();
 }
}
async function toggleRecording(mode){
 if(mic.starting)return;
 if(state.recordingMode===mode){stopCapture();return}
 if(state.recordingMode){toast('Önce devam eden kaydı durdur.');return}
 try{await startCapture(mode)}catch(e){if(!e?.code)micDiagError('startCapture',e);abortCapture();toast(e.message||'Mikrofon açılamadı.')}
}
function encodeWav(samples,rate){const b=new ArrayBuffer(44+samples.length*2),v=new DataView(b);const write=(o,s)=>[...s].forEach((c,i)=>v.setUint8(o+i,c.charCodeAt(0)));write(0,'RIFF');v.setUint32(4,36+samples.length*2,true);write(8,'WAVE');write(12,'fmt ');v.setUint32(16,16,true);v.setUint16(20,1,true);v.setUint16(22,1,true);v.setUint32(24,rate,true);v.setUint32(28,rate*2,true);v.setUint16(32,2,true);v.setUint16(34,16,true);write(36,'data');v.setUint32(40,samples.length*2,true);for(let i=0;i<samples.length;i++)v.setInt16(44+i*2,Math.max(-1,Math.min(1,samples[i]))*32767,true);return new Blob([b],{type:'audio/wav'})}
function blobData(blob){return new Promise((resolve,reject)=>{const r=new FileReader();r.onload=()=>resolve(r.result);r.onerror=reject;r.readAsDataURL(blob)})}
// Backgrounding interrupts capture on iOS and Android: cancel the take and free
// the microphone (also turns the system mic indicator off); re-acquire on next tap.
document.addEventListener('visibilitychange',()=>{
 micDiag('visibility',document.visibilityState+' @ '+new Date().toLocaleTimeString());
 if(document.visibilityState==='hidden'){if(mic.capture){abortCapture();mic.cancelledInBackground=true}releaseMicrophone();return}
 if(mic.cancelledInBackground){mic.cancelledInBackground=false;toast('Uygulama arka plana alındığı için kayıt iptal edildi. Kaydı yeniden başlat.')}
});
$('record-name').onclick=()=>toggleRecording('name');
$('confirm-name').onclick=async e=>{const button=e.currentTarget;if(button.disabled)return;const name=$('manual-name').value.trim();if(!name){toast('Futbolcu ismini yazıp onayla.');return}if(!state.originalPcm){toast('Ses kaydı bulunamadı. Tekrar kaydet.');return}button.disabled=true;try{toast('Ses gönderiliyor…');const reverse=await reversedDataUrl(state.originalPcm);state.secretAnswer=name;try{localStorage.setItem('nxReverseXI:'+state.room+':'+uid(),name)}catch{}await update(roomRef(),{reverseOriginal:reverse,phase:'imitate',answerBy:uid()});state.originalPcm=null}catch(e){toast('Ses gönderilemedi: '+(e.message||'bağlantını kontrol et.'))}finally{button.disabled=false}};
$('retry-name').onclick=()=>{$('heard-result').hidden=true;$('record-name').hidden=false;$('manual-name').hidden=true;$('speech-fallback').hidden=true;$('manual-name').value='';state.transcript='';state.originalPcm=null};
$('record-imitation').onclick=()=>toggleRecording('imitation');
$('send-guess').onclick=async()=>{const guess=$('guess-input').value.trim();if(!guess){toast('Tahminini yaz.');return}if(state.roomData?.phase!=='guess'){toast('Şu anda tahmin gönderilemez.');return}const guessId='g'+Date.now(),byName=mySide();try{await update(roomRef(),{pendingGuess:{id:guessId,guess,byName:byName||'Oyuncu',createdAt:Date.now()},phase:'checking'});$('guess-feedback').textContent='Cevap kontrol ediliyor…'}catch(e){toast('Tahmin gönderilemedi: '+e.message)}};
$('next-turn').onclick=async()=>{const d=state.roomData;if(!d||d.phase!=='result')return;const next=d.currentSpeaker==='A'?'B':'A';localStorage.removeItem('nxReverseXI:'+state.room+':'+uid());state.secretAnswer='';await update(roomRef(),{currentSpeaker:next,turn:(d.turn||1)+1,phase:'speak',reverseOriginal:null,reverseImitation:null,lastResult:null,pendingGuess:null,answerBy:null,imitationBy:null})};
$('create-room').onclick=()=>createRoom();$('join-room').onclick=()=>joinRoom($('room-code').value);$('room-code').addEventListener('keydown',e=>{if(e.key==='Enter')joinRoom($('room-code').value)});$('copy-link').onclick=async()=>{const url=location.origin+location.pathname+'?room='+state.room;try{await navigator.clipboard.writeText(url);toast('Davet bağlantısı kopyalandı.')}catch{toast('Oda kodu: '+state.room)}};
document.querySelectorAll('[data-mode]').forEach(b=>b.onclick=()=>{state.mode=b.dataset.mode;document.querySelectorAll('[data-mode]').forEach(x=>x.classList.toggle('active',x===b));$('duel-start').hidden=state.mode!=='duel';$('solo-start').hidden=state.mode!=='solo'});
$('start-solo').onclick=()=>toast('Solo AI modu sonraki geliştirme adımında etkinleştirilecek. Multiplayer çekirdeği hazırlandı.');
window.addEventListener('pagehide',()=>{abortCapture();releaseMicrophone()});
await ensureAuth().catch(e=>toast('Kimlik bağlantısı kurulamadı: '+e.message));
const startup=new URLSearchParams(location.search),initial=startup.get('room'),partyCode=startup.get('nxCode')||'',partyName=startup.get('nxName')||'NEON Oyuncu';
if(startup.get('nxAuto')==='1'&&partyCode){
 if(startup.get('nxRole')==='host')await createRoom(partyCode,partyName);
 else await joinRoom(partyCode,partyName);
}else if(initial)joinRoom(initial);
