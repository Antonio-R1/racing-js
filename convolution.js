/*
 * Copyright (c) 2021-2022 Antonio-R1
 * License: https://github.com/Antonio-R1/racing-js/blob/main/LICENSE | GNU AGPLv3
 */

class Convolution {

   static createArray2d (rows, cols) {
      let array = new Array (rows);

      for (let i=0; i<rows; i++) {
         array[i] = new Float64Array (cols);
         for (let j=0; j<cols; j++) {
            array[i][j] = 0;
         }
      }

      return array;
   }

   static arrayNormalizeElementwiseSum (array) {

      var rows = array.length;
      var cols = array[0].length;

      var sum = 0;
      for (var i=0; i<rows; i++) {
         for (var j=0; j<cols; j++) {
            sum +=  array[i][j];
         }
      }

      for (i=0; i<rows; i++) {
         for (j=0; j<cols; j++) {
            array[i][j] = array[i][j]/sum;
         }
      }
   }

   static createArrayRgb (rows, cols) {
      let array = new Array (rows);

      for (let i=0; i<rows; i++) {
         array[i] = new Array (cols);
         for (let j=0; j<cols; j++) {
            array[i][j] = new Array (3);
            array[i][j][0] = 0;
            array[i][j][1] = 0;
            array[i][j][2] = 0;
         }
      }

      return array;
   }

   /*
    * returns the 2d convolution of "image" for all three colors and "kernel"
    * image and kernel: 3d arrays of numbers
    */
   static convRgb (image, kernel) {
      let image_cols = image.length;
      let image_rows = image[0].length;

      let kernel_cols = kernel.length;
      let kernel_rows = kernel[0].length;

      if (kernel_cols % 2 == 0 || kernel_rows % 2 == 0) {
         throw new Error ("The size of the kernel has to be odd.");
      }

      let x_start = Math.floor (kernel_cols/2);
      let y_start = Math.floor (kernel_rows/2);

      let image_resized = Convolution.createArrayRgb (image_rows+2*y_start, image_cols+2*x_start);
      let image_conv = Convolution.createArrayRgb (image_rows+2*y_start, image_cols+2*x_start);

      for (let x=0; x<image_cols; x++) {
         for (let y=0; y<image_rows; y++) {
            image_resized[x+x_start][y+y_start][0] = image[x][y][0];
            image_resized[x+x_start][y+y_start][1] = image[x][y][1];
            image_resized[x+x_start][y+y_start][2] = image[x][y][2];
         }
      }

      for (let x=0; x<image_cols; x++) {
         for (let y=0; y<image_rows; y++) {

            for (let i=0; i<kernel_cols; i++) {
               for (let j=0; j<kernel_rows; j++) {
                  image_conv[x+x_start][y+y_start][0] += kernel[kernel_cols-i-1][kernel_rows-j-1]*image_resized[x+i][y+j][0];
                  image_conv[x+x_start][y+y_start][1] += kernel[kernel_cols-i-1][kernel_rows-j-1]*image_resized[x+i][y+j][1];
                  image_conv[x+x_start][y+y_start][2] += kernel[kernel_cols-i-1][kernel_rows-j-1]*image_resized[x+i][y+j][2];
               }
            }
         }
      }

      let image_conv_resized = Convolution.createArrayRgb (image_rows, image_cols);

      for (let x=0; x<image_cols; x++) {
         for (let y=0; y<image_rows; y++) {
            image_conv_resized[x][y][0] = image_conv[x+x_start][y+y_start][0];
            image_conv_resized[x][y][1] = image_conv[x+x_start][y+y_start][1];
            image_conv_resized[x][y][2] = image_conv[x+x_start][y+y_start][2];
         }
      }

      return image_conv_resized;
   }

   static convCopy (image, kernel) {
      return Convolution.convArray (image, Convolution.createArray2d (image.length, image[0].length), kernel);
   }

