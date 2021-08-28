/*
 * Copyright (c) 2021 Antonio-R1
 * License: https://github.com/Antonio-R1/racing-js/LICENSE | GNU AGPLv3
 */

import * as THREE from './three_js/build/three.module.js';
import ConvolutionWebAssembly from './convolution/convolution.js';
import {Array2d, Convolution} from './convolution.js';

class Terrain {

   constructor (width, height, width_segments, height_segments,
                additional_segments, terrain_start, terrain_start_position,
                coarse_map_min_altitude, max_altitude, has_runway, activate_coarse_fine_height_map) {

      this.ground = null;
      this.width = width;
      this.height = height;
      this.width_segments = width_segments;
      this.height_segments = height_segments;
      this.additional_segments = additional_segments;
      this.terrain_start = terrain_start;
      this.terrain_start_position = terrain_start_position;
      this.coarse_map_min_altitude = coarse_map_min_altitude;
      this.coarse_map_divisor = null;
      this.coarse_height = null;
      this.coarse_width = null;
      this.coarse_map_start_row = null;
      this.coarse_map_start_col = null;
      this.max_altitude = max_altitude;
      this.has_runway = has_runway;
      this.activate_coarse_fine_height_map = activate_coarse_fine_height_map;
      this.scale_x = null;
      this.scale_y = null;
   }

   createHeightMap () {
      if (!this.activate_coarse_fine_height_map) {
         this.runway_altitude = 0;
         this.create_terrain (this.width, this.height);
         return;
      }

      var Module = ConvolutionWebAssembly.Module;
      var conv2 = Module.cwrap("conv2", "number", ["array", "number", "number",
                               "array", "number", "number"]);
      this.conv2 = function (image, kernel) {
         var image_ptr = conv2 (new Uint8Array (kernel.array.buffer), kernel.rows, kernel.cols,
                       new Uint8Array (image.array.buffer), image.rows, image.cols);
         image.array = Float64Array.from (Module.HEAPF64.slice(image_ptr/8, image_ptr/8+image.array.length));
         return image;
      }

      this.runway_altitude = 750;

      this.create_terrain_coarse_fine_height_map ();
   }

   createGeometry (row, col, width_vertices, height_vertices) {

      var i = 0;
      var j = 0;
      var k = 0;

      var width = this.width;
      var height = this.height;
      if (!width_vertices || !height_vertices) {
         width_vertices = this.width_segments-1;
         height_vertices = this.height_segments-1;
      }
      else {
         width = width_vertices/(this.width_segments-1);
         height = height_vertices/(this.height_segments-1);
         i = row;
         j = col;
         k = row*(this.width_segments-1)+col;
      }

      var ground_geometry = new THREE.PlaneBufferGeometry (width, height, width_vertices, height_vertices);

      var runway_start = Math.floor (height_vertices/2-2000/this.height*height_vertices);
      var runway_end = Math.ceil (height_vertices/2+2000/this.height*height_vertices);
      var runway_left = Math.floor (width_vertices/2-250/this.width*width_vertices);
      var runway_right = Math.ceil (width_vertices/2+250/this.width*width_vertices);
      var ground_geometry_positions = ground_geometry.getAttribute ("position");

      for (k=0; k<ground_geometry_positions.count; k++) {

         if (this.has_runway &&
             i >= runway_start && i <= runway_end && j >= runway_left && j <= runway_right) {

            ground_geometry_positions.setZ(k, this.runway_altitude);
            this.fine_height_map.set(i+this.scale_y, j+this.scale_x, this.runway_altitude);
            j++;
            if (j > width_vertices) {
               i++;
               j = 0;
            }
            continue;
         }
         this.height = this.fine_height_map.get(i+this.scale_y, j+this.scale_x);

         ground_geometry_positions.setZ(k, this.height);

         j++;
         if (j > width_vertices) {
            i++;
            j = 0;
         }
      }

      ground_geometry_positions.needsUpdate = true;

      ground_geometry.setAttribute ("color",
               new THREE.Float32BufferAttribute (ground_geometry_positions.count*3, 3));
      var ground_geometry_colors = ground_geometry.getAttribute ("color");

      for (i=0; i<ground_geometry_colors.count; i++) {

         var height = ground_geometry_positions.getZ(i);
         if (height > 1500) {
            ground_geometry_colors.array[i*3] = 1;
            ground_geometry_colors.array[i*3+1] = 1;
            ground_geometry_colors.array[i*3+2] = 1;
         }
         else if (height > 1000) {
            var value = 0.2+0.1*Math.random ();
            ground_geometry_colors.array[i*3] = value;
            ground_geometry_colors.array[i*3+1] = value;
            ground_geometry_colors.array[i*3+2] = value;
         }
         else if (height > 750) {
            ground_geometry_colors.array[i*3] = 0;
            ground_geometry_colors.array[i*3+1] = 0.25+0.1*Math.random ();
            ground_geometry_colors.array[i*3+2] = 0;
         }
         else {
            ground_geometry_colors.array[i*3] = 0;
            ground_geometry_colors.array[i*3+1] = 0.2+0.1*Math.random ();
            ground_geometry_colors.array[i*3+2] = 0;
         }
      }

      ground_geometry.verticesNeedUpdate = true;
      ground_geometry.colorsNeedUpdate = true;
      ground_geometry.normalsNeedUpdate = true;
      ground_geometry.computeVertexNormals ();
      this.ground_geometry = ground_geometry;
   }

