// ShareThis({
//   sharers: [ ShareThisViaTwitter, ShareThisViaClipboard ],
//   selector: "article"
// }).init();

let minimizedMode = false;
let autoScroll = true;
let doubleClick = false;
let webMonetization = true;
let playOnClick = true;

export const transcriptId = "hypertranscript";
let playerId = "hyperplayer"
let stopOnWordCompleteListener = null;
function __loadMedia(){
  document.querySelector("iframe").onload = function(){
    __getRawContent(this.src)
  }
}
function __getRawContent(src){
  var xhr = new XMLHttpRequest();
  xhr.open("GET", src, true);
  xhr.onreadystatechange = function(){
      if (xhr.readyState === 4 && xhr.status === 200) {
          var responseText = xhr.responseText;
          // window.iframeContentWindow = responseText;
          var regex = /var playlistItem = {(.*?)}/;
          var match = responseText.match(regex);
          if (match) {
            window.playListItem = JSON.parse("{"+match[1]+"}");
            // console.log(playListItem);
            __setMediaUrl(playListItem.media_url)
            __loadHyperaudioLite(transcriptId, playerId)
          }
      }
  };
  xhr.send();
}
function __setMediaUrl(mediaUrl, transcriptId){
  transcriptId = transcriptId || "hypertranscript";
  let transcript = document.getElementById(transcriptId);
  let el = transcript.querySelector("[data-media-src]");
  el && el.setAttribute("data-media-src", mediaUrl);
}
function __loadHyperaudioLite(transcriptId, playerId){
  window.hal = new HyperaudioLite(transcriptId, playerId, minimizedMode, autoScroll, doubleClick, webMonetization, playOnClick);
  // add media controls
  let el = document.getElementById(transcriptId).querySelector("article");
  el.onclick = __mediaControl
  el.myPlayer = document.getElementById(playerId)
}
function __parseDataMTime2Ms(transcriptId){ 
  let transcript = document.getElementById(transcriptId);
  const words = transcript.querySelectorAll('[data-m]');
  const time2ms = [1*1000, 60*1000, 60*1000];
  words.forEach( function(word){
    var isTime = word.getAttribute('data-m').split(":").reverse();
    if (isTime.length>1) {
      var ms = 0;
      isTime.forEach(function(v,i){
        ms += v*time2ms[i];
      })
      word.setAttribute('data-m', ms);
    }
  });
}
async function __mediaControl(ev){
  const curTarget = ev.currentTarget;
  const dataMms = ev.target.getAttribute('data-m');
  const dataDms = ev.target.getAttribute('data-d') || 10*1000;
  const playerCurrentTime = await hal.myPlayer.getTime();
  const dataMoffset = Math.round(playerCurrentTime) - Math.round(dataMms/1000||0)
  const targetIsActive =  0<dataMoffset && dataMoffset<dataDms/1000
  
  var doPause = dataMms===null // true if click on unplayable element
  doPause ||= targetIsActive // true if click on active playable element
  doPause &&= !(dataMms!==null && !targetIsActive) // false if click on playable element that is NOT active

  if (doPause) {
    setTimeout(()=>{
      let player = curTarget.myPlayer
      if (!player.paused) {
        player.pause();
        clearTimeout(stopOnWordCompleteListener)
      }
      // console.log("current=", playerCurrentTime, "dataM=", dataMms/1000, "offset=",(dataMoffset),"targetIsActive=", curTargetIsActive, "classes=", ev.target.classList)
    },10)
  }
  else {
    stopOnWordCompleteListener = __listenOnWordComplete(__playNextWord)
  }
}

