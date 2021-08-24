Module["locateFile"] = function (path, prefix) {
   return "/convolution/"+path;
}

Module["onRuntimeInitialized"] = function () {
   convolution_module_web_assembly_initialized = true;
}