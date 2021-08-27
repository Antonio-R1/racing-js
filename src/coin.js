import * as THREE from './three_js/build/three.module.js';
import {GLTFLoader} from './three_js/examples/jsm/loaders/GLTFLoader.js';

class Coin {

   constructor (loadingManager) {
      let coin_object = this;
      this.animate_time = null;

      if (Coin.gltf_coin != null) {
         this.clone ();
         return;
      }

      var gltfLoader = new GLTFLoader(loadingManager);

      gltfLoader.load("gltf/coin.gltf", function(gltf) {
         Coin.gltf_coin = gltf;

         coin_object.clone ();
      },
      function (xhr) {
//         console.log("object: "+( xhr.loaded / xhr.total * 100 ) + '% loaded' );
      },
      function (error) {
         console.log(error);
      });
   }

   clone () {
      this.object3d = Coin.gltf_coin.scene.clone ();
   }
}

export default Coin;