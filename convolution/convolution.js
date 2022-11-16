/*
 * Copyright (c) 2021-2022 Antonio-R1
 * License: https://github.com/Antonio-R1/racing-js/blob/main/LICENSE | GNU AGPLv3
 */

import {convolution_web_assembly, convolution_module_web_assembly_initialized} from './convolution_web_assembly.js';

class ConvolutionWebAssembly {

   static async init () {

      if (this.conv2 != null) {
         return;
      }

      while (!convolution_module_web_assembly_initialized) {
         await new Promise (resolve => setTimeout (resolve, 1));
      }
      this.conv2 = this.Module.cwrap("conv2", "number", ["array", "number", "number",
                                                         "array", "number", "number"]);
   }

/*
   async compileWasm () {
      if (typeof WebAssembly === "undefined") {
         console.warn ("WebAssembly not supported");
         this.conv2 = function  () {
            throw new Error ("WebAssembly not supported");
         }
         return;
      }

      if (typeof WebAssembly.instantiateStreaming == "undefined") {
         console.warn ("WebAssembly.instantiateStreaming not supported");
         let response = await fetch (this.path+"convolution_asm.wasm");
         let bytes = await response.arrayBuffer ();
         let results = await WebAssembly.instantiate (bytes);
         console.log (results);
         console.log (results.instance);
         console.log (results.instance.exports);

         return;
      }

      let results = await WebAssembly.instantiateStreaming (fetch (this.path+"convolution_asm.wasm"));

      this.conv2 = null;
      return;
   }
*/

}

ConvolutionWebAssembly.Module = convolution_web_assembly ();
ConvolutionWebAssembly.conv2 = null;

export default ConvolutionWebAssembly;