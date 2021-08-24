import * as THREE from './three_js/build/three.module.js';
import {GLTFLoader} from './three_js/examples/jsm/loaders/GLTFLoader.js';

class Airport {

   constructor (loadingManager) {
      let airport_object = this;
      this.animate_time = null;

      if (Airport.gltf_airport != null) {
         this.clone ();
         return;
      }

      var gltfLoader = new GLTFLoader (loadingManager);

      gltfLoader.load("airport.gltf", function(gltf) {
         Airport.gltf_airport = gltf;

         airport_object.clone ();
      },
      function (xhr) {
         console.log("object: "+( xhr.loaded / xhr.total * 100 ) + '% loaded' );
      },
      function (error) {
         console.log(error);
      });
   }

   clone () {
      this.object3d = Airport.gltf_airport.scene.clone ();
   }
}

export default Airport;