/*
 * Copyright (c) 2021 Antonio-R1
 * License: https://github.com/Antonio-R1/racing-js/LICENSE | GNU AGPLv3
 */

import * as THREE from './three_js/build/three.module.js';

class SkySphere extends THREE.Scene {

   constructor (radius, drawClouds) {

      super ();
      this.ambientLight = new THREE.AmbientLight(0xffffff, 0.25);
      this.add(this.ambientLight);

      this.directionalLight = new THREE.DirectionalLight(0xffffff, 0.5);
      this.directionalLight.position.x = 5000;
      this.directionalLight.position.y = 1500;
      this.directionalLight.position.z = -1500;
      this.twilightEnd = 1000.0;
      this.setDirectionalLightValues ();
      this.add(this.directionalLight);

      const vertexShader = `varying vec3 vWorldPosition;
                            void main () {
                               gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
                               vWorldPosition = (modelMatrix*vec4 (position, 1.0)).xyz;
                            }`;
      const fragmentShader = `varying vec3 vWorldPosition;
                              uniform vec3 sunPosition;
                              uniform sampler2D textureClouds;

                              void main () {
                                 vec3 position = vWorldPosition-cameraPosition;
                                 vec3 direction = normalize (position);
                                 vec3 sunDirection = normalize (sunPosition);
                                 vec4 color = vec4 (0.25, 0.25, 1.0, 1.0);
                                 vec2 texturePosition = 0.5*(direction.xy+1.0);
                                 color = texture2D (textureClouds, texturePosition);
                                 lowp float cosSun = dot (direction, sunDirection);

                                 lowp float tmp = smoothstep (0.975, 1.0, cosSun);
                                 lowp float sun = smoothstep (0.9995, 1.0, cosSun);

                                 lowp float cosRight = direction.x;
                                 lowp float cosUp = direction.y;
                                 lowp float cosForward = direction.z;

                                 color = color*smoothstep (0.0, 1.0, sunPosition.y*0.005);
                                 color.a = 1.0;
                                 color.r = color.r+sun+0.25*tmp;
                                 color.g = color.g+mix (0.0, sun+0.25*tmp, clamp (0.0, 1.0, 0.001*sunPosition.y));
                                 color.b = color.b-0.5*sun-0.25*tmp;
                                 gl_FragColor = clamp (color, 0.0, 1.0);
                              }`;


      var canvasClouds = document.createElement ("canvas");
      var textureClouds = new THREE.CanvasTexture (canvasClouds);
      textureClouds.wrapS = THREE.ClampToEdgeWrapping;
      textureClouds.wrapT = THREE.ClampToEdgeWrapping;

      var sphereGeometry = new THREE.SphereGeometry (radius, 16, 16);
      var sphereMaterial = new THREE.ShaderMaterial ({vertexShader: vertexShader,
                                                      fragmentShader: fragmentShader,
                                                      side: THREE.BackSide,
                                                      uniforms: {
                                                         sunPosition: {value: this.directionalLight.position},
                                                         textureClouds: {value: textureClouds}
                                                      }
                                                      });
      this.skySphere = new THREE.Mesh (sphereGeometry, sphereMaterial);
      this.add (this.skySphere);

      this.canvasClouds = canvasClouds;
      this.canvasClouds.width = 100;
      this.canvasClouds.height = 100;
      this.gl = this.canvasClouds.getContext("webgl") || this.canvasClouds.getContext("experimental-webgl");

      if (!this.gl) {
         throw new Error ("WebGL is not supported.");
      }
      this.drawClouds = drawClouds;

      this.gl.clearColor (69.0/255.0, 69.0/255.0, 1.0, 1.0);
      this.gl.clear (this.gl.COLOR_BUFFER_BIT);

      const vertexShaderClouds =
                           `attribute vec4 aPosition;
                            varying vec2 vPosition;
                            void main () {
                               gl_Position = aPosition;
                               vPosition = (aPosition.xy+1.0)/2.0;
                               vPosition.y = 1.0-vPosition.y;
                            }`;

      const fragmentShaderClouds =
                             `precision lowp float;
                              uniform float t;
                              uniform vec3 sun_position;
                              uniform float width;
                              uniform float height;
                              uniform float frequency;
                              uniform float amplitude;
                              uniform float rate_of_change;
                              uniform float rate_of_change_inverse;
                              uniform sampler2D permutation;
                              varying vec2 vPosition;

                              float hash (float x) {
                                 return texture2D (permutation, vec2 (fract (x), 1.0)).r;
                              }

                              float get_value (float frequency, float x, float y) {
                                 x *= frequency;
                                 x += t;
                                 y *= frequency;
                                 float segments = 255.0;
                                 float segment_length = 1.0/segments;
                                 float x_integer = floor (x)*segment_length;
                                 float y_integer = floor (y)*segment_length;

                                 float top_left = hash (hash (x_integer)+y_integer);
                                 float top_right = hash (hash (x_integer+segment_length)+y_integer);
                                 float bottom_left = hash (hash (x_integer)+y_integer+segment_length);
                                 float bottom_right = hash (hash (x_integer+segment_length)+y_integer+segment_length);

                                 x = smoothstep (0.0, 1.0, x-segments*x_integer);
                                 y = smoothstep (0.0, 1.0, y-segments*y_integer);
                                 float a = mix (top_left, top_right, x);
                                 float b = mix (bottom_left, bottom_right, x);
                                 return mix (a, b, y);
                              }

                              void main () {
                                 gl_FragColor = vec4 (69.0/255.0, 69.0/255.0, 1.0, 1.0);

                                 float current_frequency = frequency;
                                 float current_amplitude = amplitude*0.5;

                                 for (int i=0; i<5; i++) {
                                    float value = abs (get_value (current_frequency, vPosition.x, vPosition.y)*2.0-1.0)*current_amplitude;
                                    gl_FragColor.r += value;
                                    gl_FragColor.g += value;
                                    gl_FragColor.b += value;
                                    current_frequency *= rate_of_change;
                                    current_amplitude *= rate_of_change_inverse;
                                 }

                                 gl_FragColor = clamp(vec4(0.0, 0.0, 0.0, 0.0), vec4(1.0, 1.0, 1.0, 1.0), gl_FragColor);
                              }`;

      var program = this.getShaderProgram (vertexShaderClouds, fragmentShaderClouds);

      this.gl.useProgram (program);

      this.setBuffer (program, "aPosition", [-1, -1,
                                             -1,  1,
                                              1, -1,
                                              1,  1]);

      this.uniformLocationT = this.gl.getUniformLocation (program, "t");
      this.uniformLocationWidth = this.gl.getUniformLocation (program, "width");
      this.uniformLocationHeight = this.gl.getUniformLocation (program, "height");
      var uniformLocationFrequency = this.gl.getUniformLocation (program, "frequency");
      var uniformLocationAmplitude = this.gl.getUniformLocation (program, "amplitude");
      var uniformLocationRateOfChange = this.gl.getUniformLocation (program, "rate_of_change");
      var uniformLocationRateOfChangeInverse = this.gl.getUniformLocation (program, "rate_of_change_inverse");

      var frequency = 1;
      var amplitude = 1;
      var rateOfChange = 2;

      this.gl.uniform1f (this.uniformLocationT, 0.0);
      this.gl.uniform1f (this.uniformLocationWidth, this.canvasClouds.width);
      this.gl.uniform1f (this.uniformLocationHeight, this.canvasClouds.height);
      this.gl.uniform1f (uniformLocationFrequency, frequency);
      this.gl.uniform1f (uniformLocationAmplitude, amplitude);
      this.gl.uniform1f (uniformLocationRateOfChange, rateOfChange);
      this.gl.uniform1f (uniformLocationRateOfChangeInverse, 1.0/rateOfChange);

      this.generatePermutationWebGL (program);

      this.gl.drawArrays (this.gl.TRIANGLE_STRIP, 0, 4);
      this.lastDrawTime = window.performance.now ();
   }