let doSkipLangEN = false;
export function __setLangVisibility(ev, className){
  doSkipLangEN = ev.target.checked
  const method = doSkipLangEN ? 'add' : 'remove'
  let el = document.getElementById(transcriptId).querySelector('ARTICLE');
  el?.classList[method](className)
  console.log(`${el.tagName}: classes=${el.classList}`)
  // TODO: set hal.myPlayer to skip to next data-m value
  //        must add data-d to detect end of <p>
}
function __playNextWord(i){
  const el = document.getElementById(transcriptId).querySelector('ARTICLE');
  const words = hal.wordArr
  window.location.hash = ""; // clear anchor after playing next section
  if (doSkipLangEN){
    console.log("playNextWord after ", words[i].n.innerText.split(":")[1].substring(1,20))
    let node = words[i].n;
    while (node.getAttribute('lang')=='EN' && i<words.length) {
      node = words[++i].n
    }
    node.click();
  }
  else {
    // console.log("playNextWord SKIP ")
  }
}
function __listenOnWordComplete(handlerFn){
  clearTimeout(stopOnWordCompleteListener)
  // give player time to start playing for valid playerCurrentTime
  const PLAYER_DELAY=2000;
  return setTimeout( async ()=>{
    const words = hal.wordArr
    const playerCurrentTime = await hal.myPlayer.getTime();
    // console.log("currentTime=",playerCurrentTime)
    if (hal.myPlayer.paused) {
      clearTimeout(stopOnWordCompleteListener)
      // console.log("is Paused")
      return
    }
    let n = words.findIndex( o=>o.m > playerCurrentTime*1000);
    if (n!==undefined) {
      const playbackRate = hal.myPlayer.player.playbackRate;
      const remainingMs = words[n].m - playerCurrentTime*1000;
      // console.log(words[n].m, "remainingTime=",remainingMs/1000, words[n])
      clearTimeout(stopOnWordCompleteListener)
      stopOnWordCompleteListener = setTimeout( ()=>{
        // const msg = `end word[${n-1}]: ${words[n-1].n.innerText.split(":")[1].substring(1,20)}`
        // console.log(msg);
        handlerFn(n);
        stopOnWordCompleteListener = __listenOnWordComplete(handlerFn)
      }, remainingMs/playbackRate)
    }
  }, PLAYER_DELAY);
}
// __parseDataMTime2Ms(transcriptId);
// __loadMedia();



/* *** dev utils */
/* **
log timings for hyperaudioLite, add `?tag=1`
works best on safari, on chrome, the player time is not updating at playback=1.9
choose <article> => 'edit html' and copy/paste results
*/
function getUrlParameter(sParam) {
  var sPageURL = window.location.search.substring(1),
      sURLVariables = sPageURL.split('&'),
      sParameterName,
      i;

  for (i = 0; i < sURLVariables.length; i++) {
      sParameterName = sURLVariables[i].split('=');
      if (sParameterName[0] === sParam) {
          return sParameterName[1] === undefined ? true : decodeURIComponent(sParameterName[1]);
      }
  }
  return false;
};
async function __logTimings(ev){

  const FORCE_TAGGING = !!getUrlParameter('tag')
  const PLAYBACK_RATE_FOR_TAGGING = 1.9
  hal.myPlayer.player.playbackRate = PLAYBACK_RATE_FOR_TAGGING

  const target = ev.target;
  const dataMms = ev.target.getAttribute('data-m');
  if (dataMms==="0" || dataMms===null || FORCE_TAGGING) {
    ev.stopImmediatePropagation() // do not cue player
    const playerCurrentTime = await hal.myPlayer.getTime();
    const clip = ev.target.innerText.split(":")[1].substring(1,20)
    if (dataMms!==null){
      const click_offset = -1.00; // reflex delay in sec at speed 1.9x
      const timeMs = (Math.round((playerCurrentTime+click_offset)*1000));
      console.log(`"${clip}...", data-m="${timeMs}", was ${dataMms}`)
      ev.target.setAttribute('data-m', timeMs)
    } 
  }
}

function __initTiming(){
  if (!!getUrlParameter('tag')){
    document.getElementById(transcriptId).querySelectorAll('[data-m]').forEach( el=>el.addEventListener("click", __logTimings) );
  }
}

export function __load(){
  __parseDataMTime2Ms(transcriptId);
  __loadMedia();
  __initTiming()
  // move event binding to `mount` method
  // document.getElementById("set_lang").addEventListener("click",__setLangVisibility)
}

// export { __load, __setLangVisibility , transcriptId } 