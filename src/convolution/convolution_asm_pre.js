
Module["locateFile"] = function (path, prefix) {
   return "/convolution/"+path;
}

Module["onRuntimeInitialized"] = function () {
   convolution_module_asm_initialized = true;
}