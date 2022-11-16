/*
 * Copyright (c) 2021-2022 Antonio-R1
 * License: https://github.com/Antonio-R1/racing-js/LICENSE | GNU AGPLv3
 */

import * as THREE from './three_js/build/three.module.js';
import Terrain from './terrain.js';
import ConvolutionWebAssembly from './convolution/convolution.js';

var cache = {};
var width;
var height;
var width_segments;
var height_segments;
var additional_segments;

async function create_terrain (event) {

   var values = event.data;

   var position_x = Math.round (values.position_x/width)*width;
   var position_y = Math.round (values.position_y/height)*height;

   var terrain = cache[position_y+" "+position_x];

   if (!terrain) {
      await ConvolutionWebAssembly.init ();

      let terrain_top = cache[(position_y-height)+" "+position_x];
      let terrain_bottom = cache[(position_y+height)+" "+position_x];

      let terrain_start;
      let terrain_start_position = null;
      if (terrain_top) {
         terrain_start = terrain_top;
         terrain_start_position = "top";
      }
      else if (terrain_bottom) {
         terrain_start = terrain_bottom;
         terrain_start_position = "bottom";
      }

      terrain = new Terrain (width, height,
                             width_segments, height_segments,
                             additional_segments, terrain_start, terrain_start_position,
                             values.min_altitude, values.max_altitude,
                             values.runway, true);
      cache[position_y+" "+position_x] = terrain;
      terrain.createHeightMap ();
      terrain.createGeometry ();
   }

   let vertex_position = terrain.ground_geometry.getAttribute ("position").array.buffer;
   let vertex_color = terrain.ground_geometry.getAttribute ("color").array.buffer;
   let normal = terrain.ground_geometry.getAttribute ("normal").array.buffer;
   let uv = terrain.ground_geometry.getAttribute ("uv").array.buffer;
   let geometry_index = terrain.ground_geometry.index.array.buffer;

   if (!values.runway) {
      terrain.runway_altitude = undefined;
   }

   postMessage ({width: width, height: height, width_segments: width_segments, height_segments: height_segments,
                 fine_height_map_array: terrain.fine_height_map.array,
                 fine_height_map_height: terrain.fine_height_map_height,
                 fine_height_map_width: terrain.fine_height_map_width,
                 scale_x: terrain.scale_x, scale_y: terrain.scale_y,
                 coarse_map_divisor: terrain.coarse_map_divisor,
                 runway_altitude: terrain.runway_altitude,
                 min_altitude: values.min_altitude,
                 vertex_position: vertex_position, vertex_color: vertex_color,
                 normal: normal, uv: uv,
                 geometry_index: geometry_index,
                 position_x: position_x, position_y: position_y});
}

onmessage = function (event) {
   let values = event.data;
   width = values.width;
   height = values.height;
   width_segments = values.width_segments;
   height_segments = values.height_segments;
   additional_segments = values.additional_segments;
   onmessage = create_terrain;
}