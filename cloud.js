import * as THREE from './three_js/build/three.module.js';
import {GLTFLoader} from './three_js/examples/jsm/loaders/GLTFLoader.js';

class Clouds extends THREE.InstancedMesh {
   constructor (positions, size, boundingSpherePosition, boundingSphereRadius, texturePath) {
      var geometry = new THREE.PlaneGeometry (size, 0.5*size, 1);
      let textureLoader = new THREE.TextureLoader();
      var map;
      if (texturePath) {
         map = textureLoader.load(texturePaths);
      }
      else {
         var texture = Math.floor (3*Math.random ());
         if (texture == 0) {
            map = textureLoader.load("images/cloud1.png");
         }
         else if (texture == 1) {
            map = textureLoader.load("images/cloud2.png");
         }
         else if (texture == 2) {
            map = textureLoader.load("images/cloud3.png");
         }
      }
      var material = new THREE.MeshToonMaterial({map: map, side: THREE.DoubleSide, transparent: true});
      super (geometry, material, positions.length),
      this.count = positions.length;
      this.positions = positions;
      this.map = map;
      this.instanceMatrix.setUsage (THREE.StaticDrawUsage);
      this._matrixTemplate = new THREE.Matrix4 ();

      this.frustumCulled = true;
      var boundingSpherePosition = boundingSpherePosition;
      this.geometry.boundingSphere = new THREE.Sphere (boundingSpherePosition, boundingSphereRadius);

      for (var i=0; i<this.count; i++) {
         this._matrixTemplate.makeScale (1+Math.random (), 1+Math.random (), 1);
         this._matrixTemplate.makeRotationFromEuler (new THREE.Euler (0, 2*Math.PI*Math.random(), 0));
         this._matrixTemplate.setPosition (new THREE.Vector3 (this.positions[i].x, Math.random()*2000+1000, this.positions[i].y));
         this.setMatrixAt (i, this._matrixTemplate);
      }
   }
}

class Fog extends THREE.InstancedMesh {

   constructor (size) {
      var geometry = new THREE.PlaneGeometry (size, size, 1);
      var map = new THREE.TextureLoader().load("images/cloud.png");
      var material = new THREE.MeshToonMaterial({map: map, depthWrite: false, fog: false, transparent: true});
      super (geometry, material, 25);
      this.map = map;
      this.instanceMatrix.setUsage (THREE.DynamicDrawUsage);
      this._matrixTemplate = new THREE.Matrix4 ();

      this.positions = [];

      var distance = size/this.count;

      for (var i=0; i<this.count; i++) {
         this._matrixTemplate.makeScale (1+10*Math.random (), 1+10*Math.random (), 1);
         var position = new THREE.Vector3 (Math.random ()*100-50, Math.random ()*100-50, i*distance);
         this.positions.push (position);
         this._matrixTemplate.setPosition (position);
         this.setMatrixAt (i, this._matrixTemplate);
      }

      this.frustumCulled = true;
      var boundingSpherePosition = this.position.clone ();
      boundingSpherePosition.y += 0.5*size;
      this.geometry.boundingSphere = new THREE.Sphere (boundingSpherePosition, size);
      this._onBeforeRender = function () {};
      var cloud = this;
      super.onBeforeRender = this.updateRotation;
      this.renderOrder = 1;
      this.instanceMatrix.needsUpdate = true;
   }

   updateRotation (renderer, scene, camera, geometry, material, group) {
      var position = new THREE.Vector3 ();
      position = camera.getWorldPosition (position).sub (this.position);

      for (var i=0; i<this.count; i++) {
         this.getMatrixAt (i, this._matrixTemplate);
         this._matrixTemplate.lookAt (position, this.positions[i], this.up);
         this.setMatrixAt (i, this._matrixTemplate);
      }

      this.instanceMatrix.needsUpdate = true;

      // call the onBeforeRender callback set on the "Cloud" object
      this._onBeforeRender ();
   }

   setPosition (x, y, z) {
      this.position.set (x, y, z);
      this.geometry.boundingSphere.center.set (this.position);
   }

   set onBeforeRender (value) {
      this._onBeforeRender = value;
   }

   get onBeforeRender () {
      return this._onBeforeRender;
   }
}

export {Clouds, Fog};