   getShaderProgram (vertexShaderSource, fragmentShaderSource) {
      const vertexShader = this.createShader (vertexShaderSource, this.gl.VERTEX_SHADER);
      const fragmentShader = this.createShader (fragmentShaderSource, this.gl.FRAGMENT_SHADER);

      const program = this.gl.createProgram ();
      this.gl.attachShader (program, vertexShader);
      this.gl.attachShader (program, fragmentShader);
      this.gl.linkProgram (program);

      if (!this.gl.getProgramParameter (program, this.gl.LINK_STATUS)) {
         var errorString = "Could not link the program: "+this.gl.getProgramInfoLog (program);
         throw new Error (errorString);
      }

      return program;
   }

   createShader (src, type) {
      const shader = this.gl.createShader (type);
      this.gl.shaderSource (shader, src);
      this.gl.compileShader (shader);
      if (!this.gl.getShaderParameter (shader, this.gl.COMPILE_STATUS)) {
         var errorString = "Could not compile the shader: "+this.gl.getShaderInfoLog (shader);
         this.gl.deleteShader (shader);
         throw new Error (errorString);
      }

      return shader;
   }

   setBuffer (program, attributeName, array) {
      this.gl.bindBuffer (this.gl.ARRAY_BUFFER, this.gl.createBuffer ());
      this.gl.bufferData (this.gl.ARRAY_BUFFER, new Float32Array (array), this.gl.STATIC_DRAW);
      var attrib = this.gl.getAttribLocation (program, attributeName);
      this.gl.vertexAttribPointer (attrib, 2, this.gl.FLOAT, false, 0, 0);
      this.gl.enableVertexAttribArray (attrib);
   }