   createGround () {
      var ground_material = new THREE.MeshPhongMaterial ({vertexColors: true});
      this.ground = new THREE.Mesh (this.ground_geometry, ground_material);
   }

   getRandomNumberStandardNormalDistribution () {
      let u_0 = 0;
      let u_1 = 0;

      while (u_0==0) {
         u_0 = Math.random ();
      }

      while (u_1==0) {
         u_1 = Math.random ();
      }

      return Math.sqrt (-2*Math.log (u_0))*Math.cos (2*Math.PI*u_1);
   }

   getRandomInteger (min, max) {
      return Math.floor ((max-min)*Math.random ())+min;
   }

   drawHeightMap () {
      var canvas = document.getElementById ("canvas_height_map");
      canvas.style.display = "block";

      var map_height = this.fine_height_map.rows-2*this.scale_y;
      var map_width = this.fine_height_map.cols-2*this.scale_x;

      canvas.style.height = "256px";
      canvas.style.width = "256px";
      canvas.height = map_height;
      canvas.width = map_width;

      var context = canvas.getContext ("2d");
      context.fillStyle = "black";
      context.fillRect (0, 0, canvas.width, canvas.height);

      var image_data = context.getImageData (0, 0, canvas.width, canvas.height);

      var width = 4*image_data.width;

      var map_min_value=1000;
      var map_max_value=-1;

      for (var y=0; y<map_height; y++) {
         for (var x=0; x<map_width; x++) {
            var value = this.fine_height_map.get(y+this.scale_y, x+this.scale_x);
            if (value < map_min_value) {
               map_min_value = value;
            }

            if (value > map_max_value) {
               map_max_value = value;
            }
         }
      }

      var scale = 1/(map_max_value-map_min_value)*255;

      for (y=0; y<map_height; y++) {
         for (x=0; x<map_width; x++) {
            var value = Math.round(scale*(this.fine_height_map.get (y+this.scale_y, x+this.scale_x)-map_min_value));
            var y_image = map_height-y-1;
            var x_image = map_width-x-1;
            var pixel_offset = y_image*width+4*x_image;
            image_data.data[pixel_offset] = value;   // red
            image_data.data[pixel_offset+1] = value; // green
            image_data.data[pixel_offset+2] = value; // blue
//            image_data.data[pixel_offset+3] = 0xff; // alpha
         }
      }

      context.putImageData (image_data, 0, 0);
   }

