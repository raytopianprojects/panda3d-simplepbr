// Based on code from https://github.com/KhronosGroup/glTF-Sample-Viewer

#version 120

#ifndef MAX_LIGHTS
    #define MAX_LIGHTS 8
#endif

#ifdef USE_330
    #define texture2D texture
#endif

uniform struct p3d_MaterialParameters {
    vec4 baseColor;
    vec4 emission;
    float roughness;
    float metallic;
} p3d_Material;

uniform struct p3d_LightSourceParameters {
    vec4 position;
    vec4 diffuse;
    vec4 specular;
    vec3 attenuation;
    vec3 spotDirection;
    float spotCosCutoff;
#ifdef ENABLE_SHADOWS
    sampler2DShadow shadowMap;
    mat4 shadowViewMatrix;
#endif
} p3d_LightSource[MAX_LIGHTS];

uniform struct p3d_LightModelParameters {
    vec4 ambient;
} p3d_LightModel;

#ifdef ENABLE_FOG
uniform struct p3d_FogParameters {
    vec4 color;
    float density;
} p3d_Fog;
#endif

uniform vec4 p3d_ColorScale;
uniform vec4 p3d_TexAlphaOnly;

struct FunctionParamters {
    float n_dot_l;
    float n_dot_v;
    float n_dot_h;
    float l_dot_h;
    float v_dot_h;
    float roughness;
    float metallic;
    vec3 reflection0;
    vec3 base_color;
    vec3 specular_color;
float ax;
float ay;
    
};

uniform sampler2D p3d_TextureBaseColor;
uniform sampler2D p3d_TextureMetalRoughness;
uniform sampler2D p3d_TextureNormal;
uniform sampler2D p3d_TextureEmission;

const vec3 F0 = vec3(0.04);
const float PI = 3.141592653589793;
const float SPOTSMOOTH = 0.001;
const float LIGHT_CUTOFF = 0.001;

varying vec3 v_position;
varying vec4 v_color;
varying vec2 v_texcoord;
varying mat3 v_tbn;
#ifdef ENABLE_SHADOWS
varying vec4 v_shadow_pos[MAX_LIGHTS];
#endif

#ifdef USE_330
out vec4 o_color;
#endif

// Schlick's Fresnel approximation with Spherical Gaussian approximation to replace the power
vec3 specular_reflection(FunctionParamters func_params) {
    vec3 f0 = func_params.reflection0;
    float v_dot_h= func_params.v_dot_h;
    return f0 + (vec3(1.0) - f0) * pow(2.0, (-5.55473 * v_dot_h - 6.98316) * v_dot_h);
}

// Smith GGX with optional fast sqrt approximation (see https://google.github.io/filament/Filament.md.html#materialsystem/specularbrdf/geometricshadowing(specularg))
float visibility_occlusion(FunctionParamters func_params) {
    float r = func_params.roughness;
    float r2 = r * r;
    float n_dot_l = func_params.n_dot_l;
    float n_dot_v = func_params.n_dot_v;
#ifdef SMITH_SQRT_APPROX
    float ggxv = n_dot_l * (n_dot_v * (1.0 - r) + r);
    float ggxl = n_dot_v * (n_dot_l * (1.0 - r) + r);
#else
    float ggxv = n_dot_l * sqrt(n_dot_v * n_dot_v * (1.0 - r2) + r2);
    float ggxl = n_dot_v * sqrt(n_dot_l * n_dot_l * (1.0 - r2) + r2);
#endif

    return max(0.0, 0.5 / (ggxv + ggxl));
}

// GGX/Trowbridge-Reitz
float microfacet_distribution(FunctionParamters func_params) {
    float roughness2 = func_params.roughness * func_params.roughness;
    float f = (func_params.n_dot_h * func_params.n_dot_h) * (roughness2 - 1.0) + 1.0;
    return roughness2 / (PI * f * f);
}

// Lambert
float diffuse_function(FunctionParamters func_params) {
    return 1.0 / PI;
}

