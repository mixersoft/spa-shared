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
  isActive = false;

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
  }

  logTimings = async (ev)=>{
    const FORCE_TAGGING = !!getUrlParameter('edit')
    const PLAYBACK_RATE_FOR_TAGGING = 1.9
    this.player.player.playbackRate = PLAYBACK_RATE_FOR_TAGGING
  
    const target = ev.target;
    const dataMms = ev.target.getAttribute('data-m');
    if (dataMms==="0" || dataMms===null || FORCE_TAGGING) {
      ev.stopImmediatePropagation() // do not cue player
      const playerCurrentTime = await this.player.getTime();
      const clip = ev.target.innerText.split(":")[1].substring(1,20)
      if (dataMms!==null){
        const click_offset = -1.00; // reflex delay in sec at speed 1.9x
        const timeMs = (Math.round((playerCurrentTime+click_offset)*1000));
        console.log(`"${clip}...", data-m="${timeMs}", was ${dataMms}`)
        ev.target.setAttribute('data-m', timeMs)
      } 
    }
  }
  /**
   * listen for halEditor click events
   * 
   * @param {*} force 
   * @param {*} cb, (onChange hack) callback function to call in external scope 
   * @returns 
   */
  toggleEdit(force=false, cb){
    this.isActive = force ? force : !this.isActive;
    if (typeof cb != "undefined") {
      this.cb = cb;  // "register" callback
    }
    const method = this.isActive ? 'addEventListener' : 'removeEventListener';
    this.transcriptEl.querySelectorAll('[data-m]').forEach( el=>el[method]("click", this.logTimings) );
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

} // end class HypertranscriptTagger

export { HalEditor as default }