   /*
    * creates a coarse height map with its values set
    * to the chosen values of "terrain_start" by "terrain_start_position",
    * and the other values set to "this.max_altitude"
    */
   createCoarseHeightMap () {
      var width = this.width;
      var height = this.height;
      var width_segments = this.width_segments;
      var height_segments = this.height_segments;

      var additional_segments = this.additional_segments;
      var terrain_start = this.terrain_start;
      var terrain_start_position = this.terrain_start_position;
      var coarse_map_min_altitude = this.coarse_map_min_altitude;
      var max_altitude = this.max_altitude;

      this.coarse_map_divisor = 16;
      if (width_segments < 256 && height_segments < 256) {
         this.coarse_map_divisor = 8;
      }
      var coarse_map_divisor = this.coarse_map_divisor;

      this.coarse_width = Math.ceil(width_segments/coarse_map_divisor)+2*additional_segments;
      this.coarse_height = Math.ceil(height_segments/coarse_map_divisor)+2*additional_segments;

      this.coarse_map_start_row = additional_segments;
      this.coarse_map_start_col = additional_segments;

      this.additional_segments = additional_segments;
      // We use 3x3 kernels for the convolution and we want to discard the border
      // after convolution was performed, so we increase the width and
      // the height by two.
      var coarse_height_map = new Array2d (this.coarse_height+2, this.coarse_width+2);
      this.coarse_height_map = coarse_height_map;

      if (terrain_start) {
         if (terrain_start_position==="top") {
            if (terrain_start.coarse_height_map.cols != this.coarse_width+2) {
               throw new Error ("\"terrain_start\" with the position "+terrain_start_position+" needs to have same width as the current terrain.");
            }

            for (let i=additional_segments+1; i<coarse_height_map.rows; i++) {
               for (let j=0; j<coarse_height_map.cols; j++) {
                  coarse_height_map.set(i, j, coarse_map_min_altitude);
               }
            }

            for (let i=0; i<additional_segments+1; i++) {
               for (let j=0; j<coarse_height_map.cols; j++) {
                  coarse_height_map.set(i, j,
                      terrain_start.coarse_height_map.get (terrain_start.coarse_height_map.rows-additional_segments-1+i, j));
               }
            }
         }
         else if (terrain_start_position==="bottom") {
            if (terrain_start.coarse_height_map.cols != this.coarse_width+2) {
               throw new Error ("\"terrain_start\" with the position "+terrain_start_position+" needs to have same width as the current terrain.");
            }

            for (let i=0; i<additional_segments+1; i++) {
               for (let j=0; j<coarse_height_map.cols; j++) {
                  coarse_height_map.set(i, j, coarse_map_min_altitude);
               }
            }

            for (let i=0; i<additional_segments+1; i++) {
               for (let j=0; j<coarse_height_map.cols; j++) {
                  coarse_height_map.set(terrain_start.coarse_height_map.rows-additional_segments-1+i, j,
                      terrain_start.coarse_height_map.get (i, j));
               }
            }

            this.coarse_map_start_row = additional_segments;
         }
      }
      else {
         for (var i=0; i<coarse_height_map.array.length; i++) {
            coarse_height_map.array[i] = coarse_map_min_altitude;
         }
      }
   }

