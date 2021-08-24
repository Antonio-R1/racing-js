import * as THREE from '../three_js/build/three.module.js';

const SPEED_OF_SOUND = 343; // speed of sound in m/s

const SAMPLING_RATE = 44100;
const SAMPLING_RATE_INVERSE = 1.0/SAMPLING_RATE;

class SoundGenerator {

   constructor (listener) {
      this.sounds = [];
      this.listener = listener;
      this.listenerPosition = new THREE.Vector3();
      this.listenerLastPosition = null;
      this.estimatedNewPositionListener = new THREE.Vector3();
   }

   add (sound) {
      this.sounds.push(sound);
   }

   updateSounds (dt) {

      this.listener.getWorldPosition(this.listenerPosition);

      if (!this.listenerLastPosition) {

         for(let i=0; i<this.sounds.length; i++) {
            this.sounds[i].update(this.listenerPosition, undefined, dt);
         }

         this.listenerLastPosition = this.listenerPosition.clone();
         return;
      }

      this.estimatedNewPositionListener.copy(this.listenerPosition).sub(this.listenerLastPosition).multiplyScalar(1.0+dt);
      for(let i=0; i<this.sounds.length; i++) {
         if (this.sounds[i].active) {
            this.sounds[i].update(this.listenerPosition, this.estimatedNewPositionListener, dt);
            this.sounds[i].playSound();
         }
      }

      this.listenerLastPosition.copy(this.listenerPosition);
   }

}

/*
 * a lowpass filter based on https://en.wikipedia.org/wiki/Low-pass_filter#Simple_infinite_impulse_response_filter
 */
class LowpassFilter {
   constructor (frequency, lastValue = 0.0) {
      this.frequency = frequency;
      this.alpha = 2.0*Math.PI*SAMPLING_RATE_INVERSE*frequency/(2.0*Math.PI*SAMPLING_RATE_INVERSE*frequency+1.0);
      this.lastValue = lastValue;
   }

   getFilteredValue (value) {
//      let filteredValue = alpha*value+(1-alpha)*this.lastValue;
      let filteredValue = this.lastValue+this.alpha*(value-this.lastValue);
      this.lastValue = filteredValue;
      return filteredValue;
   }
}

class GeneratedPositionalAudio extends THREE.PositionalAudio {
   constructor (listener) {
      super(listener);
      this.listener = listener;
      this.source = null;
      this.lastPosition = null;
      this.currentPosition = new THREE.Vector3();

      this.delayNode = this.context.createDelay(50);
      this.delayNode.delayTime.linearRampToValueAtTime(0, this.context.currentTime);
      this.setFilter(this.delayNode);

      this.started = false;
      this.active = false;

      this.estimatedNewPosition = new THREE.Vector3();

      this.bufferDuration = 0.05;
      this.secondsPerSample = 1.0/SAMPLING_RATE;
      this.chunkSize = Math.floor(SAMPLING_RATE*this.bufferDuration);
      this.setBuffer(this.listener.context.createBuffer(1, this.chunkSize, SAMPLING_RATE));
   }

   updateDelayAndDopplerEffect (listenerPosition, estimatedNewPositionListener, dt) {

      this.getWorldPosition(this.currentPosition);

      if (!this.lastPosition) {
         this.lastPosition = this.currentPosition.clone();
         return;
      }

      let distanceFromListener = listenerPosition.distanceTo(this.currentPosition);

      // doppler effect with delay nodes similar to https://github.com/WebAudio/web-audio-api/issues/372#issuecomment-250024610

      this.estimatedNewPosition.copy(this.currentPosition).sub(this.lastPosition).multiplyScalar(1.0+dt);
      let estimatedNewDistance = this.estimatedNewPosition.distanceTo(estimatedNewPositionListener);

      this.delayNode.delayTime.linearRampToValueAtTime(estimatedNewDistance/SPEED_OF_SOUND, this.context.currentTime+dt);

      this.lastPosition.copy(this.currentPosition);
   }

   playSound () {
      this.active = true;
   }

   // copied from https://github.com/mrdoob/three.js/blob/d0340e3a147e290fa86d14bc3ed97d8e1c20602e/src/audio/Audio.js#L90-L125 with some modifications
   play (delay = 0) {

      if (this.hasPlaybackControl === false) {
         console.warn( 'THREE.Audio: this Audio has no playback control.');
	 return;
      }

      if ( this.started !== true ) {
//         let audioTimestamp = this.context.getOutputTimestamp();
//         console.log (this._startedAt+" "+audioTimestamp.contextTime);
         this._startedAt = this.context.currentTime + delay;
         this.started = true;
      }
      else {
         this._startedAt += this.bufferDuration;
      }

      const source = this.context.createBufferSource();
      source.buffer = this.buffer;

      source.loop = this.loop;
      source.loopStart = this.loopStart;
      source.loopEnd = this.loopEnd;
      source.onended = this.onEnded.bind( this );
      source.start( this._startedAt );

      this.isPlaying = true;

      this.source = source;

      this.setDetune( this.detune );
      this.setPlaybackRate( this.playbackRate );

      return this.connect();
   }

   stop () {
      this.active = false;
      super.stop();
   }
}

class SoundSineWave extends GeneratedPositionalAudio {

    constructor (listener) {
       super(listener);
       this.frequency = 440;
       this.lastIndex = 0;
    }

    playSound () {

       if (this._startedAt>this.context.currentTime) {
          return;
       }

       const sound = Float32Array.from({length: this.chunkSize}, (_, index) => Math.sin((this.lastIndex+index)*this.frequency/SAMPLING_RATE*2*Math.PI));
//       const sound = new Float32Array(this.chunkSize);
//       for (let i=0; i<sound.length; i++) {
//          sound[i] = Math.sin((this.lastIndex+i)*this.frequency/SAMPLING_RATE*2*Math.PI);
//       }
       this.lastIndex += this.chunkSize;

       this.buffer.copyToChannel(sound, 0);

       super.play();
    }

    play () {
        super.playSound ();
        this.playSound ();
    }

    stop () {
        this.started = false;
        super.stop();
    }

    update (listenerPosition, estimatedNewPositionListener, dt) {
       this.updateDelayAndDopplerEffect (listenerPosition, estimatedNewPositionListener, dt)
    }
}

export {SoundGenerator, GeneratedPositionalAudio, SoundSineWave, LowpassFilter};