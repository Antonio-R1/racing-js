/*
 * Copyright (c) 2021 Antonio-R1
 * License: https://github.com/Antonio-R1/racing-js/LICENSE | GNU AGPLv3
 */

import * as THREE from './three_js/build/three.module.js';
import {GLTFLoader} from './three_js/examples/jsm/loaders/GLTFLoader.js';

class Barrel {

   constructor (loadingManager) {
      let barrel_object = this;
      this.animate_time = null;

      if (Barrel.gltf_barrel != null) {
         this.clone ();
         return;
      }

      var gltfLoader = new GLTFLoader(loadingManager);

      gltfLoader.load("gltf/barrel.gltf", function(gltf) {
         Barrel.gltf_barrel = gltf;

         barrel_object.clone ();
      },
      function (xhr) {
//         console.log("object: "+( xhr.loaded / xhr.total * 100 ) + '% loaded' );
      },
      function (error) {
         console.log(error);
      });
   }

   clone () {
      this.object3d = Barrel.gltf_barrel.scene.clone ();
   }
}

export default Barrel;