   generatePermutation () {
      var prime = 257;
      var primitiveRoot = 171;
      var permutation = new Uint8Array (prime-1);

      var neutralElement = false;

      var x = 23;
      for (var i=0; i<permutation.length; i++) {
         x = primitiveRoot*x % prime;
         if (x==1) {
            if (neutralElement) {
               throw new Error ('The variable "primitiveRoot" is not a primitive root of "prime".');
            }
            neutralElement = true;
         }

         permutation[i] = x;
      }
      return permutation;
   }

   generatePermutationWebGL (program) {
      var texture = this.gl.createTexture ();
      this.gl.bindTexture (this.gl.TEXTURE_2D, texture);

      var permutation = this.generatePermutation ();

      var width = permutation.length;
      var height = 1;

      var permutationRGBA = new Uint8Array (4*permutation.length);
      var index = 0;
      for (var i=0; i<permutationRGBA.length; i+=4) {
         permutationRGBA[i] = permutation[index];   // red
         permutationRGBA[i+1] = 0; // green
         permutationRGBA[i+2] = 0; // blue
         permutationRGBA[i+3] = 255; // alpha
         index++;
      }

      this.gl.texImage2D (this.gl.TEXTURE_2D, 0, this.gl.RGBA,
                               width, height, 0, this.gl.RGBA, this.gl.UNSIGNED_BYTE,
                               permutationRGBA);

      if (!this._isPowerOf2 (permutation.length)) {
         throw new Error ('The length of the array "permutation" has to be a power of two.');
      }

      this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_MIN_FILTER, this.gl.NEAREST);
      this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_MAG_FILTER, this.gl.NEAREST);
      this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_WRAP_S, this.gl.CLAMP_TO_EDGE);
      this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_WRAP_T, this.gl.CLAMP_TO_EDGE);

      var uniformLocationPermutation = this.gl.getUniformLocation (program, "permutation");
      this.gl.activeTexture (this.gl.TEXTURE0);
      this.gl.bindTexture (this.gl.TEXTURE_2D, texture);
      this.gl.uniform1i (uniformLocationPermutation, 0);
   }

   linearInterpolation (start, end, x) {
      if (x<0) {
         return start;
      }
      else if (x>1) {
         return end;
      }
      return start*(1-x)+end*x;
   }

   setDirectionalLightValues () {
      this.directionalLight.intensity = this.linearInterpolation (0.0, 2.0, (this.directionalLight.position.y+1000)/this.twilightEnd);
      var colorValue = this.linearInterpolation (0.0, 1.0, (this.directionalLight.position.y+250)/this.twilightEnd);
      this.directionalLight.color = new THREE.Color (1.0, colorValue, colorValue);
   }

   setSunPosition (x, y, z, renderer) {
      this.directionalLight.position.set (x, y, z);
      this.setDirectionalLightValues ();
      this.ambientLight.color = this.directionalLight.color;

      if (scene.fog) {
         // adjust the color of the fog depending on the position of the sun
         if (y>=this.twilightEnd) {
            if (this.fogColor) {
               scene.fog.color = this.fogColor;
            }
         }
         else {
            this.fogColor = scene.fog.color;
            scene.fog.color = new THREE.Color(0x232345);
         }
      }
   }

   _isPowerOf2 (x) {
      return (x & (x-1))==0;
   }

   generateClouds () {
   }
}

export default SkySphere;