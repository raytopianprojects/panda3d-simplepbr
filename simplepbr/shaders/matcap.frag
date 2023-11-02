#version 120

#ifndef MAX_LIGHTS
    #define MAX_LIGHTS 8
#endif

#ifdef USE_330
    #define texture2D texture
#endif

uniform sampler2D p3d_TextureBaseColor;
varying vec3 v_position;
varying vec2 v_texcoord;
varying vec4 v_color;
#ifdef ENABLE_SHADOWS
varying vec4 v_shadow_pos[MAX_LIGHTS];
#endif

void main(){
  color = texture2D(p3d_TextureBaseColor, v_texcoord);
  
  #ifdef ENABLE_FOG
    // Exponential fog
    float fog_distance = length(v_position);
    float fog_factor = clamp(1.0 / exp(fog_distance * p3d_Fog.density), 0.0, 1.0);
    color = mix(p3d_Fog.color, color, fog_factor);
#endif

  #ifdef USE_330
      o_color = color;
  #else
      gl_FragColor = color;
  #endif
}