// Diffuse
float fd(FunctionParamters func_params, w){
    return (1 + ((0.5 + 2 * func_params.roughness *  func_params.l_dot_h *  func_params.l_dot_h) - 1) * (1 - pow(w, 5.0)));
}

float diffuse(FunctionParamters func_params){
    color_pi = func_params.base_color / PI;
    FD = fd(func_params,  func_params.n_dot_l) * fd(func_params,  func_params.n_dot_v);
    return color_pi * FD * func_params.n_dot_l;
}

float FSS(FunctionParamters func_params, w){
    return (1 + ((func_params.roughness * func_params.l_dot_h *  func_params.l_dot_h) - 1) * (1 - pow(w, 5.0)));
}

// subsurface
float subsurface_scattering(FunctionParamters func_params){
    float diffuse_sub = (1.25 * func_params.base_color) / PI;
    fss = (Fss(func_params,  func_params.n_dot_l) * Fss(func_params,  func_params.n_dot_v) 
    * ((1 / (func_params.n_dot_v * func_params.n_dot_l)) - 0.5) + 0.5);
    return diffuse_sub * fss * func_params.n_dot_l;
}

// Metal
float FM(FunctionParamters func_params, w){
    return func_params.base_color + (vec3(1.0) - func_params.base_color) * (1 - pow(w, 5.0))
}

float DM(FunctionParamters func_params){
    float the_math_1 =  (((func_params.h.x * func_params.h.x) / (func_params.ax * func_params.ax)) +
     ((func_params.h.y * func_params.h.y) / (func_params.ay * func_params.ay)) +
func_params.h.z * func_params.h.z);
    float the_math = PI * func_params.ax * func_params.ay * (the_math_1 * the_math_1);
    return 1 / the_math;
}

float V(vec3 w){
    top_in = ((w.x * ax) * (w.x * ax)) * ((w.y * ay) * (w.y * ay));
    top_bottom = w.z * w.z;
    top = sqrt(1 + (top_in / top_bottom)) - 1;
    return top / 2;
}

float G(vec3 w){
    float math = 1 / (1 + V(w));
    return math;
}

float GM(FunctionParamters func_params){
    return G(func_params.in)*G(func_params.out);
}

float metal(FunctionParamters func_params){
    top_math = FM * DM * GM;
    bottom_math = 4 * func_params.;
    return top_math / bottom_math;
}

