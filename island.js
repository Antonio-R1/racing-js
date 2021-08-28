/*
 * Copyright (c) 2021 Antonio-R1
 * License: https://github.com/Antonio-R1/racing-js/LICENSE | GNU AGPLv3
 */

import * as THREE from './three_js/build/three.module.js';
import {GLTFLoader} from './three_js/examples/jsm/loaders/GLTFLoader.js';

class Island {

   constructor (loadingManager) {
      let island_object = this;
      this.animate_time = null;

      if (Island.gltf_island != null) {
         this.clone ();
         return;
      }

      var gltfLoader = new GLTFLoader(loadingManager);

      gltfLoader.load("gltf/island.glb", function(gltf) {
         Island.gltf_island = gltf;

         island_object.clone ();
      },
      function (xhr) {
//         console.log("object: "+( xhr.loaded / xhr.total * 100 ) + '% loaded' );
      },
      function (error) {
         console.log(error);
      });
   }

   clone () {
      this.object3d = Island.gltf_island.scene.clone ();
   }
}

export default Island;