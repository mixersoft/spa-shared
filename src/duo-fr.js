// ShareThis({
//   sharers: [ ShareThisViaTwitter, ShareThisViaClipboard ],
//   selector: "article"
// }).init();

let minimizedMode = false;
let autoScroll = true;
let doubleClick = false;
let webMonetization = true;
let playOnClick = true;

/** *****************************
 * media provider helpers fns 
 * ***************************** */

/**
 * get mediaData from DuoLingo player iFrame responseText
 * @param {*} responseText 
 * @returns 
 */
function getMediaData_DuoFr(responseText) {
  const regex = /var playlistItem = {(.*?)}/;
  const match = responseText.match(regex);
  if (match) {
    let playListItem = JSON.parse("{"+match[1]+"}");
    // console.log(playListItem);
    const mediaData = playListItem;
    const mediaSrc = playListItem.media_url;
    return {mediaData, mediaSrc};
  }
}


async function xhrFetch(href, getMediaSrcFn ){
  const TIMEOUT = 2000;
  return new Promise((resolve, reject)=>{
    const done = setTimeout( ()=>{
      reject(`Error: timeout fetching media src, href=${href}`)
    }, TIMEOUT)
    const xhr = new XMLHttpRequest();
    xhr.open("GET", href, true);
    xhr.onreadystatechange = ()=>{
      if (xhr.readyState === 4 && xhr.status === 200) {
        // readyState=DONE, window.iframeContentWindow = responseText;
        clearTimeout(done);
        resolve(getMediaSrcFn(xhr.responseText));
      }
    };
    xhr.send();
  });
};

/**
 * respond to player commands
 * play: handled by HyperaudioLite
 * pause: 
 * 
 * @param {*} ev:MouseEvent 
 */
async function playPauseOnClick(ev, player){
  const curTarget = ev.currentTarget;
  const dataMms = ev.target.getAttribute('data-m');
  const dataDms = ev.target.getAttribute('data-d') || 10*1000;
  const playerCurrentTime = await player.getTime();
  const dataMoffset = Math.round(playerCurrentTime) - Math.round(dataMms/1000)
  const targetIsActive =  0<=dataMoffset && dataMoffset<dataDms/1000
  
  var doPause = dataMms===null // true if click on unplayable element
  doPause ||= targetIsActive // true if click on active playable element
  doPause &&= !(dataMms!==null && !targetIsActive) // false if click on playable element that is NOT active
  doPause &&= player.paused!=true;
  
  // console.log( `doPause=${doPause}, targetIsActive: ${playerCurrentTime}: 0 < ${dataMoffset} < ${dataDms/1000}`)
  return new Promise( (resolve)=>{
    if (doPause) {
      setTimeout(()=>{
        let player = curTarget.myPlayer
        if (!player.paused) player.pause();
        return resolve("pause");
        // console.log("current=", playerCurrentTime, "dataM=", dataMms/1000, "offset=",(dataMoffset),"targetIsActive=", curTargetIsActive, "classes=", ev.target.classList)
      },10);
    }
    else {
      return resolve("play");
    }
  });
}

/**
 * deprecate: used for initial timing, but now replaced by timing lib
 * parse [data-m], [data-d] from time to ms
 * @param {*} transcriptEl
 */