// Clearcoat
float clearcoat(FunctionParamters func_params){
    ag = (1 - func_params.clearcoat_gloss) * 1.0 + func_params.clearcoat_gloss * 0.001;
    lamda_c = (sqrt(1 + )
}

// Glass
float glass(FunctionParamters func_params){
    func_params.diffuse_color * 
}

float luminance(vec3 color){
    return (color.r * 0.2126 + color.g * 0.7152 + color.b *0.0722);
}

// Sheen
float sheen(FunctionParamters func_params){
    float sheen_luminance = luminance(func_params.base_color);
    float color_tint;
    if (sheen_luminance > 0.0){
        color_tint = func_params.base_color / sheen_luminance;
    } else{
        color_tint = 1.0;
    }
    color_sheen = (1 - func_params.sheen_tint) + func_params.sheen_tint * color_tint;
    return (color_sheen * pow((1 - func_params.l_dot_h), 5.0) * func_params.n_dot_l);
}

void main() {
    vec4 metal_rough = texture2D(p3d_TextureMetalRoughness, v_texcoord);
    float metallic = clamp(p3d_Material.metallic * metal_rough.b, 0.0, 1.0);
    float perceptual_roughness = clamp(p3d_Material.roughness * metal_rough.g,  0.0, 1.0);
    float alpha_roughness = perceptual_roughness * perceptual_roughness;
    vec4 base_color = p3d_Material.baseColor * v_color * p3d_ColorScale * texture2D(p3d_TextureBaseColor, v_texcoord);
    vec3 diffuse_color = (base_color.rgb * (vec3(1.0) - F0)) * (1.0 - metallic);
    vec3 spec_color = mix(F0, base_color.rgb, metallic);
#ifdef USE_NORMAL_MAP
    vec3 n = normalize(v_tbn * (2.0 * texture2D(p3d_TextureNormal, v_texcoord).rgb - 1.0));
#else
    vec3 n = normalize(v_tbn[2]);
#endif
    vec3 v = normalize(-v_position);

#ifdef USE_OCCLUSION_MAP
    float ambient_occlusion = metal_rough.r;
#else
    float ambient_occlusion = 1.0;
#endif

#ifdef USE_EMISSION_MAP
    vec3 emission = p3d_Material.emission.rgb * texture2D(p3d_TextureEmission, v_texcoord).rgb;
#else
    vec3 emission = vec3(0.0);
#endif

    vec4 color = vec4(vec3(0.0), base_color.a) + p3d_TexAlphaOnly;

    for (int i = 0; i < p3d_LightSource.length(); ++i) {
        vec3 lightcol = p3d_LightSource[i].diffuse.rgb;

        if (dot(lightcol, lightcol) < LIGHT_CUTOFF) {
            continue;
        }

        vec3 light_pos = p3d_LightSource[i].position.xyz - v_position * p3d_LightSource[i].position.w;
        vec3 l = normalize(light_pos);
        vec3 h = normalize(l + v);
        float dist = length(light_pos);
        vec3 att_const = p3d_LightSource[i].attenuation;
        float attenuation_factor = 1.0 / (att_const.x + att_const.y * dist + att_const.z * dist * dist);
        float spotcos = dot(normalize(p3d_LightSource[i].spotDirection), -l);
        float spotcutoff = p3d_LightSource[i].spotCosCutoff;
        float shadowSpot = smoothstep(spotcutoff-SPOTSMOOTH, spotcutoff+SPOTSMOOTH, spotcos);
#ifdef ENABLE_SHADOWS
#ifdef USE_330
        float shadowCaster = textureProj(p3d_LightSource[i].shadowMap, v_shadow_pos[i]);
#else
        float shadowCaster = shadow2DProj(p3d_LightSource[i].shadowMap, v_shadow_pos[i]).r;
#endif
#else
        float shadowCaster = 1.0;
#endif
        float shadow = shadowSpot * shadowCaster * attenuation_factor;

        FunctionParamters func_params;
        func_params.n_dot_l = clamp(dot(n, l), 0.0, 1.0);
        func_params.n_dot_v = clamp(abs(dot(n, v)), 0.0, 1.0);
        func_params.n_dot_h = clamp(dot(n, h), 0.0, 1.0);
        func_params.l_dot_h = clamp(dot(l, h), 0.0, 1.0);
        func_params.v_dot_h = clamp(dot(v, h), 0.0, 1.0);
        func_params.roughness = alpha_roughness;
        func_params.metallic =  metallic;
        func_params.reflection0 = spec_color;
        func_params.diffuse_color = diffuse_color;
        func_params.specular_color = spec_color;

        // Calcuat Anistropic
        float aspect = sqrt(1 - 0.9 * anisotropic);
        func_params.ax = max(0.0001, alpha_roughness / aspect);
        func_params.ay = max(0.0001, alpha_roughness * aspect);


        vec3 F = specular_reflection(func_params);
        float V = visibility_occlusion(func_params); // V = G / (4 * n_dot_l * n_dot_v)
        float D = microfacet_distribution(func_params);
        
        #ifdef SUBSURFACE
        vec3 diffuse_contrib = (1 - func_params.subsurface) * diffuse_function(func_params) + subsurface * subsurface_scattering(func_params);
        #else
        vec3 diffuse_contrib = diffuse_color * diffuse_function(func_params);
        #endif
        
        vec3 spec_contrib = vec3(F * V * D);
        color.rgb += func_params.n_dot_l * lightcol * (diffuse_contrib + spec_contrib) * shadow;
    }

    color.rgb += diffuse_color * p3d_LightModel.ambient.rgb * ambient_occlusion;
    color.rgb += emission;

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
