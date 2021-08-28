/*
 * Copyright (c) 2021 Antonio-R1
 * License: https://github.com/Antonio-R1/racing-js/LICENSE | GNU AGPLv3
 */

import * as THREE from './three_js/build/three.module.js';
import {GLTFLoader} from './three_js/examples/jsm/loaders/GLTFLoader.js';

class Rocket {

   constructor (loadingManager) {
      let rocket_object = this;
      this.animate_time = null;

      if (Rocket.gltf_rocket != null) {
         this.clone ();
         return;
      }

      var gltfLoader = new GLTFLoader(loadingManager);

      gltfLoader.load("gltf/rocket.gltf", function(gltf) {
         Rocket.gltf_rocket = gltf;

         rocket_object.clone ();
      },
      function (xhr) {
//         console.log("object: "+( xhr.loaded / xhr.total * 100 ) + '% loaded' );
      },
      function (error) {
         console.log(error);
      });
   }

   clone () {
      this.object3d = Rocket.gltf_rocket.scene.clone ();
   }
}

export default Rocket;