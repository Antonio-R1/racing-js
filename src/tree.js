/*
 * Copyright (c) 2021-2022 Antonio-R1
 * License: https://github.com/Antonio-R1/racing-js/blob/main/LICENSE | GNU AGPLv3
 */

import * as THREE from './three_js/build/three.module.js';

class Trees extends THREE.InstancedMesh {
   constructor (positions, size, boundingSpherePosition, boundingSphereRadius, texturePath) {
      var geometry = new THREE.PlaneGeometry (0.2*size, size, 1);
      var map;
      if (texturePath) {
         map = new THREE.TextureLoader().load(texturePath);
      }
      else {
         var texture = Math.floor (3*Math.random ())*0;
         if (texture == 0) {
            map = new THREE.TextureLoader().load("images/tree1.png");
         }
      }
      var material = new THREE.MeshPhysicalMaterial({map: map, depthWrite: false, side: THREE.DoubleSide, transparent: true});
      super (geometry, material, positions.length),
      this.count = positions.length;
      this.positions = positions;
      this.map = map;
      this.instanceMatrix.setUsage (THREE.StaticDrawUsage);
      this._matrixTemplate = new THREE.Matrix4 ();

      this.frustumCulled = true;
      this.geometry.boundingSphere = new THREE.Sphere (boundingSpherePosition, boundingSphereRadius);

      for (var i=0; i<this.count; i++) {
         this._matrixTemplate.makeScale (1+Math.random (), 1+Math.random (), 1);
         this._matrixTemplate.makeRotationFromEuler (new THREE.Euler (0, 2*Math.PI*Math.random(), 0));
         this._matrixTemplate.setPosition (new THREE.Vector3 (this.positions[i].x, this.positions[i].y+0.25*size, this.positions[i].z));
         this.setMatrixAt (i, this._matrixTemplate);
      }
   }
}

export default Trees;