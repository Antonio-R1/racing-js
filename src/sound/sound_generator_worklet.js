/*
 * Copyright (c) 2021 Antonio-R1
 * License: https://github.com/Antonio-R1/racing-js/LICENSE | GNU AGPLv3
 */

import * as THREE from '../three_js/build/three.module.js';

const SPEED_OF_SOUND = 343; // speed of sound in m/s

class SoundGeneratorAudioListener extends THREE.AudioListener {

   constructor () {
      super();
      this.worldPosition = new THREE.Vector3();
   }

   updateMatrixWorld (force) {
      super.updateMatrixWorld (force);
      this.getWorldPosition(this.worldPosition);
   } 

}

class SoundGenerator extends THREE.PositionalAudio {

   constructor (listener) {
      super(listener);

      this.delayNode = this.context.createDelay(50);
//      this.setFilter(this.delayNode);

      this.worklet = null;
      this.lastTimeUpdated = null;

      this.worldPosition = new THREE.Vector3();
   }

   static _load(loadingManager, listener, path) {
      loadingManager.itemStart(path);
      listener.context.audioWorklet.addModule(path)
                                   .then (() => loadingManager.itemEnd (path));
   }

   _setOutputSource (audioNode, index) {
      this.audioNode.connect (audioNode, index);

      this.hasPlaybackControl = false;
      this.sourceType = 'audioNode';
      this.source = this.delayNode;
   }

   _setNodeSources(audioNodeArray) {

      for (let i=0; i<audioNodeArray.length; i++) {
         audioNodeArray[i].connect (this.delayNode);
      }
      this.hasPlaybackControl = false;
      this.sourceType = 'audioNode';
      this.source = this.delayNode;

   }

   setNodeSource () {
      throw new Error ("not supported");
   }

   setMediaElementSource() {
      throw new Error ("not supported");
   }

   setMediaStreamSource() {
      throw new Error ("not supported");
   }

   setBuffer() {
      throw new Error ("not supported");
   }

   play () {
      this.isPlaying = true;

      return this.connect();
   }

   stop () {
      if (this.isPlaying) {
         this.isPlaying = false;
         return this.disconnect();
      }
   }

   updateMatrixWorld (force) {
      super.updateMatrixWorld (force);
      this.getWorldPosition(this.worldPosition);

      if (!this.worklet) {
         return;
      }

      // doppler effect with delay nodes similar to https://github.com/WebAudio/web-audio-api/issues/372#issuecomment-250024610

      let time = this.context.currentTime;
      let distanceToListener = this.worldPosition.distanceTo(this.listener.worldPosition);
      let dt = time-this.lastTimeUpdated;

      if (this.lastTimeUpdated===null) {
         this.lastTimeUpdated = this.context.currentTime;
         this.delayNode.delayTime.value = distanceToListener/SPEED_OF_SOUND;
      }

      if (dt < 0.1) {
         return;
      }

      this.delayNode.delayTime.linearRampToValueAtTime(distanceToListener/SPEED_OF_SOUND, this.context.currentTime+dt);

      this.lastTimeUpdated = this.context.currentTime;
   }

}

class EngineSoundGenerator extends SoundGenerator {

   constructor ({listener, parameters}) {
      super (listener);

      this.gainIntake = this.context.createGain();
      this.gainIntake.gain.value = 1.0;

      this.gainEngineBlockVibrations = this.context.createGain();
      this.gainEngineBlockVibrations.gain.value = 1.0;

      this.gainOutlet = this.context.createGain();
      this.gainOutlet.gain.value = 1.0;

      let options = {numberOfInputs: 0, numberOfOutputs: 3, processorOptions: parameters};
      this.addWorkletNode(options);
   }

   /* example for parameters:
      {cylinders: 4,

       intakeWaveguideLength: 100,
       exhaustWaveguideLength: 100,
       extractorWaveguideLength: 100,

       intakeOpenReflectionFactor: 0.25,
       intakeClosedReflectionFactor: 0.95,

       exhaustOpenReflectionFactor: 0.25,
       exhaustClosedReflectionFactor: 0.95,
       ignitionTime: 0.016,

       straightPipeWaveguideLength: 128,
       straightPipeReflectionFactor: 0.1,

       mufflerElementsLength: [10, 15, 20, 25],
       action: 0.25,

       outletWaveguideLength: 5,
       outletReflectionFactor: 0.1}
   */
   setParameters (parameters) {
      this.worklet.port.postMessage(parameters);
   }

   addWorkletNode (options) {
      this.worklet = new AudioWorkletNode (this.listener.context, "engine-sound-processor", options);
      this.worklet.connect (this.gainIntake, 0);
      this.worklet.connect (this.gainEngineBlockVibrations, 1);
      this.worklet.connect (this.gainOutlet, 2);
      this._setNodeSources ([this.gainIntake, this.gainEngineBlockVibrations, this.gainOutlet]);
   }

   static load (loadingManager, listener) {
      SoundGenerator._load(loadingManager, listener, "sound/engine_sound_generator_worklet.js");
   }

}

class EngineSoundOutput extends SoundGenerator {

   constructor (audioNode, outputIndex) {
      this._setOutputSource(audioNode, outputIndex);
   }

}

class MultipleOutputsEngineSoundGenerator {

   constructor ({listener, parameters = undefined}) {

      this.listener = listener;
      let options = {numberOfInputs: 0, numberOfOutputs: numberOfOutputs, processorOptions: parameters}
      this.listener.context.audioWorklet.addModule("engine_sound_generator_worklet.js")
                           .then (() => this.addWorkletNode(options));
   }

   addWorkletNode(options) {
      this.worklet = new AudioWorkletNode (this.listener.context, "engine-sound-processor", options);
      this.intakePositionalAudio = new EngineSoundOutput(this.worklet, 0);
      this.engineBlockVibationsPositionalAudio = new EngineSoundOutput(this.worklet, 1);
      this.outletPositionalAudio = new EngineSoundOutput(this.worklet, 2);
   }

   setParameters (parameters) {
      this.worklet.port.postMessage(parameters);
   }
}

export {SoundGeneratorAudioListener, EngineSoundGenerator};