   create_terrain_coarse_fine_height_map () {
      var width = this.width;
      var height = this.height;
      var width_segments = this.width_segments;
      var height_segments = this.height_segments;

      if (width_segments%16!=0 || height_segments%16!=0) {
         throw new Error ("\"width_segments\" and \"heights_segments\" have to be a multiple of 16.");
      }

      var additional_segments = this.additional_segments;
      var terrain_start = this.terrain_start;
      var terrain_start_position = this.terrain_start_position;
      var coarse_map_min_altitude = this.coarse_map_min_altitude;
      var max_altitude = this.max_altitude;

      this.createCoarseHeightMap();
      var coarse_height_map = this.coarse_height_map;

      var coarse_map_divisor = this.coarse_map_divisor;
      var coarse_width = this.coarse_width;
      var coarse_height = this.coarse_height;

      var hills = this.getRandomInteger (coarse_height*coarse_width/2, 2*coarse_height*coarse_width);

      var x = Math.floor (coarse_width/2);
      var y = Math.floor (coarse_height/2);

      for (var i=0; i<hills; i++) {
         x = x+Math.round ((coarse_height+2)/2*this.getRandomNumberStandardNormalDistribution ());
         y = y+Math.round ((coarse_width+2)/2*this.getRandomNumberStandardNormalDistribution ());

         x = x%(coarse_width+2);
         y = y%(coarse_height+2);

         if (x < 0) {
            x = x+coarse_width+2;
         }

         if (y < 0) {
            y = y+coarse_height+2;
         }

         var hill_height = this.getRandomInteger (coarse_map_min_altitude, coarse_map_min_altitude+250);
         if (coarse_height_map.get(y, x) < hill_height) {
            coarse_height_map.set(y, x, hill_height);
         }
      }

      var kernel = new Array2d (3, 3, [1,2,1,
                                       2,3,2,
                                       1,2,1]);

      kernel.normalizeElementwiseSum ();
//      Convolution.conv (coarse_height_map, coarse_height_map, kernel);
      coarse_height_map = this.conv2 (coarse_height_map, kernel);
      var y_offset = this.additional_segments;

      var mountains = this.getRandomInteger (10, 20);
      x = Math.floor (coarse_width/2);
      y = Math.floor (coarse_height/2);
      for (var i=0; i<mountains; i++) {
         x = x+Math.round ((coarse_width+2)/8*this.getRandomNumberStandardNormalDistribution ());
         y = y+Math.round ((coarse_height+2)/8*this.getRandomNumberStandardNormalDistribution ());

         x = x%(coarse_width+2);
         y = y%(coarse_height-y_offset+2)+y_offset;

         if (x < 0) {
            x = x+coarse_width+2;
         }

         if (y < 0) {
            y = y+coarse_height+2;
         }

         var mountain_height = this.getRandomInteger (750, max_altitude);
         coarse_height_map.set(y, x, mountain_height);

         hills = this.getRandomInteger (20, 45);
         var max_hill_height = Math.round (mountain_height*2/3);
         for (var j=0; j<hills; j++) {
            var x_hill = x+Math.round ((coarse_width+2)/16*this.getRandomNumberStandardNormalDistribution ());
            var y_hill = y+Math.round ((coarse_height+2)/16*this.getRandomNumberStandardNormalDistribution ());

            if (x_hill < 0) {
               x_hill = x_hill+coarse_width+2;
            }

            if (y_hill < 0) {
               y_hill = y_hill+coarse_height+2;
            }

            if (x_hill >= 0 && x_hill < coarse_width+2 && y_hill>=0 && y_hill < coarse_height+2) {
               var hill_height = this.getRandomInteger (250, max_hill_height);
               if (coarse_height_map.get(y_hill, x_hill) < hill_height) {
                  coarse_height_map.set(y_hill, x_hill, hill_height);
               }
            }
         }
      }

      if (this.has_runway) {
         var coarse_segment_height_ratio = (coarse_height-additional_segments)/height;
         var coarse_segment_width_ratio = coarse_width/width;
         var y_start = Math.round((coarse_height-additional_segments+1)/2-2750*coarse_segment_height_ratio);
         var y_max = Math.round((coarse_height-additional_segments+1)/2+2750*coarse_segment_height_ratio);
         var x_start = Math.round((coarse_width+1)/2-250*coarse_segment_width_ratio);
         var x_max = Math.round((coarse_width+1)/2+250*coarse_segment_width_ratio);

         for (var i=y_start; i<=y_max; i++) {
            for (var j=x_start; j<=x_max; j++) {
               if (coarse_height_map.get (i, j) < this.runway_altitude) {
                  this.runway_altitude = coarse_height_map.get (i, j);
               }
            }
         }
         for (i=y_start; i<=y_max; i++) {
            for (j=x_start; j<=x_max; j++) {
               coarse_height_map.set (i, j, this.runway_altitude);
            }
         }
      }

      var fine_height_map_height = height_segments+2*this.coarse_map_divisor;
      var fine_height_map_width = width_segments+2*this.coarse_map_divisor;
      var coarse_max_height = Math.ceil(height_segments/coarse_map_divisor);
      var coarse_max_width = Math.ceil(width_segments/coarse_map_divisor);
      this.scale_x = Math.round (fine_height_map_width/(coarse_max_width+2));
      this.scale_y = Math.round (fine_height_map_height/(coarse_max_height+2));
      fine_height_map_height = this.scale_y*(coarse_max_height+2);
      fine_height_map_width = this.scale_x*(coarse_max_width+2);
      this.fine_height_map_height = fine_height_map_height;
      this.fine_height_map_width = fine_height_map_width;
      var fine_height_map = new Array2d (fine_height_map_height, fine_height_map_width);

      coarse_max_height += this.coarse_map_start_row;
      coarse_max_width += this.coarse_map_start_col;

      for (i=this.coarse_map_start_row; i<coarse_max_height+2; i++) {
         for (j=this.coarse_map_start_col; j<coarse_max_width+2; j++) {
            var value = coarse_height_map.get(i, j);
            for (var i1=0; i1<this.scale_y; i1++) {
               for (var j1=0; j1<this.scale_x; j1++) {
                  var y = (i-this.coarse_map_start_row)*this.scale_y+i1;
                  var x = (j-this.coarse_map_start_col)*this.scale_x+j1;
                  fine_height_map.set(y, x, value);
               }
            }
         }
      }

      var kernel_value = this.width_segments/256*this.height_segments/256;
      var kernel1 = new Array2d (3, 3, [0,kernel_value,0,
                                        0,1,0,
                                        0,kernel_value,0]);
      kernel1.normalizeElementwiseSum ();

      var kernel2 = new Array2d (3, 3, [0,0,0,
                                        kernel_value,1,kernel_value,
                                        0,0,0]);
      kernel2.normalizeElementwiseSum ();
      var iterations;
      if (this.width_segments>=128) {
         iterations = Math.round (100*this.width_segments/256);
      }
      else {
         iterations = 50;
      }
      for (i=0; i<iterations; i++) {
         for (j=0; j<fine_height_map_height; j++) {
            for (var k=0; k<fine_height_map_width; k++) {
//               fine_height_map.set(j, k, fine_height_map.get(j, k)*(1+0.1*this.getRandomNumberStandardNormalDistribution()));
               fine_height_map.set(j, k, fine_height_map.get(j, k)*(1+0.1*(2*Math.random ()-1)));
            }
         }

         if (Math.random () < 0.5) {
            kernel = kernel1;
         }
         else {
            kernel = kernel2;
         }

//         fine_height_map = Convolution.conv (fine_height_map, fine_height_map, kernel);
         fine_height_map = this.conv2 (fine_height_map, kernel);

         if (this.terrain_start) {
            if (this.terrain_start_position=="top") {
               for (var j=0; j<fine_height_map_width; j++) {
                  fine_height_map.set (this.scale_y, j, this.terrain_start.fine_height_map.get (fine_height_map_height-
                                                           this.scale_y-1, j));
               }
            }
         }
      }

      kernel = new Array2d (3, 3, [1, 1, 1,
                                   1, 2, 1,
                                   1, 1, 1]);
      kernel.normalizeElementwiseSum ();

//      this.fine_height_map = Convolution.conv (fine_height_map, fine_height_map, kernel);
      this.fine_height_map = this.conv2 (fine_height_map, kernel);

      if (this.terrain_start) {
         if (this.terrain_start_position=="top") {
            for (var j=0; j<fine_height_map_width; j++) {
               fine_height_map.set (this.scale_y, j, this.terrain_start.fine_height_map.get (fine_height_map_height-
                                                          this.scale_y-1, j));
            }
         }
      }
   }

