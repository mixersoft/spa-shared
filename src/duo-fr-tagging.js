// import {timer} from "rxjs";

const DEFAULT_CONFIG = {
  mediaProvider: "duo-fr",
  transcriptId: "hypertranscript",
  playerId: "hyperplayer",
};

function getUrlParameter(sParam) {
  var sPageURL = window.location.search.substring(1),
      sURLVariables = sPageURL.split('&'),
      sParameterName,
      i;

  for (i = 0; i < sURLVariables.length; i++) {
      sParameterName = sURLVariables[i].split('=');
      if (sParameterName[0] === sParam) {
          return sParameterName[1] === undefined ? true : JSON.parse(decodeURIComponent(sParameterName[1]));
      }
  }
  return false;
};

/**
 * sound FX for UX
 */
const baseurl = "//localhost:9000";
const audioFx = {
  'ding': new Audio(`${baseurl}/src/66717__cj4096__bell.wav`),
  'click': new Audio(`${baseurl}/src/448080__breviceps__wet-click.wav`),
  'buzz': new Audio(`${baseurl}/src/28477__simmfoc__buzz-1.wav`),
}

export let doEdit = ()=> !!getUrlParameter('edit');

/**
 * TODO:
 * - split by sentence. wrap with <span>
 * - click to add [data-m], or [-][+] adjust +/- 200ms
 * - copy/save to innerHTML
 */

/** *****************************
 * get timings for hyperaudioLite, 
 * add queryparam=`?tag=1` to load
 * 
 * works best on safari, on chrome, the player time is not updating at playback=1.9
 * choose <article> => 'edit html' and copy/paste results 
 * ***************************** */
export class HalEditor  {
  config = {}
  transcriptEl;
  player;
  audioFx;
  isActive = false;
  halTargetEl;    // span[data-m]

  constructor(options={}){
    Object.assign(this.config, DEFAULT_CONFIG, options);

    if (!this.config.transcriptEl){
      console.warn("warning: instantiate class HalEditor AFTER class InteractivePlayer")
      let transcriptId = this.config.transcriptId;
      let transcriptEl = document.getElementById(transcriptId);
      Object.assign(this.config, {transcriptEl});
      if (!this.config.transcriptEl) console.error("Error: transcript element was not found")
    }
    this.transcriptEl = this.config.transcriptEl;
    this.player = this.config.hal.myPlayer;
    // preload audio
    this.audioFx = audioFx;
    Object.values(this.audioFx).forEach( el=>el.setAttribute('preload','auto'));
  }

  logTimings = async (ev)=>{
    const FORCE_TAGGING = !!getUrlParameter('edit')
    const PLAYBACK_RATE_FOR_TAGGING = 1; // 1.9
    this.player.player.playbackRate = PLAYBACK_RATE_FOR_TAGGING
  
    this.halTargetEl = ev.target;
    const dataMms = this.halTargetEl.getAttribute('data-m');
    if (ev.metaKey || ev.shiftKey || ev.altKey){
      const clip = this.halTargetEl.innerText.split(":")[1].substring(1,20)
      console.log(`select: data-m=${humanizeMs(dataMms)} , ${clip}`); // true or false
      return;
    }
    if (dataMms==="0" || dataMms===null || FORCE_TAGGING) {
      ev.stopImmediatePropagation() // do not cue player
      const playerCurrentTime = await this.player.getTime();
      const clip = this.halTargetEl.innerText.split(":")[1].substring(1,20)
      if (dataMms!==null){
        const click_offset = -1.00; // reflex delay in sec at speed 1.9x
        const timeMs = (Math.round((playerCurrentTime+click_offset)*1000));
        console.log(`"${clip}...", data-m="${timeMs}", was ${dataMms}`)
        this.halTargetEl.setAttribute('data-m', timeMs)
      } 
    }
  }

  _handleKeydown(ev){
    // bind this=HalEditor
    self = this;
    Promise.resolve(ev)
    .then( this._checkForReplay.bind(this))
    .then( (ev)=>{ 
      if (ev=="done") return Promise.reject("done")
      return ev;
    })
    .then( ev=>{
      return this._adjustTiming.bind(this)( ev, "data-m")
    } )
    .catch( console.log );
  }

