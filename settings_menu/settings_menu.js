
function showSettingsMenu () {
   var divSettingsMenu = document.getElementById("div_settings_menu");
   let canvas = document.getElementById ("canvas_plane");
   divSettingsMenu.style.display = "block";
   paused = true;
   dialogShown = true;
   canvas.blur();
}

function settingsMenuClose () {
   var divSettingsMenu = document.getElementById("div_settings_menu");
   divSettingsMenu.style.display = "none";
   dialogShown = false;
   let canvas = document.getElementById ("canvas_plane");
   canvas.focus();
}

function setThrottleFps(input) {
   if (input.value==="30fps") {
      throttleFps = true;
      return;
   }
   else if (input.value==="off") {
      throttleFps = false;
      return;
   }

   throw new Error("invalid value \""+input.value+"\"");
}

function setRenderForests (value) {
   game1_renderForests = value;
}