function parseDataMTime2Ms(transcriptEl){
  const words = transcriptEl?.querySelectorAll('[data-m]');
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

function playNextWord(i, words){
  window.location.hash = ""; // clear anchor after playing next section
  // console.log("playNextWord after ", words[i].n.innerText.split(":")[1].substring(1,20))
  let node = words[i].n;
  while (node.getAttribute('lang')=='EN' && i<words.length) {
    node = words[++i].n
  }
  node.click();
}


const DEFAULT_CONFIG = {
  mediaProvider: "duo-fr",
  transcriptId: "hypertranscript",
  playerId: "hyperplayer",
  focusLangId: "set_lang",
};




/**
 * default class
 */
export class InteractivePlayer {
  config = {}
  doLangFocus = false;  // focus on lang=Fr, hide lang=EN
  onWordCompleteListenerId_ = null;


  constructor(options){
      Object.assign(this.config, DEFAULT_CONFIG, options);
  }

  /**
   *  extract the media-src url from provider
   */
  async loadMedia(mediaProvider){
    let {transcriptEl} = this.config;  
    if (!transcriptEl){
      transcriptId ||= this.config.transcriptId;
      transcriptEl = document.getElementById(transcriptId);
      Object.assign(this.config, {transcriptEl});
      if (!this.config.transcriptEl) console.error("Error: transcript element was not found")
    }
    
    // deprecate: some transcripts still use [data-m="mm:ss"]
    parseDataMTime2Ms(this.config.transcriptEl);

    return new Promise( (resolve, reject)=>{
      mediaProvider ||= this.config.mediaProvider;
      const self = this;
      switch(mediaProvider){
        case 'duo-fr':
          // duo-fr podcast provides media-src somewhere in iframe player javascript
          document.querySelector("iframe").onload = async function(){
            // this.src == iframe.src
            const {mediaData, mediaSrc} = await xhrFetch(this.src, getMediaData_DuoFr)
            Object.assign(self.config, {mediaData, mediaSrc})
            self.loadHyperaudioLite(mediaSrc)
            return resolve(mediaSrc)
          }
          break;
        default:
          return reject(`Error: provider mediaSrc not found`)
      }
    })
  }

  /**
   * set mediaSrc for HypermediaLite
   * @param {*} mediaSrc 
   * @param {*} transcriptId 
   */
  setMediaUrl(mediaSrc, transcriptId=null){
    let {transcriptEl} = this.config;
    if (!transcriptEl){
      transcriptId ||= this.config.transcriptId;
      transcriptEl = document.getElementById(transcriptId);
      Object.assign(this.config, {transcriptEl});
      if (!this.config.transcriptEl) console.error("Error: transcript element was not found")
    }
    transcriptEl.querySelector("[data-media-src]").setAttribute("data-media-src", mediaSrc);
    // console.log("data-media-src=", transcriptEl.querySelector("[data-media-src]").getAttribute("data-media-src") )
  }


  /**
   * initialize HyperaudioLite player with mediaSrc
   * @param {*} src optional
   */
  loadHyperaudioLite(src){
    if (!!src) {
      Object.assign(this.config, {mediaSrc: src});
      this.setMediaUrl(src);
    }
    const {transcriptId, playerId} = this.config;
    const hal = new HyperaudioLite(transcriptId, playerId, minimizedMode, autoScroll, doubleClick, webMonetization, playOnClick);
    Object.assign(this.config, {hal});
    // debug
    // window.hal = hal
  }


  /**
   * play media on <ARTICLE> click
   */
  playMediaOnClick(){
    let {articleEl} = this.config;
    if (!articleEl){
      articleEl = this.config.transcriptEl.querySelector("article");
      Object.assign(this.config, {articleEl});
      if (!this.config.articleEl) console.error("Error: transcript article element was not found")
    }
    const player = this.config.hal.myPlayer;
    const self = this;
    // register listener for "click" event
    articleEl.onclick = async (ev)=>{
      let action = await playPauseOnClick(ev, player) ;
      // console.warn(">>> action=", action)
      switch( action ){
        case "play":
          if (!!self.doLangFocus){
            self.onWordCompleteListenerId_ = await self.listenOnWordComplete(playNextWord);
            // console.log(">>> setTimeout() id=", self.onWordCompleteListenerId_)
          }
          break;
        case "pause":
          self.stopListener_OnWordComplete();
          break;
      }
    }
    // debug
    articleEl.myPlayer = document.getElementById(playerId)
  }

  toggleLangVisibility(ev, className="hide-en"){
    this.doLangFocus = ev.target.checked
    const method = this.doLangFocus ? 'add' : 'remove'
    // let el = document.getElementById(transcriptId).querySelector('ARTICLE');
    const el = this.config.articleEl;
    el?.classList[method](className)
    if (this.doLangFocus) {
      // TODO: start listener
    }
    else {
      this.stopListener_OnWordComplete();
    }
    // console.log(`${el.tagName}: classes=${el.classList}`)
    // TODO: set hal.myPlayer to skip to next data-m value
    //        must add data-d to detect end of <p>
  }

  stopListener_OnWordComplete(){
    if (!!this.onWordCompleteListenerId_) {
      clearTimeout(this.onWordCompleteListenerId_);
      this.onWordCompleteListenerId_ = null;
      return true;
    }
    return false;
  }

  /**
   * create/register "onWordComplete" event
   * @param {*} handlerFn 
   * @returns 
   */ 
  async listenOnWordComplete(handlerFn){
    const self = this;
    const player = this.config.hal.myPlayer;
    const words = this.config.hal.wordArr;
    const PLAYER_DELAY=2000;
    if (self.stopListener_OnWordComplete()){
      // console.log(`onWordComplete: cleared OLD Timeout`);
    }
    // give player time to start playing for valid playerCurrentTime
    return new Promise( (resolve)=>{
      setTimeout( async ()=>{
        const playerCurrentTime = await player.getTime();
        // console.log("currentTime=",playerCurrentTime)
        if (player.paused) {
          // console.log(`player Paused: clearTimeout( #${self.onWordCompleteListenerId_} ) and do NOT create new one`);
          self.stopListener_OnWordComplete();
          return resolve(null) // paused
        }
        
        let n = words.findIndex( o=>o.m > playerCurrentTime*1000);
        if (~n) {
          const playbackRate = player.player.playbackRate;
          const next_dataM = words[n].m;
          const remainingMs = next_dataM - playerCurrentTime*1000;
          // console.log(words[n].m, "remainingTime=",remainingMs/1000, words[n])
          self.stopListener_OnWordComplete()
  
          const done = setTimeout( async ()=>{
            // const msg = `end word[${n-1}]: ${words[n-1].n.innerText.split(":")[1].substring(1,20)}`
            // console.log(msg);
            if (self.doLangFocus && !!self.onWordCompleteListenerId_){
              handlerFn(n, words);  // call playNextWord(i, words)
              // start next listener after PLAYER_DELAY
              self.onWordCompleteListenerId_ = await self.listenOnWordComplete(handlerFn)
              // console.log(">>> CONTINUE listening, setTimeout() id=", self.onWordCompleteListenerId_)
            }
            else {
              console.warn("did NOT start listener because id=", self.onWordCompleteListenerId_ )
            }
          }, remainingMs/playbackRate);
          return resolve(done);
        }
      }, PLAYER_DELAY);
    });
  }

}  // end class InteractivePlayer



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

export { InteractivePlayer as default }