  async _checkForReplay( ev ) {
    const REPLAY_DURATION_MS=3000;
    // bind this=HalEditor
    self = this;
    if (["Space", "Enter"].includes(ev.code)){
      ev.preventDefault();

      // return to curTime after replay clip
      let curTime = await this.player.getTime();
      const dataMms = this.halTargetEl.getAttribute('data-m');
      
      // TODO: need a separate changed and commit state, keySpace/keyEnter?
      if (ev.code=="Enter"){
        this.halTargetEl.classList.add('data-commit');
        // remove attr0
      }

      // replay clip at dataM for duration=REPLAY_DURATION_MS
      // audioFx: start of replay clip
      await this.audioFx.click.play();
      this.player.setTime(dataMms/1000)
      this.player.play()
      console.log(`replay at data-m=${dataMms}`);
      clearTimeout(this.config._cancelReplayClip);
      this.config._cancelReplayClip = setTimeout.bind(this)( async ()=>{
        // audioFx: end of replay clip
        await this.audioFx.ding.play();  
        // then return to curTime after replay clip
        console.log("return to curTime=", Math.round(curTime*10)/10 );
        this.player.setTime(curTime);
        this.player.play();
      }
      , REPLAY_DURATION_MS);

      return Promise.resolve("done");
    }
    else {
      // not replay, continue with event processing
      return ev;
    }
  }
  
  async _adjustTiming( ev, attr="data-m" ){
    // bind this=InteractivePlayer
    const INCREMENT_MS = 300;
    let check = this // undefined
    let targetEl = this.halTargetEl;
    const deltaMs = plusOrMinus(ev) * INCREMENT_MS;
    if (deltaMs==0) return ev;
  
    let curTimeMs = parseInt(targetEl.getAttribute(attr));
    const timeMs = Math.round(curTimeMs + deltaMs);
    const clip = targetEl.innerText.split(":")[1].substring(1,20)
    // save orig value
    const attr0 = `${attr}-0`;
    if (!targetEl.hasAttribute(attr0)) {
      targetEl.classList.add('data-changed');
      targetEl.setAttribute(attr0, targetEl.getAttribute(attr));
    }
    targetEl.setAttribute(attr, timeMs)
    console.log(`"${clip}...", ${attr}="${(timeMs)}", was ${(curTimeMs)}+${Math.round(deltaMs)}`)
    return timeMs;
  }

  
  /**
   * expand span[data-m] to sentences or phrases
   * @param {*} ev 
   */
  expandContent(ev){
    let target = ev.target;
    let text = target.textContent;
    let regex = /\b\w{5,}[.!?]/g;
    let matches = str.match(regex);
    console.log(matches);
  }



  tagOrExpand(ev){
    let target = ev.target;
    console.log("keydown=",ev.code)
    // let text = target.textContent;
    // let regex = /[^.!?]+[.!?]/g // /\b\w{5,}[.!?]/g;
    // let matches = text.match(regex);
    // console.log(matches);
  }

  /**
   * listen for halEditor click events
   * 
   * @param {*} force 
   * @param {*} cb, (onChange hack) callback function to call in external scope 
   * @returns boolean  true, if edit mode, e.g. this.isActive
   */
  toggleEdit(force=false, cb){
    const self = this;
    const action = typeof force=="boolean" ? force : !this.isActive;
    if (typeof cb != "undefined") {
      this.cb = cb;  // "register" callback
    }
    if (this.isActive==action) {
      console.log(`toggleEdit() state unchanged`);
      return;
    }

    this.isActive = action;
    const method = this.isActive ? 'addEventListener' : 'removeEventListener';
    this.transcriptEl.querySelectorAll('[data-m]').forEach( el=>{
      el[method]("click",this.logTimings);
    });
    document[method]("keydown"
      , this._handleKeydown.bind(this)
      // , this._handleKeydown
    );
    
    // debug
    window.check = this

    switch (typeof this.cb ) {
      case "function":
        this.cb(this.isActive);
        return this.isActive;
      case "object": // thenable
        return Promise.resolve(this.isActive).then( this.cb ).then( ()=>this.isActive );
      case "undefined":
          return this.isActive;
      default:
        this.cb = null;
        return;
    }
  }

} // end class HalEditor






function humanizeMs(v){
  return Math.round(v/100)/10;
}
/**
 * detect document."keydown" event and add or remove time
 */
function plusOrMinus(ev){
  let decode = {
    "Comma": -1,
    "Period": 1,
    "ArrowLeft": -1,
    "ArrowRight": 1,
  }
  return decode[ev.code] || 0;
}

function handleKeydown(ev, self){
  // bind this=HalEditor
  self ||= this;
  Promise.resolve(ev)
  .then( this._checkForReplay.bind(this))
  .then( (ev)=>{ 
    if (ev=="done") return Promise.reject("done")
    return ev;
  })
  .then( ev=>{
    return this._adjustTiming.bind(this)( ev, "data-m")
  } )
  .catch( console.log );
}


export { HalEditor as default }