   create_terrain (width, height) {

      let width_vertices = 150;
      let height_vertices = 150;

      let ground_geometry = new THREE.PlaneGeometry (width, height, width_vertices, height_vertices);

      let runway_start = Math.floor (height_vertices/2-1000/height*height_vertices);
      let runway_end = Math.ceil (height_vertices/2+2000/height*height_vertices);
      let runway_left = Math.floor (width_vertices/2-75/width*height_vertices);
      let runway_right = Math.ceil (width_vertices/2+75/width*height_vertices);
      let i = 0;
      let j = 0;

      for (let k=0; k<ground_geometry.vertices.length; k++) {

         if (i > runway_start && i < runway_end && j > runway_left && j < runway_right) {
            j++;
            if (j > width_vertices) {
               i++;
               j = 0;
            }
            continue;
         }

         let height = 0;
         if (i > 0) {
            if (j > 0) {
               height = (ground_geometry.vertices[k-width_vertices].z+ground_geometry.vertices[k-1].z)/2;
            }
            else {
               height = ground_geometry.vertices[k-width_vertices].z;
            }
         }

         if (Math.random () > 0.85) {
            ground_geometry.vertices[k].z = height + 2*Math.random ()*100-100;
         }
         else {
            ground_geometry.vertices[k].z = height + 2*Math.random ()*50-50;
         }

         if (ground_geometry.vertices[k].z<0) {
            ground_geometry.vertices[k].z = 0;
         }

         j++;
         if (j > width_vertices) {
            i++;
            j = 0;
         }
      }

      for (let i=0; i<ground_geometry.faces.length; i++) {
         let f = ground_geometry.faces[i];
         let a = ground_geometry.vertices[f.a];
         let b = ground_geometry.vertices[f.b];
         let c = ground_geometry.vertices[f.c];
         let max_height = Math.max (a.z, Math.max (b.z, c.z));

         if (max_height > 1500) {
            f.color.set (0xffffff);
         }
         else if (max_height > 1000) {
            f.color.set (0x454545);
         }
         else {
            f.color.set (0x004500);
         }
      }

      ground_geometry.verticesNeedUpdate = true;
      ground_geometry.colorsNeedUpdate = true;
      ground_geometry.normalsNeedUpdate = true;
      ground_geometry.computeVertexNormals ();

      let ground_material = new THREE.MeshPhongMaterial ({vertexColors: true});

      this.ground = new THREE.Mesh (ground_geometry, ground_material);

   }
}

export default Terrain;