   /*
    * returns the 2d convolution of "image" and "kernel"
    * image and kernel: 2d arrays of numbers
    */
   static convArray (image_src, image_dst, kernel) {
      let image_cols = image_src.length;
      let image_rows = image_src[0].length;

      let kernel_cols = kernel.length;
      let kernel_rows = kernel[0].length;

      if (kernel_cols % 2 == 0 || kernel_rows % 2 == 0) {
         throw new Error ("The size of the kernel has to be odd.");
      }

      let x_start = Math.floor (kernel_cols/2);
      let y_start = Math.floor (kernel_rows/2);

      let image_resized = Convolution.createArray2d (image_rows+2*y_start, image_cols+2*x_start);
      let image_conv = Convolution.createArray2d (image_rows+2*y_start, image_cols+2*x_start);

      for (let x=0; x<image_cols; x++) {
         for (let y=0; y<image_rows; y++) {
            image_resized[x+x_start][y+y_start] = image_src[x][y];
         }
      }

      for (let x=0; x<image_rows; x++) {
         for (let y=0; y<image_cols; y++) {

            for (let i=0; i<kernel_rows; i++) {
               for (let j=0; j<kernel_cols; j++) {
                  image_conv[x+x_start][y+y_start] += kernel[i][j]*image_resized[x+i][y+j];
               }
            }
         }
      }

      for (let x=0; x<image_cols; x++) {
         for (let y=0; y<image_rows; y++) {
            image_dst[x][y] = image_conv[x+x_start][y+y_start];
         }
      }

      return image_dst;
   }

   /*
    * returns the 2d convolution of "image" and "kernel"
    * image and kernel: Array2d
    */
   static conv (image_src, image_dst, kernel) {
      var image_cols = image_src.cols;
      var image_rows = image_src.rows;

      var kernel_cols = kernel.cols;
      var kernel_rows = kernel.rows;

      if (kernel_cols % 2 == 0 || kernel_rows % 2 == 0) {
         throw new Error ("The size of the kernel has to be odd.");
      }

      var x_start = Math.floor (kernel_cols/2);
      var y_start = Math.floor (kernel_rows/2);

      var image_resized = new Array2d (image_rows+2*y_start, image_cols+2*x_start);
      var image_conv = new Array2d (image_rows+2*y_start, image_cols+2*x_start);

      for (var y=0; y<image_rows; y++) {
         for (var x=0; x<image_cols; x++) {
            image_resized.set(y+y_start, x+x_start, image_src.get(y, x));
         }
      }

      for (y=0; y<image_rows; y++) {
         for (x=0; x<image_cols; x++) {

            for (var i=0; i<kernel_rows; i++) {
               for (var j=0; j<kernel_cols; j++) {
                  image_conv.set(y+y_start, x+x_start, image_conv.get (y+y_start, x+x_start)+
                                                       kernel.get(i, j)*image_resized.get(y+i, x+j));
               }
            }
         }
      }

      for (y=0; y<image_rows; y++) {
         for (x=0; x<image_cols; x++) {
            image_dst.set (y, x, image_conv.get (y+y_start, x+x_start));
         }
      }

      return image_dst;
   }

}

class Array2d {
   constructor (rows, cols, array, set_array) {
      this.rows = rows;
      this.cols = cols;
      if (set_array) {
         this.array = array;
         return;
      }
      this.array = new Float64Array (rows*cols);
      if (array === undefined) {
         return;
      }

      for (let i=0; i<rows*cols; i++) {
         this.array[i] = array[i];
      }
   }

   normalizeElementwiseSum () {
      let sum = 0;
      for (let i=0; i<this.array.length; i++) {
            sum +=  this.array[i];
      }

      for (let i=0; i<this.array.length; i++) {
            this.array[i] = this.array[i]/sum;
      }
   }

   get (row, col) {
      return this.array[row*this.cols+col];
   }

   set (row, col, value) {
      this.array[row*this.cols+col] = value;
   }
}

export {Array2d, Convolution};