(()=>{var qc=Object.defineProperty;var oo=(e,t,n)=>()=>{if(n)throw n[0];try{return e&&(t=e(e=0)),t}catch(r){throw n=[r],r}};var io=(e,t)=>{for(var n in t)qc(e,n,{get:t[n],enumerable:!0})};function Ac(e,t,n,r){let o=Math.max(1,Math.min(e,t)),i=Math.min(n,20),a=Math.min(i+r,o),c=Math.min(a,Math.floor(e/2)),u=Math.min(a,Math.floor(t/2)),l=b=>b/e*2-1,f=b=>b/t*2-1,d=0,h=e,m=0,y=t,_=c,k=e-c,P=u,D=t-u,v=l(d),$=l(h),T=f(m),O=f(y),ce=l(_),te=l(k),Y=f(P),G=f(D),X=0,Le=0,_e=1,it=1,st=c/e,at=1-c/e,be=u/t,oe=1-u/t,xn=new Float32Array([v,T,$,T,v,Y,v,Y,$,T,$,Y,v,G,$,G,v,O,v,O,$,G,$,O,v,Y,ce,Y,v,G,v,G,ce,Y,ce,G,te,Y,$,Y,te,G,te,G,$,Y,$,G]),p=new Float32Array([X,Le,_e,Le,X,be,X,be,_e,Le,_e,be,X,oe,_e,oe,X,it,X,it,_e,oe,_e,it,X,be,st,be,X,oe,X,oe,st,be,st,oe,at,be,_e,be,at,oe,at,oe,_e,be,_e,oe]);return{positions:xn,uvs:p}}function Ic(e,t,n){let r=e.createShader(t);if(!r)throw new Error("Failed to create shader");if(e.shaderSource(r,n),e.compileShader(r),!e.getShaderParameter(r,e.COMPILE_STATUS)){let o=e.getShaderInfoLog(r)||"Unknown shader error";throw e.deleteShader(r),new Error(o)}return r}function Gp(e,t,n){let r=Ic(e,e.VERTEX_SHADER,t),o=Ic(e,e.FRAGMENT_SHADER,n),i=e.createProgram();if(!i)throw new Error("Failed to create program");if(e.attachShader(i,r),e.attachShader(i,o),e.linkProgram(i),!e.getProgramParameter(i,e.LINK_STATUS)){let s=e.getProgramInfoLog(i)||"Unknown link error";throw e.deleteProgram(i),e.deleteShader(r),e.deleteShader(o),new Error(s)}return e.deleteShader(r),e.deleteShader(o),i}function Kp(e){let t=e.match(/rgb\((\d+),\s*(\d+),\s*(\d+)\)/);if(!t)throw new Error(`Invalid color format: ${e}`);let[,n,r,o]=t;return[parseInt(n)/255,parseInt(r)/255,parseInt(o)/255]}var Jp,Hp,qp,yn,Oc=oo(()=>{Jp=`#version 300 es
precision lowp float;
in vec2 vUV;
out vec4 outColor;
uniform vec2 uResolution;
uniform float uTime;
uniform float uBorderWidth;
uniform float uGlowWidth;
uniform float uBorderRadius;
uniform vec3 uColors[4];
uniform float uGlowExponent;
uniform float uGlowFactor;
const float PI = 3.14159265359;
const float TWO_PI = 2.0 * PI;
const float HALF_PI = 0.5 * PI;
const vec4 startPositions = vec4(0.0, PI, HALF_PI, 1.5 * PI);
const vec4 speeds = vec4(-1.9, -1.9, -1.5, 2.1);
const vec4 innerRadius = vec4(PI * 0.8, PI * 0.7, PI * 0.3, PI * 0.1);
const vec4 outerRadius = vec4(PI * 1.2, PI * 0.9, PI * 0.6, PI * 0.4);
float random(vec2 st) {
return fract(sin(dot(st.xy, vec2(12.9898, 78.233))) * 43758.5453123);
}
vec2 random2(vec2 st) {
return vec2(random(st), random(st + 1.0));
}
float aaStep(float edge, float d) {
float width = fwidth(d);
return smoothstep(edge - width * 0.5, edge + width * 0.5, d);
}
float aaFract(float x) {
float f = fract(x);
float w = fwidth(x);
float smooth_f = f * (1.0 - smoothstep(1.0 - w, 1.0, f));
return smooth_f;
}
float sdRoundedBox(in vec2 p, in vec2 b, in float r) {
vec2 q = abs(p) - b + r;
return min(max(q.x, q.y), 0.0) + length(max(q, 0.0)) - r;
}
float getInnerGlow(vec2 p, vec2 b, float radius) {
float dist_x = b.x - abs(p.x);
float dist_y = b.y - abs(p.y);
float glow_x = smoothstep(radius, 0.0, dist_x);
float glow_y = smoothstep(radius, 0.0, dist_y);
return 1.0 - (1.0 - glow_x) * (1.0 - glow_y);
}
float getVignette(vec2 uv) {
vec2 vignetteUv = uv;
vignetteUv = vignetteUv * (1.0 - vignetteUv);
float vignette = vignetteUv.x * vignetteUv.y * 25.0;
vignette = pow(vignette, 0.16);
vignette = 1.0 - vignette;
return vignette;
}
float uvToAngle(vec2 uv) {
vec2 center = vec2(0.5);
vec2 dir = uv - center;
return atan(dir.y, dir.x) + PI;
}
void main() {
vec2 uv = vUV;
vec2 pos = uv * uResolution;
vec2 centeredPos = pos - uResolution * 0.5;
vec2 size = uResolution - uBorderWidth;
vec2 halfSize = size * 0.5;
float dBorderBox = sdRoundedBox(centeredPos, halfSize, uBorderRadius);
float border = aaStep(0.0, dBorderBox);
float glow = getInnerGlow(centeredPos, halfSize, uGlowWidth);
float vignette = getVignette(uv);
glow *= vignette;
float posAngle = uvToAngle(uv);
vec4 lightCenter = mod(startPositions + speeds * uTime, TWO_PI);
vec4 angleDist = abs(posAngle - lightCenter);
vec4 disToLight = min(angleDist, TWO_PI - angleDist) / TWO_PI;
float intensityBorder[4];
intensityBorder[0] = 1.0;
intensityBorder[1] = smoothstep(0.4, 0.0, disToLight.y);
intensityBorder[2] = smoothstep(0.4, 0.0, disToLight.z);
intensityBorder[3] = smoothstep(0.2, 0.0, disToLight.w) * 0.5;
vec3 borderColor = vec3(0.0);
for(int i = 0; i < 4; i++) {
borderColor = mix(borderColor, uColors[i], intensityBorder[i]);
}
borderColor *= 1.1;
borderColor = clamp(borderColor, 0.0, 1.0);
float intensityGlow[4];
intensityGlow[0] = smoothstep(0.9, 0.0, disToLight.x);
intensityGlow[1] = smoothstep(0.7, 0.0, disToLight.y);
intensityGlow[2] = smoothstep(0.4, 0.0, disToLight.z);
intensityGlow[3] = smoothstep(0.1, 0.0, disToLight.w) * 0.7;
vec4 breath = smoothstep(0.0, 1.0, sin(uTime * 1.0 + startPositions * PI) * 0.2 + 0.8);
vec3 glowColor = vec3(0.0);
glowColor += uColors[0] * intensityGlow[0] * breath.x;
glowColor += uColors[1] * intensityGlow[1] * breath.y;
glowColor += uColors[2] * intensityGlow[2] * breath.z;
glowColor += uColors[3] * intensityGlow[3] * breath.w * glow;
glow = pow(glow, uGlowExponent);
glow *= random(pos + uTime) * 0.1 + 1.0;
glowColor *= glow * uGlowFactor;
glowColor = clamp(glowColor, 0.0, 1.0);
vec3 color = mix(glowColor, borderColor + glowColor * 0.2, border);
float alpha = mix(glow, 1.0, border);
outColor = vec4(color, alpha);
}`,Hp=`#version 300 es
in vec2 aPosition;
in vec2 aUV;
out vec2 vUV;
void main() {
vUV = aUV;
gl_Position = vec4(aPosition, 0.0, 1.0);
}`;qp=["rgb(57, 182, 255)","rgb(189, 69, 251)","rgb(255, 87, 51)","rgb(255, 214, 0)"];yn=class{element;canvas;options;running=!1;disposed=!1;startTime=0;lastTime=0;rafId=null;glr;observer;constructor(t={}){this.options={width:t.width??600,height:t.height??600,ratio:t.ratio??window.devicePixelRatio??1,borderWidth:t.borderWidth??8,glowWidth:t.glowWidth??200,borderRadius:t.borderRadius??8,mode:t.mode??"light",...t},this.canvas=document.createElement("canvas"),this.options.classNames&&(this.canvas.className=this.options.classNames),this.options.styles&&Object.assign(this.canvas.style,this.options.styles),this.canvas.style.display="block",this.canvas.style.transformOrigin="center",this.canvas.style.pointerEvents="none",this.element=this.canvas,this.setupGL(),this.options.skipGreeting||this.greet()}start(){if(this.disposed)throw new Error("Motion instance has been disposed.");if(this.running)return;if(!this.glr){console.error("WebGL resources are not initialized.");return}this.running=!0,this.startTime=performance.now(),this.resize(this.options.width??600,this.options.height??600,this.options.ratio),this.glr.gl.viewport(0,0,this.canvas.width,this.canvas.height),this.glr.gl.useProgram(this.glr.program),this.glr.gl.uniform2f(this.glr.uResolution,this.canvas.width,this.canvas.height),this.checkGLError(this.glr.gl,"start: after initial setup");let t=()=>{if(!this.running||!this.glr)return;this.rafId=requestAnimationFrame(t);let n=performance.now();if(n-this.lastTime<1e3/32)return;this.lastTime=n;let o=(n-this.startTime)*.001;this.render(o)};this.rafId=requestAnimationFrame(t)}pause(){if(this.disposed)throw new Error("Motion instance has been disposed.");this.running=!1,this.rafId!==null&&cancelAnimationFrame(this.rafId)}dispose(){if(this.disposed)return;this.disposed=!0,this.running=!1,this.rafId!==null&&cancelAnimationFrame(this.rafId);let{gl:t,vao:n,positionBuffer:r,uvBuffer:o,program:i}=this.glr;n&&t.deleteVertexArray(n),r&&t.deleteBuffer(r),o&&t.deleteBuffer(o),t.deleteProgram(i),this.observer&&this.observer.disconnect(),this.canvas.remove()}resize(t,n,r){if(this.disposed)throw new Error("Motion instance has been disposed.");if(this.options.width=t,this.options.height=n,r&&(this.options.ratio=r),!this.running)return;let{gl:o,program:i,vao:s,positionBuffer:a,uvBuffer:c,uResolution:u}=this.glr,l=r??this.options.ratio??window.devicePixelRatio??1,f=Math.max(1,Math.floor(t*l)),d=Math.max(1,Math.floor(n*l));this.canvas.style.width=`${t}px`,this.canvas.style.height=`${n}px`,(this.canvas.width!==f||this.canvas.height!==d)&&(this.canvas.width=f,this.canvas.height=d),o.viewport(0,0,this.canvas.width,this.canvas.height),this.checkGLError(o,"resize: after viewport setup");let{positions:h,uvs:m}=Ac(this.canvas.width,this.canvas.height,this.options.borderWidth*l,this.options.glowWidth*l);o.bindVertexArray(s),o.bindBuffer(o.ARRAY_BUFFER,a),o.bufferData(o.ARRAY_BUFFER,h,o.STATIC_DRAW);let y=o.getAttribLocation(i,"aPosition");o.enableVertexAttribArray(y),o.vertexAttribPointer(y,2,o.FLOAT,!1,0,0),this.checkGLError(o,"resize: after position buffer update"),o.bindBuffer(o.ARRAY_BUFFER,c),o.bufferData(o.ARRAY_BUFFER,m,o.STATIC_DRAW);let _=o.getAttribLocation(i,"aUV");o.enableVertexAttribArray(_),o.vertexAttribPointer(_,2,o.FLOAT,!1,0,0),this.checkGLError(o,"resize: after UV buffer update"),o.useProgram(i),o.uniform2f(u,this.canvas.width,this.canvas.height),o.uniform1f(this.glr.uBorderWidth,this.options.borderWidth*l),o.uniform1f(this.glr.uGlowWidth,this.options.glowWidth*l),o.uniform1f(this.glr.uBorderRadius,this.options.borderRadius*l),this.checkGLError(o,"resize: after uniform updates");let k=performance.now();this.lastTime=k;let P=(k-this.startTime)*.001;this.render(P)}autoResize(t){this.observer&&this.observer.disconnect(),this.observer=new ResizeObserver(()=>{let n=t.getBoundingClientRect();this.resize(n.width,n.height)}),this.observer.observe(t)}fadeIn(){if(this.disposed)throw new Error("Motion instance has been disposed.");return new Promise((t,n)=>{let r=this.canvas.animate([{opacity:0,transform:"scale(1.2)"},{opacity:1,transform:"scale(1)"}],{duration:300,easing:"ease-out",fill:"forwards"});r.onfinish=()=>t(),r.oncancel=()=>n("canceled")})}fadeOut(){if(this.disposed)throw new Error("Motion instance has been disposed.");return new Promise((t,n)=>{let r=this.canvas.animate([{opacity:1,transform:"scale(1)"},{opacity:0,transform:"scale(1.2)"}],{duration:300,easing:"ease-in",fill:"forwards"});r.onfinish=()=>t(),r.oncancel=()=>n("canceled")})}checkGLError(t,n){let r=t.getError();if(r!==t.NO_ERROR){for(console.group(`\u{1F534} WebGL Error in ${n}`);r!==t.NO_ERROR;){let o=this.getGLErrorName(t,r);console.error(`${o} (0x${r.toString(16)})`),r=t.getError()}console.groupEnd()}}getGLErrorName(t,n){switch(n){case t.INVALID_ENUM:return"INVALID_ENUM";case t.INVALID_VALUE:return"INVALID_VALUE";case t.INVALID_OPERATION:return"INVALID_OPERATION";case t.INVALID_FRAMEBUFFER_OPERATION:return"INVALID_FRAMEBUFFER_OPERATION";case t.OUT_OF_MEMORY:return"OUT_OF_MEMORY";case t.CONTEXT_LOST_WEBGL:return"CONTEXT_LOST_WEBGL";default:return"UNKNOWN_ERROR"}}setupGL(){let t=this.canvas.getContext("webgl2",{antialias:!1,alpha:!0});if(!t)throw new Error("WebGL2 is required but not available.");let n=Gp(t,Hp,Jp);this.checkGLError(t,"setupGL: after createProgram");let r=t.createVertexArray();t.bindVertexArray(r),this.checkGLError(t,"setupGL: after VAO creation");let o=this.canvas.width||2,i=this.canvas.height||2,{positions:s,uvs:a}=Ac(o,i,this.options.borderWidth,this.options.glowWidth),c=t.createBuffer();t.bindBuffer(t.ARRAY_BUFFER,c),t.bufferData(t.ARRAY_BUFFER,s,t.STATIC_DRAW);let u=t.getAttribLocation(n,"aPosition");t.enableVertexAttribArray(u),t.vertexAttribPointer(u,2,t.FLOAT,!1,0,0),this.checkGLError(t,"setupGL: after position buffer setup");let l=t.createBuffer();t.bindBuffer(t.ARRAY_BUFFER,l),t.bufferData(t.ARRAY_BUFFER,a,t.STATIC_DRAW);let f=t.getAttribLocation(n,"aUV");t.enableVertexAttribArray(f),t.vertexAttribPointer(f,2,t.FLOAT,!1,0,0),this.checkGLError(t,"setupGL: after UV buffer setup");let d=t.getUniformLocation(n,"uResolution"),h=t.getUniformLocation(n,"uTime"),m=t.getUniformLocation(n,"uBorderWidth"),y=t.getUniformLocation(n,"uGlowWidth"),_=t.getUniformLocation(n,"uBorderRadius"),k=t.getUniformLocation(n,"uColors"),P=t.getUniformLocation(n,"uGlowExponent"),D=t.getUniformLocation(n,"uGlowFactor");t.useProgram(n),t.uniform1f(m,this.options.borderWidth),t.uniform1f(y,this.options.glowWidth),t.uniform1f(_,this.options.borderRadius),this.options.mode==="dark"?(t.uniform1f(P,2),t.uniform1f(D,1.8)):(t.uniform1f(P,1),t.uniform1f(D,1));let v=(this.options.colors||qp).map(Kp);for(let $=0;$<v.length;$++)t.uniform3f(t.getUniformLocation(n,`uColors[${$}]`),...v[$]);this.checkGLError(t,"setupGL: after uniform setup"),t.bindVertexArray(null),t.bindBuffer(t.ARRAY_BUFFER,null),this.glr={gl:t,program:n,vao:r,positionBuffer:c,uvBuffer:l,uResolution:d,uTime:h,uBorderWidth:m,uGlowWidth:y,uBorderRadius:_,uColors:k}}render(t){if(!this.glr)return;let{gl:n,program:r,vao:o,uTime:i}=this.glr;n.useProgram(r),n.bindVertexArray(o),n.uniform1f(i,t),n.disable(n.DEPTH_TEST),n.disable(n.CULL_FACE),n.disable(n.BLEND),n.clearColor(0,0,0,0),n.clear(n.COLOR_BUFFER_BIT),n.drawArrays(n.TRIANGLES,0,24),this.checkGLError(n,"render: after draw call"),n.bindVertexArray(null)}greet(){console.log("%c\u{1F308} ai-motion 0.4.8 \u{1F308}","background: linear-gradient(90deg, #39b6ff, #bd45fb, #ff5733, #ffd600); color: white; text-shadow: 0 0 2px rgba(0, 0, 0, 0.2); font-weight: bold; font-size: 1em; padding: 2px 12px; border-radius: 6px;")}}});var Nc={};io(Nc,{SimulatorMask:()=>id});function Yp(){try{return!!(Xp()||Qp()||ed()||td()||rd()||nd())}catch(e){return console.warn("Error determining if page is dark:",e),!1}}function Xp(){let e=["dark","dark-mode","theme-dark","night","night-mode"],t=document.documentElement,n=document.body||document.documentElement;for(let r of e)if(t.classList.contains(r)||n?.classList.contains(r))return!0;return!1}function Qp(){let e=document.documentElement,t=document.body||document.documentElement;for(let n of["data-theme","data-color-mode","data-bs-theme","data-mui-color-scheme"]){let r=t?.getAttribute(n),o=e.getAttribute(n);if(r?.toLowerCase()==="dark"||o?.toLowerCase()==="dark")return!0}return!1}function ed(){let e=document.querySelector('meta[name="color-scheme"]')?.content.toLowerCase();if(e==="dark"||e==="only dark")return!0;let t=window.getComputedStyle(document.documentElement).getPropertyValue("color-scheme").trim().toLowerCase();return t==="dark"||t==="only dark"}function td(){let e=window.getComputedStyle(document.documentElement),t=window.getComputedStyle(document.body||document.documentElement),n=e.backgroundColor,r=t.backgroundColor;return Qr(r)?!0:r==="transparent"||r.startsWith("rgba(0, 0, 0, 0)")?Qr(n):!1}function nd(){let t=Cc(window.getComputedStyle(document.body||document.documentElement).color);return t!==null&&t>200}function rd(){let{innerWidth:e,innerHeight:t}=window,n=e*t*.5;for(let r of["#app","#root","#__next"]){let o=document.querySelector(r);if(!o)continue;let i=o.getBoundingClientRect();if(!(i.width*i.height<n)&&Qr(window.getComputedStyle(o).backgroundColor))return!0}return!1}function od(e){let t=/rgba?\((\d+),\s*(\d+),\s*(\d+)/.exec(e);return t?{r:parseInt(t[1]),g:parseInt(t[2]),b:parseInt(t[3])}:null}function Cc(e){if(!e||e==="transparent"||e.startsWith("rgba(0, 0, 0, 0)"))return null;let t=od(e);return t?.299*t.r+.587*t.g+.114*t.b:null}function Qr(e,t=128){let n=Cc(e);return n!==null&&n<t}var Xr,je,id,Rc=oo(()=>{Oc();(function(){try{if(typeof document<"u"){var e=document.createElement("style");e.appendChild(document.createTextNode(`._wrapper_1ooyb_1 {
	position: fixed;
	inset: 0;
	z-index: 2147483641; /* \u786E\u4FDD\u5728\u6240\u6709\u5143\u7D20\u4E4B\u4E0A\uFF0C\u9664\u4E86 panel */
	cursor: wait;
	overflow: hidden;

	display: none;
}

._wrapper_1ooyb_1._visible_1ooyb_11 {
	display: block;
}
/* AI \u5149\u6807\u6837\u5F0F */
._cursor_1dgwb_2 {
	position: absolute;
	width: var(--cursor-size, 75px);
	height: var(--cursor-size, 75px);
	pointer-events: none;
	z-index: 10000;
}

._cursorBorder_1dgwb_10 {
	position: absolute;
	width: 100%;
	height: 100%;
	background: linear-gradient(45deg, rgb(57, 182, 255), rgb(189, 69, 251));
	mask-image: url("data:image/svg+xml,%3csvg%20xmlns='http://www.w3.org/2000/svg'%20viewBox='0%200%20100%20100'%20fill='none'%3e%3cg%3e%3cpath%20d='M%2015%2042%20L%2015%2036.99%20Q%2015%2031.99%2023.7%2031.99%20L%2028.05%2031.99%20Q%2032.41%2031.99%2032.41%2021.99%20L%2032.41%2017%20Q%2032.41%2012%2041.09%2016.95%20L%2076.31%2037.05%20Q%2085%2042%2076.31%2046.95%20L%2041.09%2067.05%20Q%2032.41%2072%2032.41%2062.01%20L%2032.41%2057.01%20Q%2032.41%2052.01%2023.7%2052.01%20L%2019.35%2052.01%20Q%2015%2052.01%2015%2047.01%20Z'%20fill='none'%20stroke='%23000000'%20stroke-width='6'%20stroke-miterlimit='10'%20style='stroke:%20light-dark(rgb(0,%200,%200),%20rgb(255,%20255,%20255));'/%3e%3c/g%3e%3c/svg%3e");
	mask-size: 100% 100%;
	mask-repeat: no-repeat;

	transform-origin: center;
	transform: rotate(-135deg) scale(1.2);
	margin-left: -10px;
	margin-top: -18px;
}

._cursorFilling_1dgwb_25 {
	position: absolute;
	width: 100%;
	height: 100%;
	background: url("data:image/svg+xml,%3csvg%20xmlns='http://www.w3.org/2000/svg'%20viewBox='0%200%20100%20100'%3e%3cdefs%3e%3c/defs%3e%3cg%20xmlns='http://www.w3.org/2000/svg'%20style='filter:%20drop-shadow(light-dark(rgba(0,%200,%200,%200.4),%20rgba(237,%20237,%20237,%200.4))%203px%204px%204px);'%3e%3cpath%20d='M%2015%2042%20L%2015%2036.99%20Q%2015%2031.99%2023.7%2031.99%20L%2028.05%2031.99%20Q%2032.41%2031.99%2032.41%2021.99%20L%2032.41%2017%20Q%2032.41%2012%2041.09%2016.95%20L%2076.31%2037.05%20Q%2085%2042%2076.31%2046.95%20L%2041.09%2067.05%20Q%2032.41%2072%2032.41%2062.01%20L%2032.41%2057.01%20Q%2032.41%2052.01%2023.7%2052.01%20L%2019.35%2052.01%20Q%2015%2052.01%2015%2047.01%20Z'%20fill='%23ffffff'%20stroke='none'%20style='fill:%20%23ffffff;'/%3e%3c/g%3e%3c/svg%3e");
	background-size: 100% 100%;
	background-repeat: no-repeat;

	transform-origin: center;
	transform: rotate(-135deg) scale(1.2);
	margin-left: -10px;
	margin-top: -18px;
}

._cursorRipple_1dgwb_39 {
	position: absolute;
	width: 100%;
	height: 100%;
	pointer-events: none;
	margin-left: -50%;
	margin-top: -50%;

	&::after {
		content: '';
		opacity: 0;
		position: absolute;
		inset: 0;
		border: 4px solid rgba(57, 182, 255, 1);
		border-radius: 50%;
	}
}

._cursor_1dgwb_2._clicking_1dgwb_57 ._cursorRipple_1dgwb_39::after {
	animation: _cursor-ripple_1dgwb_1 300ms ease-out forwards;
}

@keyframes _cursor-ripple_1dgwb_1 {
	0% {
		transform: scale(0);
		opacity: 1;
	}
	100% {
		transform: scale(2);
		opacity: 0;
	}
}`)),document.head.appendChild(e)}}catch(t){console.error("vite-plugin-css-injected-by-js",t)}})();Xr={wrapper:"_wrapper_1ooyb_1",visible:"_visible_1ooyb_11"},je={cursor:"_cursor_1dgwb_2",cursorBorder:"_cursorBorder_1dgwb_10",cursorFilling:"_cursorFilling_1dgwb_25",cursorRipple:"_cursorRipple_1dgwb_39",clicking:"_clicking_1dgwb_57","cursor-ripple":"_cursor-ripple_1dgwb_1"},id=class extends EventTarget{shown=!1;wrapper=document.createElement("div");motion=null;#o=!1;#e=document.createElement("div");#t=0;#n=0;#s=0;#i=0;constructor(){super(),this.wrapper.id="page-agent-runtime_simulator-mask",this.wrapper.className=Xr.wrapper,this.wrapper.setAttribute("data-browser-use-ignore","true"),this.wrapper.setAttribute("data-page-agent-ignore","true");try{let o=new yn({mode:Yp()?"dark":"light",styles:{position:"absolute",inset:"0"}});this.motion=o,this.wrapper.appendChild(o.element),o.autoResize(this.wrapper)}catch(o){console.warn("[SimulatorMask] Motion overlay unavailable:",o)}this.wrapper.addEventListener("click",o=>{o.stopPropagation(),o.preventDefault()}),this.wrapper.addEventListener("mousedown",o=>{o.stopPropagation(),o.preventDefault()}),this.wrapper.addEventListener("mouseup",o=>{o.stopPropagation(),o.preventDefault()}),this.wrapper.addEventListener("mousemove",o=>{o.stopPropagation(),o.preventDefault()}),this.wrapper.addEventListener("wheel",o=>{o.stopPropagation(),o.preventDefault()}),this.wrapper.addEventListener("keydown",o=>{o.stopPropagation(),o.preventDefault()}),this.wrapper.addEventListener("keyup",o=>{o.stopPropagation(),o.preventDefault()}),this.#r(),document.body.appendChild(this.wrapper),this.#u();let e=o=>{let{x:i,y:s}=o.detail;this.setCursorPosition(i,s)},t=()=>{this.triggerClickAnimation()},n=()=>{this.wrapper.style.pointerEvents="none"},r=()=>{this.wrapper.style.pointerEvents="auto"};window.addEventListener("PageAgent::MovePointerTo",e),window.addEventListener("PageAgent::ClickPointer",t),window.addEventListener("PageAgent::EnablePassThrough",n),window.addEventListener("PageAgent::DisablePassThrough",r),this.addEventListener("dispose",()=>{window.removeEventListener("PageAgent::MovePointerTo",e),window.removeEventListener("PageAgent::ClickPointer",t),window.removeEventListener("PageAgent::EnablePassThrough",n),window.removeEventListener("PageAgent::DisablePassThrough",r)})}#r(){this.#e.className=je.cursor;let e=document.createElement("div");e.className=je.cursorRipple,this.#e.appendChild(e);let t=document.createElement("div");t.className=je.cursorFilling,this.#e.appendChild(t);let n=document.createElement("div");n.className=je.cursorBorder,this.#e.appendChild(n),this.wrapper.appendChild(this.#e)}#u(){if(this.#o)return;let e=this.#t+(this.#s-this.#t)*.2,t=this.#n+(this.#i-this.#n)*.2,n=Math.abs(e-this.#s);n>0&&(n<2?this.#t=this.#s:this.#t=e,this.#e.style.left=`${this.#t}px`);let r=Math.abs(t-this.#i);r>0&&(r<2?this.#n=this.#i:this.#n=t,this.#e.style.top=`${this.#n}px`),requestAnimationFrame(()=>this.#u())}setCursorPosition(e,t){this.#o||(this.#s=e,this.#i=t)}triggerClickAnimation(){this.#o||(this.#e.classList.remove(je.clicking),this.#e.getBoundingClientRect(),this.#e.classList.add(je.clicking))}show(){this.shown||this.#o||(this.shown=!0,this.motion?.start(),this.motion?.fadeIn(),this.wrapper.classList.add(Xr.visible),this.#t=window.innerWidth/2,this.#n=window.innerHeight/2,this.#s=this.#t,this.#i=this.#n,this.#e.style.left=`${this.#t}px`,this.#e.style.top=`${this.#n}px`)}hide(){!this.shown||this.#o||(this.shown=!1,this.motion?.fadeOut(),this.motion?.pause(),this.#e.classList.remove(je.clicking),setTimeout(()=>{this.wrapper.classList.remove(Xr.visible)},800))}dispose(){this.#o=!0,this.motion?.dispose(),this.wrapper.remove(),this.dispatchEvent(new Event("dispose"))}}});var A={};io(A,{BIGINT_FORMAT_RANGES:()=>Mt,CONSTANT_CATCH:()=>bo,Class:()=>$n,NUMBER_FORMAT_RANGES:()=>dt,aborted:()=>xe,allowsEval:()=>Tn,assert:()=>eu,assertEqual:()=>Kc,assertIs:()=>Xc,assertNever:()=>Qc,assertNotEqual:()=>Yc,assignProp:()=>le,attachSchema:()=>Ft,base64ToUint8Array:()=>go,base64urlToUint8Array:()=>yu,cached:()=>ut,captureStackTrace:()=>Zt,cleanEnum:()=>bu,cleanRegex:()=>lt,clone:()=>he,cloneDef:()=>ru,codePointLength:()=>ht,constantCatch:()=>yo,createTransparentProxy:()=>uu,defineLazy:()=>co,defineLazyInternal:()=>Z,derived:()=>ku,esc:()=>Sn,escapeRegex:()=>Ue,explicitlyAborted:()=>On,extend:()=>du,finalizeIssue:()=>Se,floatSafeRemainder:()=>zn,getElementAtPath:()=>ou,getEnumValues:()=>qe,getLengthableOrigin:()=>mt,getParsedType:()=>cu,getSizableOrigin:()=>mo,hexToUint8Array:()=>wu,hide:()=>Ut,installLazyProp:()=>Su,isObject:()=>He,isPlainObject:()=>Fe,issue:()=>Ye,joinValues:()=>Rt,jsonStringifyReplacer:()=>Ke,members:()=>Nn,merge:()=>hu,mergeDefs:()=>ze,normalizeParams:()=>S,nullish:()=>En,numKeys:()=>au,objectClone:()=>tu,omit:()=>pu,optionalKeys:()=>In,own:()=>Oe,parsedType:()=>Cn,partial:()=>mu,pick:()=>lu,prefixIssues:()=>ft,primitiveTypes:()=>fo,promiseAllObject:()=>iu,propertyKeyTypes:()=>An,randomString:()=>su,rawShape:()=>pt,required:()=>gu,safeExtend:()=>fu,shallowClone:()=>po,slugify:()=>Pn,stringifyPrimitive:()=>Lt,toZod:()=>ao,uint8ArrayToBase64:()=>_o,uint8ArrayToBase64url:()=>xu,uint8ArrayToHex:()=>vu,unwrapMessage:()=>Je});function Kc(e){return e}function Yc(e){return e}function ao(){return e=>e}function Xc(e){}function Qc(e){throw new Error("Unexpected value in exhaustive check")}function eu(e){}function qe(e){let t=Object.values(e).filter(r=>typeof r=="number");return Object.entries(e).filter(([r,o])=>t.indexOf(+r)===-1).map(([r,o])=>o)}function Rt(e,t="|"){return e.map(n=>Lt(n)).join(t)}function Ke(e,t){return typeof t=="bigint"?t.toString():t}var kn=class{constructor(t){this._getter=t,this._value=void 0}get value(){let t=this._getter;return t!==void 0&&(this._value=t(),this._getter=void 0),this._value}};function ut(e){return new kn(e)}function En(e){return e==null}function lt(e){let t=e.startsWith("^")?1:0,n=e.endsWith("$")?e.length-1:e.length;return e.slice(t,n)}function zn(e,t){let n=e/t,r=Math.round(n),o=4*Number.EPSILON*Math.max(Math.abs(n),1);return Math.abs(n-r)<o?0:n-r}var so=Symbol("evaluating");function co(e,t,n){let r;Object.defineProperty(e,t,{get(){if(r!==so)return r===void 0&&(r=so,r=n()),r},set(o){Object.defineProperty(e,t,{value:o})},configurable:!0})}function tu(e){return Object.create(Object.getPrototypeOf(e),Object.getOwnPropertyDescriptors(e))}function le(e,t,n){Object.defineProperty(e,t,{value:n,writable:!0,enumerable:!0,configurable:!0})}function pt(e){let t=Object.getOwnPropertyDescriptor(e,"shape");return t?.get?t.get.raw:t?.value}function Ee(e){return pt(e._zod.def)??e._zod.def.shape}function uo(e,t,n){Object.defineProperty(e,t,{get(){let r=n();return le(this,t,r),r},enumerable:!0,configurable:!0})}function lo(e,t,n){t in e?le(e,t,n):e[t]=n}function De(e,t,n,r){let o=Ee(t);for(let i of n){let s=Object.getOwnPropertyDescriptor(o,i);s.enumerable&&(s.get?uo(e,i,()=>{let a=t._zod.def.shape[i];return r?r(a,i):a}):lo(e,i,r?r(s.value,i):s.value))}}function nu(e,t){for(let n of Reflect.ownKeys(t)){let r=Object.getOwnPropertyDescriptor(t,n);r.enumerable&&(r.get?uo(e,n,()=>t[n]):lo(e,n,r.value))}}function ze(...e){let t={};for(let n of e){let r=Object.getOwnPropertyDescriptors(n);Object.assign(t,r)}return Object.defineProperties({},t)}function ru(e){return ze(e._zod.def)}function ou(e,t){return t?t.reduce((n,r)=>n?.[r],e):e}function iu(e){let t=Object.keys(e),n=t.map(r=>e[r]);return Promise.all(n).then(r=>{let o={};for(let i=0;i<t.length;i++)o[t[i]]=r[i];return o})}function su(e=10){let t="abcdefghijklmnopqrstuvwxyz",n="";for(let r=0;r<e;r++)n+=t[Math.floor(Math.random()*t.length)];return n}function Sn(e){return JSON.stringify(e)}function Pn(e){return e.toLowerCase().trim().replace(/[^\w\s-]/g,"").replace(/[\s_-]+/g,"-").replace(/^-+|-+$/g,"")}var Zt="captureStackTrace"in Error?Error.captureStackTrace:(...e)=>{};function He(e){return typeof e=="object"&&e!==null&&!Array.isArray(e)}var Tn=ut(()=>{if(pe.jitless||typeof navigator<"u"&&navigator?.userAgent?.includes("Cloudflare"))return!1;try{let e=Function;return new e(""),!0}catch{return!1}});function Fe(e){if(He(e)===!1)return!1;let t=e.constructor;if(t===void 0||typeof t!="function")return!0;let n=t.prototype;return!(He(n)===!1||Object.prototype.hasOwnProperty.call(n,"isPrototypeOf")===!1)}function po(e){return Fe(e)?{...e}:Array.isArray(e)?[...e]:e instanceof Map?new Map(e):e instanceof Set?new Set(e):e}function au(e){let t=0;for(let n in e)Object.prototype.hasOwnProperty.call(e,n)&&t++;return t}var cu=e=>{let t=typeof e;switch(t){case"undefined":return"undefined";case"string":return"string";case"number":return Number.isNaN(e)?"nan":"number";case"boolean":return"boolean";case"function":return"function";case"bigint":return"bigint";case"symbol":return"symbol";case"object":return Array.isArray(e)?"array":e===null?"null":e.then&&typeof e.then=="function"&&e.catch&&typeof e.catch=="function"?"promise":typeof Map<"u"&&e instanceof Map?"map":typeof Set<"u"&&e instanceof Set?"set":typeof Date<"u"&&e instanceof Date?"date":typeof File<"u"&&e instanceof File?"file":"object";default:throw new Error(`Unknown data type: ${t}`)}},An=new Set(["string","number","symbol"]),fo=new Set(["string","number","bigint","boolean","symbol","undefined"]);function Ue(e){return e.replace(/[.*+?^${}()|[\]\\]/g,"\\$&")}function he(e,t,n){let r=new e._zod.constr(t??e._zod.def);return(!t||n?.parent)&&(r._zod.parent=e),r}function S(e){let t=e;if(!t)return{};if(typeof t=="string")return{error:()=>t};if(t?.message!==void 0){if(t?.error!==void 0)throw new Error("Cannot specify both `message` and `error` params");t.error=t.message}return delete t.message,typeof t.error=="string"?{...t,error:()=>t.error}:t}function uu(e){let t;return new Proxy({},{get(n,r,o){return t??(t=e()),Reflect.get(t,r,o)},set(n,r,o,i){return t??(t=e()),Reflect.set(t,r,o,i)},has(n,r){return t??(t=e()),Reflect.has(t,r)},deleteProperty(n,r){return t??(t=e()),Reflect.deleteProperty(t,r)},ownKeys(n){return t??(t=e()),Reflect.ownKeys(t)},getOwnPropertyDescriptor(n,r){return t??(t=e()),Reflect.getOwnPropertyDescriptor(t,r)},defineProperty(n,r,o){return t??(t=e()),Reflect.defineProperty(t,r,o)}})}function Lt(e){return typeof e=="bigint"?e.toString()+"n":typeof e=="string"?`"${e}"`:`${e}`}function In(e){return Object.keys(e).filter(t=>e[t]._zod.optin!==void 0&&e[t]._zod.optout==="optional")}var dt={safeint:[Number.MIN_SAFE_INTEGER,Number.MAX_SAFE_INTEGER],int32:[-2147483648,2147483647],uint32:[0,4294967295],float32:[-34028234663852886e22,34028234663852886e22],float64:[-Number.MAX_VALUE,Number.MAX_VALUE]},Mt={int64:[BigInt("-9223372036854775808"),BigInt("9223372036854775807")],uint64:[BigInt(0),BigInt("18446744073709551615")]};function lu(e,t){let n=e._zod.def,r=n.checks;if(r&&r.length>0)throw new Error(".pick() cannot be used on object schemas containing refinements");let i={};return De(i,e,Dt(e,t)),he(e,ze(n,{shape:i,checks:[]}))}function Dt(e,t){let n=Ee(e),r=[];for(let o of Reflect.ownKeys(t)){if(!Object.getOwnPropertyDescriptor(n,o)?.enumerable)throw new Error(`Unrecognized key: "${String(o)}"`);t[o]&&r.push(o)}return r}function pu(e,t){let n=e._zod.def,r=n.checks;if(r&&r.length>0)throw new Error(".omit() cannot be used on object schemas containing refinements");let i=new Set(Dt(e,t)),s={};return De(s,e,Reflect.ownKeys(Ee(e)).filter(a=>!i.has(a))),he(e,ze(n,{shape:s,checks:[]}))}function du(e,t){if(!Fe(t))throw new Error("Invalid input to extend: expected a plain object");let n=e._zod.def.checks;if(n&&n.length>0){let o=Ee(e);for(let i of Reflect.ownKeys(t))if(Object.getOwnPropertyDescriptor(o,i)!==void 0)throw new Error("Cannot overwrite keys on object schemas containing refinements. Use `.safeExtend()` instead.")}return he(e,ze(e._zod.def,{shape:ho(e,t)}))}function ho(e,t){let n={};return De(n,e,Reflect.ownKeys(Ee(e))),nu(n,t),n}function fu(e,t){if(!Fe(t))throw new Error("Invalid input to safeExtend: expected a plain object");return he(e,ze(e._zod.def,{shape:ho(e,t)}))}function hu(e,t){if(!t?._zod?.def)throw new Error("Invalid input to merge: expected an object schema. To merge a plain shape, use `.extend()`.");if(e._zod.def.checks?.length)throw new Error(".merge() cannot be used on object schemas containing refinements. Use .safeExtend() instead.");let n={};De(n,e,Reflect.ownKeys(Ee(e))),De(n,t,Reflect.ownKeys(Ee(t)));let r=ze(e._zod.def,{shape:n,get catchall(){return t._zod.def.catchall},checks:t._zod.def.checks??[]});return he(e,r)}function mu(e,t,n,r="partial"){let i=t._zod.def.checks;if(i&&i.length>0)throw new Error(`.${r}() cannot be used on object schemas containing refinements`);let a=n?new Set(Dt(t,n)):void 0,c={};return De(c,t,Reflect.ownKeys(Ee(t)),e&&((u,l)=>a&&!a.has(l)?u:new e({type:"optional",innerType:u}))),he(t,ze(t._zod.def,{shape:c,checks:[]}))}function gu(e,t,n){let r=n?new Set(Dt(t,n)):void 0,o={};return De(o,t,Reflect.ownKeys(Ee(t)),(i,s)=>r&&!r.has(s)?i:new e({type:"nonoptional",innerType:i})),he(t,ze(t._zod.def,{shape:o}))}function xe(e,t=0){if(e.aborted===!0)return!0;for(let n=t;n<e.issues.length;n++)if(e.issues[n]?.continue!==!0)return!0;return!1}function On(e,t=0){if(e.aborted===!0)return!0;for(let n=t;n<e.issues.length;n++)if(e.issues[n]?.continue===!1)return!0;return!1}function ft(e,t){return t.map(n=>{var r;return(r=n).path??(r.path=[]),n.path.unshift(e),n})}function Je(e){return typeof e=="string"?e:e?.message}function Ft(e,t,n){var r;for(let o=t;o<e.length;o++)(r=e[o]).schema??(r.schema=n)}function Se(e,t,n){var r;let o=e.inst?._zod?.traits;o?.has("$ZodType")&&(o.has("$ZodCheck")?(r=e).schema??(r.schema=e.inst):e.schema=e.inst);let i=e.schema!==e.inst?e.schema?._zod.def?.error:void 0,s=e.message?e.message:Je(e.inst?._zod.def?.error?.(e))??Je(i?.(e))??Je(t?.error?.(e))??Je(n.customError?.(e))??Je(n.localeError?.(e))??"Invalid input",a={};for(let c of Object.keys(e))c==="inst"||c==="schema"||c==="continue"||c==="input"||c==="__proto__"||(a[c]=e[c]);return a.path??(a.path=[]),a.message=s,t?.reportInput&&(a.input=e.input),a}function mo(e){return e instanceof Set?"set":e instanceof Map?"map":e instanceof File?"file":"unknown"}var _u=/[\uD800-\uDBFF]/;function ht(e){let t=e.length;if(!_u.test(e))return t;let n=t;for(let r=0;r<t-1;r++)(e.charCodeAt(r)&64512)===55296&&(e.charCodeAt(r+1)&64512)===56320&&(n--,r++);return n}function mt(e){return Array.isArray(e)?"array":typeof e=="string"?"string":"unknown"}function Cn(e){let t=typeof e;switch(t){case"number":return Number.isNaN(e)?"nan":"number";case"object":{if(e===null)return"null";if(Array.isArray(e))return"array";let n=e;if(n&&Object.getPrototypeOf(n)!==Object.prototype&&"constructor"in n&&n.constructor)return n.constructor.name}}return t}function Ye(...e){let[t,n,r]=e;return typeof t=="string"?{message:t,code:"custom",input:n,inst:r}:{...t}}function bu(e){return Object.entries(e).filter(([t,n])=>Number.isNaN(Number.parseInt(t,10))).map(t=>t[1])}function go(e){let t=atob(e),n=new Uint8Array(t.length);for(let r=0;r<t.length;r++)n[r]=t.charCodeAt(r);return n}function _o(e){let t="";for(let n=0;n<e.length;n++)t+=String.fromCharCode(e[n]);return btoa(t)}function yu(e){let t=e.replace(/-/g,"+").replace(/_/g,"/"),n="=".repeat((4-t.length%4)%4);return go(t+n)}function xu(e){return _o(e).replace(/\+/g,"-").replace(/\//g,"_").replace(/=/g,"")}function wu(e){let t=e.replace(/^0x/,"");if(t.length%2!==0)throw new Error("Invalid hex string length");let n=new Uint8Array(t.length/2);for(let r=0;r<t.length;r+=2)n[r/2]=Number.parseInt(t.slice(r,r+2),16);return n}function vu(e){return Array.from(e).map(t=>t.toString(16).padStart(2,"0")).join("")}var $n=class{constructor(...t){}};function Nn(e,t){for(let n in t){let r=Object.getOwnPropertyDescriptor(t,n);r.get?Object.defineProperty(e,n,{...r,enumerable:!1}):$u(e,n,r.value)}}function Oe(e,t,n,r=!0){return Object.defineProperty(e,t,{configurable:!0,writable:!0,enumerable:r,value:n}),n}function Ut(e,t,n){return Oe(e,t,n,!1)}function ku(e,t){for(let n in e){let r=e[n];Object.defineProperty(t,n,{configurable:!0,enumerable:!0,get(){return Oe(this,n,r(this))},set(o){Oe(this,n,o)}})}return t}function $u(e,t,n){Object.defineProperty(e,t,{configurable:!0,get(){return this==null?n:Oe(this,t,n.bind(this))},set(r){Oe(this,t,r)}})}function Eu(e,t){let n=Object.getPrototypeOf(e);return t in n?void 0:n}var vn,Ie=!1,zu={configurable:!0,get(){Ie=!0}};function Z(e,t,n){let r=Object.getPrototypeOf(e._zod);if(t in r&&vn!==e._zod){vn=void 0;return}vn=e._zod,Object.defineProperty(r,t,{configurable:!0,get(){Object.defineProperty(this,t,zu);let o=Ie;Ie=!1;try{let i=n(this);return Ie?delete this[t]:Object.defineProperty(this,t,{configurable:!0,writable:!0,value:i}),Ie=Ie||o,i}catch(i){throw delete this[t],Ie=Ie||o,i}},set(o){Object.defineProperty(this,t,{configurable:!0,writable:!0,value:o})}})}function Su(e,t,n,r){let o=Eu(e,t);o&&Object.defineProperty(o,t,{configurable:!0,get(){let i={configurable:!0,writable:!0,enumerable:r,value:void 0};return Object.defineProperty(this,t,i),i.value=n(this),Object.defineProperty(this,t,i),i.value},set(i){Object.defineProperty(this,t,{configurable:!0,writable:!0,enumerable:r,value:i})}})}var bo="~constantCatch";function yo(e){let t=()=>e;return t[bo]=!0,t}var xo;var Rn={value:void 0,enumerable:!1},wo="captureStackTrace"in Error?Error:null;function Pu(e){let t=wo;if(t){let n=t.stackTraceLimit;if(typeof n=="number"){try{t.stackTraceLimit=0}catch{return wo=null,new e}try{return new e}finally{t.stackTraceLimit=n}}}return new e}function g(e,t,n,r){let o={};function i(d){this.def=d,this.constr=f,this.traits=new Set}i.prototype=o;let s=n,a=s&&new WeakSet;function c(d,h){if(d._zod){if(d._zod.traits.has(e))return}else{Rn.value=new i(h);try{Object.defineProperty(d,"_zod",Rn)}finally{Rn.value=void 0}}if(d._zod.traits.add(e),t(d,h),a){let y=Object.getPrototypeOf(d),_=d._zod.constr.prototype,k=y;for(;k&&k!==_;)k=Object.getPrototypeOf(k);let P=k??y;a.has(P)||(a.add(P),Nn(P,s))}let m=f.prototype;for(let y in m)Object.prototype.hasOwnProperty.call(m,y)&&(y in d||(d[y]=m[y].bind(d)))}let u=r?.Parent??Object;class l extends u{}Object.defineProperty(l,"name",{value:e});function f(d){let h=r?.Parent?Pu(l):this;c(h,d);let m=h._zod.deferred;if(m){for(let _ of m)_();h._zod.deferred=void 0}let y=globalThis.__zod_globalConfig?.postProcessor;return y&&y(h),h}return Object.defineProperty(f,"init",{value:c}),Object.defineProperty(f,Symbol.hasInstance,{value:d=>r?.Parent&&d instanceof r.Parent?!0:d?._zod?.traits?.has(e)}),Object.defineProperty(f,"name",{value:e}),f}var we=class extends Error{constructor(){super("Encountered Promise during synchronous parse. Use .parseAsync() instead.")}},Xe=class extends Error{constructor(t){super(`Encountered unidirectional transform during encode: ${t}`),this.name="ZodEncodeError"}};(xo=globalThis).__zod_globalConfig??(xo.__zod_globalConfig={});var pe=globalThis.__zod_globalConfig;function me(e){return e&&Object.assign(pe,e),pe}function Tu(){let e=this._zod;return e.message??(e.message=JSON.stringify(e.def,Ke,2)),e.message}function Au(e){this._zod.message=e}var Iu={get:Tu,set:Au,enumerable:!0,configurable:!0},Ln={value:void 0,enumerable:!1},vo=new WeakSet([Object.prototype,Error.prototype]),ko=(e,t)=>{e.name="$ZodError",Ln.value=t,Object.defineProperty(e,"issues",Ln),Ln.value=void 0,Object.defineProperty(e,"message",Iu);let n=Object.getPrototypeOf(e);vo.has(n)||(vo.add(n),Object.defineProperty(n,"toString",{configurable:!0,enumerable:!1,get(){let r=()=>this.message;return Object.defineProperty(this,"toString",{value:r,configurable:!0,writable:!0}),r},set(r){Object.defineProperty(this,"toString",{value:r,configurable:!0,writable:!0})}}))},$o=g("$ZodError",ko),Zd=g("$ZodError",ko,void 0,{Parent:Error});function Ou(e,t,n){return Object.prototype.hasOwnProperty.call(e,t)||(t==="__proto__"?Object.defineProperty(e,t,{value:n(),writable:!0,enumerable:!0,configurable:!0}):e[t]=n()),e[t]}function Mn(e,t=n=>n.message){let n={},r=[];for(let o of e.issues)o.path.length>0?Ou(n,o.path[0],()=>[]).push(t(o)):r.push(t(o));return{formErrors:r,fieldErrors:n}}function Dn(e,t=n=>n.message){let n={_errors:[]},r=(o,i=[])=>{for(let s of o.issues)if(s.code==="invalid_union"&&s.errors.length)s.errors.map(a=>r({issues:a},[...i,...s.path]));else if(s.code==="invalid_key")r({issues:s.issues},[...i,...s.path]);else if(s.code==="invalid_element")r({issues:s.issues},[...i,...s.path]);else{let a=[...i,...s.path];if(a.length===0)n._errors.push(t(s));else{let c=n,u=0;for(;u<a.length;){let l=a[u],f=u===a.length-1;if(l==="_errors"){f&&c._errors.push(t(s)),u++;continue}Object.prototype.hasOwnProperty.call(c,l)||Object.defineProperty(c,l,{value:{_errors:[]},enumerable:!0,writable:!0,configurable:!0});let d=c[l];f&&d._errors.push(t(s)),c=d,u++}}}};return r(e),n}function Cu(e){let t=[],n=e.map(r=>typeof r=="object"?r.key:r);for(let r of n)typeof r=="number"?t.push(`[${r}]`):typeof r=="symbol"?t.push(`[${JSON.stringify(String(r))}]`):/[^\w$]/.test(r)?t.push(`[${JSON.stringify(r)}]`):(t.length&&t.push("."),t.push(r));return t.join("")}function gt(e){let t=[],n=[...e.issues].sort((r,o)=>(r.path??[]).length-(o.path??[]).length);for(let r of n)t.push(`\u2716 ${r.message}`),r.path?.length&&t.push(`  \u2192 at ${Cu(r.path)}`);return t.join(`
`)}function Bt(e,t){return{callee:t?.callee??e,Err:t?.Err}}var jt=e=>{let t=(n,r,o,i)=>{let s=o?{...o,async:!1}:{async:!1},a=n._zod.run({value:r,issues:[]},s);if(a instanceof Promise)throw new we;if(a.issues.length){let c=new(i?.Err??e)(a.issues.map(u=>Se(u,s,me())));throw Zt(c,i?.callee??t),c}return a.value};return t};var Wt=e=>{let t=async(n,r,o,i)=>{let s=o?{...o,async:!0}:{async:!0},a=n._zod.run({value:r,issues:[]},s);if(a instanceof Promise&&(a=await a),a.issues.length){let c=new(i?.Err??e)(a.issues.map(u=>Se(u,s,me())));throw Zt(c,i?.callee??t),c}return a.value};return t};var Vt=e=>(t,n,r)=>{let o=r?{...r,async:!1}:{async:!1},i=t._zod.run({value:n,issues:[]},o);if(i instanceof Promise)throw new we;return i.issues.length?Eo(e,i.issues,o):{success:!0,data:i.value}};function Eo(e,t,n){let r;return{success:!1,get error(){return r||(r=new e(t.map(o=>Se(o,n,me()))),t=void 0,n=void 0),r},set error(o){r=o,t=void 0,n=void 0}}}var Gt=e=>async(t,n,r)=>{let o=r?{...r,async:!0}:{async:!0},i=t._zod.run({value:n,issues:[]},o);return i instanceof Promise&&(i=await i),i.issues.length?Eo(e,i.issues,o):{success:!0,data:i.value}};var Nu=Symbol.for("zod.compile.invalid"),Ru=Symbol.for("zod.compile.fallback"),Fn=((e,t,n)=>{let r=e._zod.bag.validator;if(r!==void 0){if(r(t)!==Nu)return!0;if(r.definite===!0&&n===void 0)return!1}return Zu(e,t,n)});function Zu(e,t,n){let r=n?{...n,async:!1,abortEarly:!0}:{async:!1,abortEarly:!0},o=e._zod.bag.fallbackRun,i;if(o?(r[Ru]=!0,i=o({value:t,issues:[]},r)):i=e._zod.run({value:t,issues:[]},r),i instanceof Promise)throw new we;return i.issues.length===0}var Un=async(e,t,n)=>{let r=n?{...n,async:!0,abortEarly:!0}:{async:!0,abortEarly:!0},o=e._zod.run({value:t,issues:[]},r);return o instanceof Promise&&(o=await o),o.issues.length===0},zo=e=>{let t=jt(e),n=(r,o,i,s)=>{let a=i?{...i,direction:"backward"}:{direction:"backward"};return t(r,o,a,Bt(n,s))};return n};var So=e=>{let t=jt(e),n=(r,o,i,s)=>t(r,o,i,Bt(n,s));return n};var Po=e=>{let t=Wt(e),n=async(r,o,i,s)=>{let a=i?{...i,direction:"backward"}:{direction:"backward"};return await t(r,o,a,Bt(n,s))};return n};var To=e=>{let t=Wt(e),n=async(r,o,i,s)=>await t(r,o,i,Bt(n,s));return n};var Ao=e=>(t,n,r)=>{let o=r?{...r,direction:"backward"}:{direction:"backward"};return Vt(e)(t,n,o)};var Io=e=>(t,n,r)=>Vt(e)(t,n,r);var Oo=e=>async(t,n,r)=>{let o=r?{...r,direction:"backward"}:{direction:"backward"};return Gt(e)(t,n,o)};var Co=e=>async(t,n,r)=>Gt(e)(t,n,r);var No=/^[cC][0-9a-z]{6,}$/,Ro=/^[0-9a-z]+$/,Zo=/^[0-7][0-9A-HJKMNP-TV-Za-hjkmnp-tv-z]{25}$/,Lo=/^[0-9a-vA-V]{20}$/,Mo=/^[A-Za-z0-9]{27}$/,Do=/^[a-zA-Z0-9_-]{21}$/;function Fo(e){return new RegExp(`^[a-zA-Z0-9_-]{${e}}$`)}var Uo=/^P(?:(\d+W)|(?!.*W)(?=\d|T\d)(\d+Y)?(\d+M)?(\d+D)?(T(?=\d)(\d+H)?(\d+M)?(\d+([.,]\d+)?S)?)?)$/;var Bo=/^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12})$/,jn=e=>e?new RegExp(`^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-${e}[0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12})$`):/^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$/;var jo=/^(?:[A-Za-z0-9_'+\-]+\.)*[A-Za-z0-9_'+\-]*[A-Za-z0-9_+-]@(?:[A-Za-z0-9][A-Za-z0-9\-]*\.)+[A-Za-z]{2,}$/;var Lu="^(?=[\\s\\S]*[\\p{Extended_Pictographic}\\p{Regional_Indicator}\\u20E3])[\\p{Extended_Pictographic}\\p{Emoji_Component}]+$";function Wo(){return new RegExp(Lu,"u")}var Vo=/^(?:(?:25[0-5]|2[0-4][0-9]|1[0-9][0-9]|[1-9][0-9]|[0-9])\.){3}(?:25[0-5]|2[0-4][0-9]|1[0-9][0-9]|[1-9][0-9]|[0-9])$/,Go=/^(([0-9a-fA-F]{1,4}:){7}[0-9a-fA-F]{1,4}|([0-9a-fA-F]{1,4}:){1,7}:|([0-9a-fA-F]{1,4}:){1,6}:[0-9a-fA-F]{1,4}|([0-9a-fA-F]{1,4}:){1,5}(:[0-9a-fA-F]{1,4}){1,2}|([0-9a-fA-F]{1,4}:){1,4}(:[0-9a-fA-F]{1,4}){1,3}|([0-9a-fA-F]{1,4}:){1,3}(:[0-9a-fA-F]{1,4}){1,4}|([0-9a-fA-F]{1,4}:){1,2}(:[0-9a-fA-F]{1,4}){1,5}|[0-9a-fA-F]{1,4}:((:[0-9a-fA-F]{1,4}){1,6})|:((:[0-9a-fA-F]{1,4}){1,7}|:))$/;var Jo=/^((25[0-5]|2[0-4][0-9]|1[0-9][0-9]|[1-9][0-9]|[0-9])\.){3}(25[0-5]|2[0-4][0-9]|1[0-9][0-9]|[1-9][0-9]|[0-9])\/([0-9]|[1-2][0-9]|3[0-2])$/,Ho=/^(([0-9a-fA-F]{1,4}:){7}[0-9a-fA-F]{1,4}|([0-9a-fA-F]{1,4}:){1,7}:|([0-9a-fA-F]{1,4}:){1,6}:[0-9a-fA-F]{1,4}|([0-9a-fA-F]{1,4}:){1,5}(:[0-9a-fA-F]{1,4}){1,2}|([0-9a-fA-F]{1,4}:){1,4}(:[0-9a-fA-F]{1,4}){1,3}|([0-9a-fA-F]{1,4}:){1,3}(:[0-9a-fA-F]{1,4}){1,4}|([0-9a-fA-F]{1,4}:){1,2}(:[0-9a-fA-F]{1,4}){1,5}|[0-9a-fA-F]{1,4}:((:[0-9a-fA-F]{1,4}){1,6})|:((:[0-9a-fA-F]{1,4}){1,7}|:))\/(12[0-8]|1[01][0-9]|[1-9]?[0-9])$/,qo=/^$|^(?:[0-9a-zA-Z+/]{4})*(?:(?:[0-9a-zA-Z+/]{2}==)|(?:[0-9a-zA-Z+/]{3}=))?$/,Ko=/^(?:[A-Za-z0-9_-]{4})*(?:[A-Za-z0-9_-]{2,3})?$/;var Yo=/^https?$/,Xo=/^\+[1-9]\d{6,14}$/;var Qo="(?:(?:\\d\\d[2468][048]|\\d\\d[13579][26]|\\d\\d0[48]|[02468][048]00|[13579][26]00)-02-29|\\d{4}-(?:(?:0[13578]|1[02])-(?:0[1-9]|[12]\\d|3[01])|(?:0[469]|11)-(?:0[1-9]|[12]\\d|30)|(?:02)-(?:0[1-9]|1\\d|2[0-8])))";function Mu(e){return new RegExp(`^${e}$`)}var ei=Mu(Qo);function Bn(e){let t="(?:[01]\\d|2[0-3]):[0-5]\\d";return typeof e.precision=="number"?e.precision===-1?`${t}`:e.precision===0?`${t}:[0-5]\\d`:`${t}:[0-5]\\d\\.\\d{${e.precision}}`:e.seconds?`${t}:[0-5]\\d(?:\\.\\d+)?`:`${t}(?::[0-5]\\d(?:\\.\\d+)?)?`}function ti(e){return new RegExp(`^${Bn(e)}$`)}function ni(e){let t=["Z"];e.offset&&t.push("([+-](?:[01]\\d|2[0-3]):[0-5]\\d)");let n=`${Bn({precision:e.precision,seconds:!0})}(?:${t.join("|")})`,r=e.local?`${n}|${Bn({precision:e.precision})}`:n;return new RegExp(`^${Qo}T(?:${r})$`)}var ri=/^[\s\S]{0,}$/;var Wn=/^-?\d+$/,Jt=/^-?\d+(?:\.\d+)?$/,oi=/^(?:true|false)$/i;var ii=/^[^A-Z]*$/,si=/^[^a-z]*$/;var re=g("$ZodCheck",(e,t)=>{var n;e._zod??(e._zod={}),e._zod.def=t,(n=e._zod).onattach??(n.onattach=[])});var Vn=e=>{let t=e.value;return!En(t)&&t.length!==void 0},Ht={number:"number",bigint:"bigint",object:"date"},Gn=g("$ZodCheckLessThan",(e,t)=>{re.init(e,t);let n=Ht[typeof t.value];e._zod.check=r=>{(t.inclusive?r.value<=t.value:r.value<t.value)||r.issues.push({origin:Ht[typeof r.value]??n,code:"too_big",maximum:typeof t.value=="object"?t.value.getTime():t.value,input:r.value,inclusive:t.inclusive,inst:e,continue:!t.abort})}}),Jn=g("$ZodCheckGreaterThan",(e,t)=>{re.init(e,t);let n=Ht[typeof t.value];e._zod.check=r=>{(t.inclusive?r.value>=t.value:r.value>t.value)||r.issues.push({origin:Ht[typeof r.value]??n,code:"too_small",minimum:typeof t.value=="object"?t.value.getTime():t.value,input:r.value,inclusive:t.inclusive,inst:e,continue:!t.abort})}}),ai=g("$ZodCheckMultipleOf",(e,t)=>{re.init(e,t),e._zod.check=n=>{if(typeof n.value!=typeof t.value)throw new Error("Cannot mix number and bigint in multiple_of check.");(typeof n.value=="bigint"?t.value!==BigInt(0)&&n.value%t.value===BigInt(0):zn(n.value,t.value)===0)||n.issues.push({origin:typeof n.value,code:"not_multiple_of",divisor:t.value,input:n.value,inst:e,continue:!t.abort})}}),ci=g("$ZodCheckNumberFormat",(e,t)=>{re.init(e,t),t.format=t.format||"float64";let n=t.format?.includes("int"),r=n?"int":"number",[o,i]=dt[t.format];e._zod.check=s=>{let a=s.value;if(n){if(!Number.isInteger(a)){s.issues.push({expected:r,format:t.format,code:"invalid_type",continue:!1,input:a,inst:e});return}if(!Number.isSafeInteger(a)){a>0?s.issues.push({input:a,code:"too_big",maximum:Number.MAX_SAFE_INTEGER,note:"Integers must be within the safe integer range.",inst:e,origin:r,inclusive:!0,continue:!t.abort}):s.issues.push({input:a,code:"too_small",minimum:Number.MIN_SAFE_INTEGER,note:"Integers must be within the safe integer range.",inst:e,origin:r,inclusive:!0,continue:!t.abort});return}}a<o&&s.issues.push({origin:"number",input:a,code:"too_small",minimum:o,inclusive:!0,inst:e,continue:!t.abort}),a>i&&s.issues.push({origin:"number",input:a,code:"too_big",maximum:i,inclusive:!0,inst:e,continue:!t.abort})}});var ui=g("$ZodCheckMaxLength",(e,t)=>{var n;re.init(e,t),(n=e._zod.def).when??(n.when=Vn),e._zod.check=r=>{let o=r.value,i=o.length;if((typeof o=="string"&&i>t.maximum?ht(o):i)<=t.maximum)return;let a=mt(o);r.issues.push({origin:a,code:"too_big",maximum:t.maximum,inclusive:!0,input:o,inst:e,continue:!t.abort})}}),li=g("$ZodCheckMinLength",(e,t)=>{var n;re.init(e,t),(n=e._zod.def).when??(n.when=Vn),e._zod.check=r=>{let o=r.value,i=o.length;if((typeof o=="string"&&i>=t.minimum&&i<t.minimum*2?ht(o):i)>=t.minimum)return;let a=mt(o);r.issues.push({origin:a,code:"too_small",minimum:t.minimum,inclusive:!0,input:o,inst:e,continue:!t.abort})}}),pi=g("$ZodCheckLengthEquals",(e,t)=>{var n;re.init(e,t),(n=e._zod.def).when??(n.when=Vn),e._zod.check=r=>{let o=r.value,i=o.length,s=typeof o=="string"&&i>=t.length&&i<=t.length*2?ht(o):i;if(s===t.length)return;let a=mt(o),c=s>t.length;r.issues.push({origin:a,...c?{code:"too_big",maximum:t.length}:{code:"too_small",minimum:t.length},inclusive:!0,exact:!0,input:r.value,inst:e,continue:!t.abort})}}),_t=g("$ZodCheckStringFormat",(e,t)=>{var n,r;re.init(e,t),t.pattern?(n=e._zod).check??(n.check=o=>{t.pattern.lastIndex=0,!t.pattern.test(o.value)&&o.issues.push({origin:"string",code:"invalid_format",format:t.format,input:o.value,...t.pattern?{pattern:t.pattern.toString()}:{},inst:e,continue:!t.abort})}):(r=e._zod).check??(r.check=()=>{})}),di=g("$ZodCheckRegex",(e,t)=>{_t.init(e,t),e._zod.check=n=>{t.pattern.lastIndex=0,!t.pattern.test(n.value)&&n.issues.push({origin:"string",code:"invalid_format",format:"regex",input:n.value,pattern:t.pattern.toString(),inst:e,continue:!t.abort})}}),fi=g("$ZodCheckLowerCase",(e,t)=>{t.pattern??(t.pattern=ii),_t.init(e,t)}),hi=g("$ZodCheckUpperCase",(e,t)=>{t.pattern??(t.pattern=si),_t.init(e,t)}),mi=g("$ZodCheckIncludes",(e,t)=>{re.init(e,t);let n=Ue(t.includes),r=new RegExp(typeof t.position=="number"?`^.{${t.position},}${n}`:n);t.pattern=r,e._zod.check=o=>{o.value.includes(t.includes,t.position)||o.issues.push({origin:"string",code:"invalid_format",format:"includes",includes:t.includes,input:o.value,inst:e,continue:!t.abort})}}),gi=g("$ZodCheckStartsWith",(e,t)=>{re.init(e,t);let n=new RegExp(`^${Ue(t.prefix)}.*`);t.pattern??(t.pattern=n),e._zod.check=r=>{r.value.startsWith(t.prefix)||r.issues.push({origin:"string",code:"invalid_format",format:"starts_with",prefix:t.prefix,input:r.value,inst:e,continue:!t.abort})}}),_i=g("$ZodCheckEndsWith",(e,t)=>{re.init(e,t);let n=new RegExp(`.*${Ue(t.suffix)}$`);t.pattern??(t.pattern=n),e._zod.check=r=>{r.value.endsWith(t.suffix)||r.issues.push({origin:"string",code:"invalid_format",format:"ends_with",suffix:t.suffix,input:r.value,inst:e,continue:!t.abort})}});var bi=g("$ZodCheckOverwrite",(e,t)=>{re.init(e,t),e._zod.check=n=>{n.value=t.tx(n.value)}});var qt=class{constructor(t=[],n={}){this.content=[],this.indent=0,this.args=t,this.closed=n}indented(t){this.indent+=1;try{t(this)}finally{this.indent-=1}}write(t){if(typeof t=="function"){t(this,{execution:"sync"}),t(this,{execution:"async"});return}let r=t.split(`
`).filter(s=>s),o=Math.min(...r.map(s=>s.length-s.trimStart().length)),i=r.map(s=>s.slice(o)).map(s=>" ".repeat(this.indent*2)+s);for(let s of i)this.content.push(s)}compile(){let t=Function,n=this?.content??[""];return new t(...Object.keys(this.closed),`return function (${this.args.join(", ")}) {
${n.join(`
`)}
};`)(...Object.values(this.closed))}};var xi={major:4,minor:6,patch:5};var V=g("$ZodType",(e,t)=>{var n;e??(e={}),e._zod.def=t,e._zod.bag=e._zod.bag||{},e._zod.version=xi;let r=e._zod.def.checks,o=e._zod.traits.has("$ZodCheck")?[e,...r??[]]:r?.length?[...r]:[];for(let i of o)for(let s of i._zod.onattach)s(e);if(o.length===0)(n=e._zod).deferred??(n.deferred=[]),e._zod.deferred?.push(()=>{e._zod.run=e._zod.parse});else{let i=(a,c,u)=>{if(a.memo)return a;let l=xe(a),f;for(let d of c){if(d._zod.def.when){if(On(a)||!d._zod.def.when(a))continue}else if(l)continue;let h=a.issues.length,m=d._zod.check(a);if(m instanceof Promise&&u?.async===!1)throw new we;if(f||m instanceof Promise)f=(f??Promise.resolve()).then(async()=>{await m,a.issues.length!==h&&(Ft(a.issues,h,e),l||(l=xe(a,h)))});else{if(a.issues.length===h)continue;Ft(a.issues,h,e),l||(l=xe(a,h))}}return f?f.then(()=>a):a},s=(a,c,u)=>{if(xe(a))return a.aborted=!0,a;let l=i(c,o,u);if(l instanceof Promise){if(u.async===!1)throw new we;return l.then(f=>e._zod.parse(f,u))}return e._zod.parse(l,u)};e._zod.run=(a,c)=>{if(c.skipChecks)return e._zod.parse(a,c);if(c.direction==="backward"){let l=e._zod.parse({value:a.value,issues:[]},{...c,skipChecks:!0});return l instanceof Promise?l.then(f=>s(f,a,c)):s(l,a,c)}let u=e._zod.parse(a,c);if(u instanceof Promise){if(c.async===!1)throw new we;return u.then(l=>i(l,o,c))}return i(u,o,c)}}},{get"~standard"(){return Ut(this,"~standard",qn(this))},set"~standard"(e){Oe(this,"~standard",e)}}),Ii=(e,t)=>e.issues.length?{issues:e.issues.map(n=>Se(n,t,me()))}:{value:e.value};async function Du(e,t){let n={async:!0};return Ii(await e._zod.run({value:t,issues:[]},n),n)}function qn(e){return{validate:t=>{let n={async:!1};try{let r=e._zod.run({value:t,issues:[]},n);if(!(r instanceof Promise))return Ii(r,n)}catch{}return Du(e,t)},vendor:"zod",version:1}}var Qt=g("$ZodString",(e,t)=>{V.init(e,t),e._zod.pattern=t.pattern??ri,e._zod.parse=(n,r)=>{if(t.coerce)try{n.value=String(n.value)}catch{}return typeof n.value=="string"||n.issues.push({expected:"string",code:"invalid_type",input:n.value,inst:e}),n}}),B=g("$ZodStringFormat",(e,t)=>{_t.init(e,t),Qt.init(e,t)}),Oi=g("$ZodGUID",(e,t)=>{t.pattern??(t.pattern=Bo),B.init(e,t)}),Ci=g("$ZodUUID",(e,t)=>{if(t.version){let r={v1:1,v2:2,v3:3,v4:4,v5:5,v6:6,v7:7,v8:8}[t.version];if(r===void 0)throw new Error(`Invalid UUID version: "${t.version}"`);t.pattern??(t.pattern=jn(r))}else t.pattern??(t.pattern=jn());B.init(e,t)}),Ni=g("$ZodEmail",(e,t)=>{t.pattern??(t.pattern=jo),B.init(e,t)}),Ri=1,Yt=2;function Zi(e){try{return typeof URL<"u"&&typeof URL.canParse=="function"?URL.canParse(e):(new URL(e),!0)}catch{return!1}}function Fu(e,t){return!("normalize"in t)&&!("hostname"in t)&&!("protocol"in t)?Zi(e)||Yt:Uu(e,t)}function Uu(e,t){if(!t.normalize&&t.protocol?.source===Yo.source&&!/^https?:\/\//i.test(e))return Ri;try{if(typeof URL<"u"){let n=URL;if(typeof n.parse=="function")return n.parse(e)??Yt}return new URL(e)}catch{return Yt}}var Bu=/[\t\n\r]/g;function wi(e){return e.replace(Bu,"")}function ju(e,t){return t.lastIndex=0,t.test(e.hostname)}function Wu(e,t){return t.lastIndex=0,t.test(e.protocol.endsWith(":")?e.protocol.slice(0,-1):e.protocol)}var Li=g("$ZodURL",(e,t)=>{B.init(e,t),e._zod.check=n=>{try{let r=n.value.trim(),o=Fu(r,t);if(o===Ri){n.issues.push({code:"invalid_format",format:"url",note:"Invalid URL format",input:n.value,inst:e,continue:!t.abort});return}if(o===Yt){n.issues.push({code:"invalid_format",format:"url",input:n.value,inst:e,continue:!t.abort});return}if(o===!0){n.value=wi(r);return}t.hostname&&!ju(o,t.hostname)&&n.issues.push({code:"invalid_format",format:"url",note:"Invalid hostname",pattern:t.hostname.source,input:n.value,inst:e,continue:!t.abort}),t.protocol&&!Wu(o,t.protocol)&&n.issues.push({code:"invalid_format",format:"url",note:"Invalid protocol",pattern:t.protocol.source,input:n.value,inst:e,continue:!t.abort}),n.value=t.normalize?o.href:wi(r);return}catch{n.issues.push({code:"invalid_format",format:"url",input:n.value,inst:e,continue:!t.abort})}}}),Mi=g("$ZodEmoji",(e,t)=>{t.pattern??(t.pattern=Wo()),B.init(e,t)}),Di=g("$ZodNanoID",(e,t)=>{if(t.length!==void 0&&(!Number.isInteger(t.length)||t.length<1))throw new Error(`Invalid nanoid length: ${t.length}`);t.pattern??(t.pattern=t.length===void 0?Do:Fo(t.length)),B.init(e,t)}),Fi=g("$ZodCUID",(e,t)=>{t.pattern??(t.pattern=No),B.init(e,t)}),Ui=g("$ZodCUID2",(e,t)=>{t.pattern??(t.pattern=Ro),B.init(e,t)}),Bi=g("$ZodULID",(e,t)=>{t.pattern??(t.pattern=Zo),B.init(e,t)}),ji=g("$ZodXID",(e,t)=>{t.pattern??(t.pattern=Lo),B.init(e,t)}),Wi=g("$ZodKSUID",(e,t)=>{t.pattern??(t.pattern=Mo),B.init(e,t)}),Vi=g("$ZodISODateTime",(e,t)=>{t.pattern??(t.pattern=ni(t)),B.init(e,t)}),Gi=g("$ZodISODate",(e,t)=>{t.pattern??(t.pattern=ei),B.init(e,t)}),Ji=g("$ZodISOTime",(e,t)=>{t.pattern??(t.pattern=ti(t)),B.init(e,t)}),Hi=g("$ZodISODuration",(e,t)=>{t.pattern??(t.pattern=Uo),B.init(e,t)}),qi=g("$ZodIPv4",(e,t)=>{t.pattern??(t.pattern=Vo),B.init(e,t)}),Vu=/^[0-9a-fA-F:.]+$/;function Ki(e){return Vu.test(e)?Zi(`http://[${e}]`):!1}var Yi=g("$ZodIPv6",(e,t)=>{t.pattern??(t.pattern=Go),B.init(e,t),e._zod.check=n=>{Ki(n.value)||n.issues.push({code:"invalid_format",format:"ipv6",input:n.value,inst:e,continue:!t.abort})}});var Xi=g("$ZodCIDRv4",(e,t)=>{t.pattern??(t.pattern=Jo),B.init(e,t)});function Gu(e){let t=e.split("/");if(t.length!==2)return!1;let[n,r]=t;if(!r)return!1;let o=Number(r);return`${o}`!==r||o<0||o>128?!1:Ki(n)}var Qi=g("$ZodCIDRv6",(e,t)=>{t.pattern??(t.pattern=Ho),B.init(e,t),e._zod.check=n=>{Gu(n.value)||n.issues.push({code:"invalid_format",format:"cidrv6",input:n.value,inst:e,continue:!t.abort})}});function es(e){if(e==="")return!0;if(/\s/.test(e)||e.length%4!==0)return!1;try{return atob(e),!0}catch{return!1}}var Kn=/^[0-9a-zA-Z+/]*={0,2}$/,ts=g("$ZodBase64",(e,t)=>{t.pattern??(t.pattern=Kn),B.init(e,t),e._zod.check=n=>{es(n.value)||n.issues.push({code:"invalid_format",format:"base64",input:n.value,inst:e,continue:!t.abort})}}),en=/^[A-Za-z0-9_-]*$/;function Ju(e){if(!en.test(e))return!1;let t=e.replace(/[-_]/g,r=>r==="-"?"+":"/"),n=t.padEnd(Math.ceil(t.length/4)*4,"=");return es(n)}var ns=g("$ZodBase64URL",(e,t)=>{t.pattern??(t.pattern=en),B.init(e,t),e._zod.check=n=>{Ju(n.value)||n.issues.push({code:"invalid_format",format:"base64url",input:n.value,inst:e,continue:!t.abort})}}),rs=g("$ZodE164",(e,t)=>{t.pattern??(t.pattern=Xo),B.init(e,t)});function Hu(e,t=null){try{let n=e.split(".");if(n.length!==3)return!1;let[r]=n;if(!r)return!1;let o=JSON.parse(atob(r));return!("typ"in o&&o?.typ!=="JWT"||!o.alg||t&&(!("alg"in o)||o.alg!==t))}catch{return!1}}var os=g("$ZodJWT",(e,t)=>{B.init(e,t),e._zod.check=n=>{Hu(n.value,t.alg)||n.issues.push({code:"invalid_format",format:"jwt",input:n.value,inst:e,continue:!t.abort})}});var Yn=g("$ZodNumber",(e,t)=>{V.init(e,t),e._zod.pattern=Jt,e._zod.parse=(n,r)=>{if(t.coerce)try{n.value=Number(n.value)}catch{}let o=n.value;if(typeof o=="number"&&!Number.isNaN(o)&&Number.isFinite(o))return n;let i=typeof o=="number"?Number.isNaN(o)?"NaN":Number.isFinite(o)?void 0:String(o):void 0;return n.issues.push({expected:"number",code:"invalid_type",input:o,inst:e,...i?{received:i}:{}}),n}}),is=g("$ZodNumberFormat",(e,t)=>{ci.init(e,t),Yn.init(e,t)}),ss=g("$ZodBoolean",(e,t)=>{V.init(e,t),e._zod.pattern=oi,e._zod.parse=(n,r)=>{if(t.coerce)try{n.value=!!n.value}catch{}let o=n.value;return typeof o=="boolean"||n.issues.push({expected:"boolean",code:"invalid_type",input:o,inst:e}),n}});var as=g("$ZodUnknown",(e,t)=>{V.init(e,t),e._zod.parse=n=>n}),cs=g("$ZodNever",(e,t)=>{V.init(e,t),e._zod.parse=(n,r)=>(n.issues.push({expected:"never",code:"invalid_type",input:n.value,inst:e}),n)});function vi(e,t,n){e.issues.length&&t.issues.push(...ft(n,e.issues)),t.value[n]=e.value}var us=g("$ZodArray",(e,t)=>{V.init(e,t);let n=pe.memoizer;n?.attach(e),e._zod.parse=(r,o)=>{let i=r.value;if(!Array.isArray(i))return r.issues.push({expected:"array",code:"invalid_type",input:i,inst:e}),r;r.value=n?n.alloc(e,r,Array(i.length),o):Array(i.length);let s=[],a=o?.abortEarly;for(let c=0;c<i.length;c++){let u=i[c],l=t.element._zod.run({value:u,issues:[]},o);if(l instanceof Promise)s.push(l.then(f=>vi(f,r,c)));else if(vi(l,r,c),a&&l.issues.length!==0&&xe(l))break}return s.length?Promise.all(s).then(()=>r):r}});function Xt(e,t,n,r,o,i){let s=n in r,a=i==="optional";if(!(!s&&a&&o==="optional")){if(e.issues.length){if(o!==void 0&&a&&!s)return;t.issues.push(...ft(n,e.issues))}if(!s&&o===void 0){e.issues.length||t.issues.push({code:"invalid_type",expected:"nonoptional",input:void 0,path:[n]});return}e.value===void 0?(s||o==="defaulted"&&!a)&&(t.value[n]=void 0):t.value[n]=e.value}}var qu=[];function ls(e){let t=Object.keys(e.shape),n=Object.getOwnPropertySymbols(e.shape),r=n.length?n:qu,o=r.length?[...t,...r]:t;for(let s of o)if(!e.shape?.[s]?._zod?.traits?.has("$ZodType"))throw new Error(`Invalid element at key "${String(s)}": expected a Zod schema`);let i=In(e.shape);return{...e,allKeys:o,symbolKeys:r,keySet:new Set(t),numKeys:t.length,optionalKeys:new Set(i)}}function ps(e,t,n,r,o,i,s){let a=[],c=o.keySet,u=o.catchall._zod,l=u.def.type,f=u.optin,d=u.optout,h=0;for(let m in t){if(s&&n.issues.length!==h){if(xe(n,h))break;h=n.issues.length}if(c.has(m))continue;if(m==="__proto__"){l==="never"&&a.push(m);continue}if(l==="never"){a.push(m);continue}let y=u.run({value:t[m],issues:[]},r);y instanceof Promise?e.push(y.then(_=>Xt(_,n,m,t,f,d))):Xt(y,n,m,t,f,d)}return a.length&&n.issues.push({code:"unrecognized_keys",keys:a,input:t,inst:i,continue:!0}),e.length?Promise.all(e).then(()=>n):n}var Ku=g("$ZodObject",(e,t)=>{V.init(e,t);let n=Object.getOwnPropertyDescriptor(t,"shape"),r=n?.get?n.get.raw:t.shape??{};if(r){let u=()=>{let l={...r};return Object.defineProperty(t,"shape",{value:l}),u.raw=l,l};u.raw=r,Object.defineProperty(t,"shape",{get:u})}let o=ut(()=>ls(t));Z(e,"propValues",u=>{let l=u.def.shape,f={};for(let d in l){let h=l[d]._zod;if(h.values){Object.prototype.hasOwnProperty.call(f,d)||le(f,d,new Set);for(let m of h.values)f[d].add(m);h.optin!==void 0&&f[d].add(void 0)}}return f});let i=He,s=t.catchall,a,c=pe.memoizer;c?.attach(e),e._zod.parse=(u,l)=>{a??(a=o.value);let f=u.value;if(!i(f))return u.issues.push({expected:"object",code:"invalid_type",input:f,inst:e}),u;u.value=c?c.alloc(e,u,{},l):{};let d=[],h=a.shape,m=l?.abortEarly,y=u.issues.length;for(let _ of a.allKeys){if(m&&u.issues.length!==y){if(xe(u,y))break;y=u.issues.length}if(_==="__proto__")continue;let k=h[_],P=k._zod.optin,D=k._zod.optout,v=k._zod.run({value:f[_],issues:[]},l);v instanceof Promise?d.push(v.then($=>Xt($,u,_,f,P,D))):Xt(v,u,_,f,P,D)}return s?ps(d,f,u,l,o.value,e,m===!0):d.length?Promise.all(d).then(()=>u):u}}),ds=g("$ZodObjectJIT",(e,t)=>{Ku.init(e,t);let n=e._zod.parse,r=ut(()=>ls(t)),o=pe.memoizer,i=h=>{let m=r.value,y=m.symbolKeys,_=new qt(["payload","ctx"],{shape:h,inst:e,memo:o,syms:y}),k=$=>`shape[${$}]._zod.run({ value: input[${$}], issues: [] }, ctx)`,P=($,T)=>`
          let ${$}_ab = false;
          for (let i = 0; i < ${$}.issues.length; i++) {
            const iss = ${$}.issues[i];
            iss.path = iss.path ? [${T}, ...iss.path] : [${T}];
            payload.issues.push(iss);
            if (iss.continue !== true) ${$}_ab = true;
          }
          if (${$}_ab && ctx && ctx.abortEarly) {
            payload.value = newResult;
            return payload;
          }`;_.write("const input = payload.value;");let D=Object.create(null),v=0;for(let $ of m.allKeys)D[$]=`key_${v++}`;_.write(o?"const newResult = memo.alloc(inst, payload, {}, ctx);":"const newResult = {};");for(let $ of m.allKeys){if($==="__proto__")continue;let T=D[$],O=typeof $=="symbol"?`syms[${y.indexOf($)}]`:Sn($),ce=`${O} in input`,te=h[$],Y=te?._zod?.optin,G=Y!==void 0,X=te?._zod?.optout==="optional";if(_.write(`const ${T} = ${k(O)};`),G&&X){let Le=Y==="optional"?`${T}_present`:`${T}.value !== undefined || ${T}_present`;_.write(`
        const ${T}_present = ${ce};
        if (!${T}.issues.length || ${T}_present) {
          if (${T}.issues.length) {${P(T,O)}
          }

          if (${Le}) {
            newResult[${O}] = ${T}.value;
          }
        }

      `)}else G?(_.write(`
        if (${T}.issues.length) {${P(T,O)}
        }
      `),Y==="defaulted"?_.write(`newResult[${O}] = ${T}.value;`):_.write(`
        if (${T}.value !== undefined || ${ce}) {
          newResult[${O}] = ${T}.value;
        }
      `)):_.write(`
        const ${T}_present = ${ce};
        if (${T}.issues.length) {${P(T,O)}
        }
        if (!${T}_present && !${T}.issues.length) {
          payload.issues.push({
            code: "invalid_type",
            expected: "nonoptional",
            input: undefined,
            path: [${O}]
          });
          if (ctx && ctx.abortEarly) {
            payload.value = newResult;
            return payload;
          }
        }

        if (${T}_present) {
          newResult[${O}] = ${T}.value;
        }

      `)}return _.write("payload.value = newResult;"),_.write("return payload;"),_.compile()},s,a=He,c=!pe.jitless,l=c&&Tn.value,f=t.catchall,d;e._zod.parse=(h,m)=>{d??(d=r.value);let y=h.value;return a(y)?c&&l&&m?.async===!1&&m.jitless!==!0?(s||(s=i(t.shape)),h=s(h,m),f?ps([],y,h,m,d,e,m?.abortEarly===!0):h):n(h,m):(h.issues.push({expected:"object",code:"invalid_type",input:y,inst:e}),h)}});function ki(e,t,n,r){for(let i of e)if(i.issues.length===0)return t.value=i.value,t;let o=e.filter(i=>!xe(i));return o.length===1?(t.value=o[0].value,o[0]):(t.issues.push({code:"invalid_union",input:t.value,inst:n,errors:e.map(i=>i.issues.map(s=>Se(s,r,me())))}),t)}var fs=g("$ZodUnion",(e,t)=>{V.init(e,t),Z(e,"optin",r=>r.def.options.some(o=>o._zod.optin==="defaulted")?"defaulted":r.def.options.some(o=>o._zod.optin!==void 0)?"optional":void 0),Z(e,"optout",r=>r.def.options.some(o=>o._zod.optout==="optional")?"optional":void 0),Z(e,"values",r=>{if(r.def.options.every(o=>o._zod.values))return new Set(r.def.options.flatMap(o=>Array.from(o._zod.values)))}),Z(e,"pattern",r=>{if(r.def.options.every(o=>o._zod.pattern)){let o=r.def.options.map(i=>i._zod.pattern);return new RegExp(`^(${o.map(i=>lt(i.source)).join("|")})$`)}});let n=t.options.length===1?t.options[0]._zod.run:null;e._zod.parse=(r,o)=>{if(n)return n(r,o);let i=!1,s=[];for(let a of t.options){let c=a._zod.run({value:r.value,issues:[]},o);if(c instanceof Promise)s.push(c),i=!0;else{if(c.issues.length===0)return c;s.push(c)}}return i?Promise.all(s).then(a=>ki(a,r,e,o)):ki(s,r,e,o)}});var hs=g("$ZodIntersection",(e,t)=>{V.init(e,t),e._zod.parse=(n,r)=>{let o=n.value,i=t.left._zod.run({value:o,issues:[]},r),s=t.right._zod.run({value:o,issues:[]},r);return i instanceof Promise||s instanceof Promise?Promise.all([i,s]).then(([c,u])=>$i(n,c,u)):$i(n,i,s)}});function Hn(e,t){if(e===t)return{valid:!0,data:e};if(e instanceof Date&&t instanceof Date&&+e==+t)return{valid:!0,data:e};if(Fe(e)&&Fe(t)){let n=Object.keys(t),r=Object.keys(e).filter(i=>n.indexOf(i)!==-1),o={...e,...t};Object.prototype.hasOwnProperty.call(o,"__proto__")&&delete o.__proto__;for(let i of r){if(i==="__proto__")continue;let s=Hn(e[i],t[i]);if(!s.valid)return{valid:!1,mergeErrorPath:[i,...s.mergeErrorPath]};o[i]=s.data}return{valid:!0,data:o}}if(Array.isArray(e)&&Array.isArray(t)){if(e.length!==t.length)return{valid:!1,mergeErrorPath:[]};let n=[];for(let r=0;r<e.length;r++){let o=e[r],i=t[r],s=Hn(o,i);if(!s.valid)return{valid:!1,mergeErrorPath:[r,...s.mergeErrorPath]};n.push(s.data)}return{valid:!0,data:n}}return{valid:!1,mergeErrorPath:[]}}function $i(e,t,n){let r=new Map,o,i=new Map,s=(u,l)=>{let f;if(u.code==="unrecognized_keys"&&!u.path?.length)o??(o=u),f=u.keys;else if(u.code==="invalid_key"&&u.origin==="record"&&u.path?.length===1){let d=String(u.path[0]);i.has(d)||i.set(d,u),f=[d]}else return!1;for(let d of f)r.has(d)||r.set(d,{}),r.get(d)[l]=!0;return!0};for(let u of t.issues)s(u,"l")||e.issues.push(u);for(let u of n.issues)s(u,"r")||e.issues.push(u);let a=[...r].filter(([,u])=>u.l&&u.r).map(([u])=>u);if(a.length){let u=o?a.filter(l=>o.keys.includes(l)):[];u.length&&e.issues.push({...o,keys:u});for(let l of a)!u.includes(l)&&i.has(l)&&e.issues.push(i.get(l))}let c=Hn(t.value,n.value);if(!c.valid){if(xe(e))return e;throw new Error(`Unmergable intersection. Error path: ${JSON.stringify(c.mergeErrorPath)}`)}return e.value=c.data,e}var ms=g("$ZodEnum",(e,t)=>{V.init(e,t);let n=qe(t.entries),r=new Set(n);e._zod.values=r,Z(e,"pattern",o=>{let i=qe(o.def.entries).filter(s=>An.has(typeof s));return new RegExp(i.length?`^(${i.map(s=>Ue(s.toString())).join("|")})$`:"^[^\\s\\S]$")}),e._zod.parse=(o,i)=>{let s=o.value;return r.has(s)||o.issues.push({code:"invalid_value",values:n,input:s,inst:e}),o}});var gs=g("$ZodTransform",(e,t)=>{V.init(e,t),e._zod.optin="optional",pe.memoizer?.guard(e),e._zod.parse=(n,r)=>{if(r.direction==="backward")throw new Xe(e.constructor.name);let o=t.transform(n.value,n);if(r.async)return(o instanceof Promise?o:Promise.resolve(o)).then(s=>(n.value=s,n));if(o instanceof Promise)throw new we;return n.value=o,n}});function Ei(e,t){return e.value=t.issues.length?void 0:t.value,e}var Xn=g("$ZodOptional",(e,t)=>{V.init(e,t),Z(e,"optin",n=>n.def.innerType._zod.optin==="defaulted"?"defaulted":"optional"),e._zod.optout="optional",Z(e,"values",n=>{let r=n.def.innerType._zod.values;return r?new Set([...r,void 0]):void 0}),Z(e,"pattern",n=>{let r=n.def.innerType._zod.pattern;return r?new RegExp(`^(${lt(r.source)})?$`):void 0}),e._zod.parse=(n,r)=>{if(n.value===void 0){if(t.innerType._zod.optin!=="defaulted")return n;let o=t.innerType._zod.run({value:n.value,issues:[]},r);return o instanceof Promise?o.then(i=>Ei(n,i)):Ei(n,o)}return t.innerType._zod.run(n,r)}}),_s=g("$ZodExactOptional",(e,t)=>{Xn.init(e,t),Z(e,"values",n=>n.def.innerType._zod.values),Z(e,"pattern",n=>n.def.innerType._zod.pattern),e._zod.parse=(n,r)=>t.innerType._zod.run(n,r)}),bs=g("$ZodNullable",(e,t)=>{V.init(e,t),Z(e,"optin",n=>n.def.innerType._zod.optin),Z(e,"optout",n=>n.def.innerType._zod.optout),Z(e,"pattern",n=>{let r=n.def.innerType._zod.pattern;return r?new RegExp(`^(${lt(r.source)}|null)$`):void 0}),Z(e,"values",n=>n.def.innerType._zod.values?new Set([...n.def.innerType._zod.values,null]):void 0),e._zod.parse=(n,r)=>n.value===null?n:t.innerType._zod.run(n,r)}),ys=g("$ZodDefault",(e,t)=>{V.init(e,t),e._zod.optin="defaulted",Z(e,"values",n=>n.def.innerType._zod.values),e._zod.parse=(n,r)=>{if(r.direction==="backward")return t.innerType._zod.run(n,r);if(n.value===void 0)return n.value=t.defaultValue,n;let o=t.innerType._zod.run(n,r);return o instanceof Promise?o.then(i=>zi(i,t)):zi(o,t)}});function zi(e,t){return e.value===void 0&&(e.value=t.defaultValue),e}var xs=g("$ZodPrefault",(e,t)=>{V.init(e,t),e._zod.optin="defaulted",Z(e,"values",n=>n.def.innerType._zod.values),e._zod.parse=(n,r)=>(r.direction==="backward"||n.value===void 0&&(n.value=t.defaultValue),t.innerType._zod.run(n,r))}),ws=g("$ZodNonOptional",(e,t)=>{V.init(e,t),Z(e,"values",n=>{let r=n.def.innerType._zod.values;return r?new Set([...r].filter(o=>o!==void 0)):void 0}),e._zod.parse=(n,r)=>{let o=t.innerType._zod.run(n,r);return o instanceof Promise?o.then(i=>Si(i,e)):Si(o,e)}});function Si(e,t){return!e.issues.length&&e.value===void 0&&e.issues.push({code:"invalid_type",expected:"nonoptional",input:e.value,inst:t}),e}function Pi(e,t,n,r){return t.issues.length?(e.value=n.catchValue({...t,value:e.value,error:{issues:t.issues.map(o=>Se(o,r,me()))},input:e.value}),e):(e.value=t.value,t.memo&&(e.memo=!0),e)}var vs=g("$ZodCatch",(e,t)=>{V.init(e,t),Z(e,"optin",n=>n.def.innerType._zod.optin==="defaulted"?"defaulted":"optional"),Z(e,"optout",n=>n.def.innerType._zod.optout),Z(e,"values",n=>n.def.innerType._zod.values),e._zod.parse=(n,r)=>{if(r.direction==="backward")return t.innerType._zod.run(n,r);let o=t.innerType._zod.run({value:n.value,issues:[]},r);return o instanceof Promise?o.then(i=>Pi(n,i,t,r)):Pi(n,o,t,r)}});var ks=g("$ZodPipe",(e,t)=>{V.init(e,t),Z(e,"values",n=>n.def.in._zod.values),Z(e,"optin",n=>n.def.in._zod.optin),Z(e,"optout",n=>n.def.out._zod.optout),Z(e,"propValues",n=>n.def.in._zod.propValues),e._zod.parse=(n,r)=>{if(r.direction==="backward"){let i=t.out._zod.run(n,r);return i instanceof Promise?i.then(s=>Kt(s,t.in,r)):Kt(i,t.in,r)}let o=t.in._zod.run(n,r);return o instanceof Promise?o.then(i=>Kt(i,t.out,r)):Kt(o,t.out,r)}});function Kt(e,t,n){return e.issues.some(r=>r.code!=="unrecognized_keys")?(e.aborted=!0,e):t._zod.run({value:e.value,issues:e.issues},n)}var $s=g("$ZodReadonly",(e,t)=>{V.init(e,t),Z(e,"propValues",n=>n.def.innerType._zod.propValues),Z(e,"values",n=>n.def.innerType._zod.values),Z(e,"optin",n=>n.def.innerType?._zod?.optin),Z(e,"optout",n=>n.def.innerType?._zod?.optout),e._zod.parse=(n,r)=>{if(r.direction==="backward")return t.innerType._zod.run(n,r);let o=t.innerType._zod.run(n,r);return o instanceof Promise?o.then(Ti):Ti(o)}});function Ti(e){return e.memo||(e.value=Object.freeze(e.value)),e}var Es=g("$ZodCustom",(e,t)=>{re.init(e,t),V.init(e,t),e._zod.parse=(n,r)=>n,e._zod.check=n=>{let r=n.value,o=t.fn(r);if(o instanceof Promise)return o.then(i=>Ai(i,n,r,e));Ai(o,n,r,e)}});function Ai(e,t,n,r){if(!e){let o={code:"custom",input:n,inst:r,path:[...r._zod.def.path??[]],continue:!r._zod.def.abort};r._zod.def.params&&(o.params=r._zod.def.params),t.issues.push(Ye(o))}}var er=class extends Error{constructor(){super("Cannot parse a reference cycle that closes through a transform"),this.name="ZodCyclicError"}},tr="~memo",zs=[];function Ss(e){return e!==null&&typeof e=="object"}function Qn(e){return e.map(t=>t.path?{...t,path:t.path.slice()}:{...t})}var Ps=new WeakMap,bt=0,rn=1,yt=2;function on(e,t,n){let r=Ps.get(e);if(r!==void 0)return r?yt:bt;if(t.has(e))return yt;t.add(e);let o=bt,i=l=>{if(o!==yt&&l?._zod){let f=on(l,t,n);f>o&&(o=f)}},s=(l,f)=>{let d=bt;for(let h of Reflect.ownKeys(l)){let m=Object.getOwnPropertyDescriptor(l,h);if(f&&!m.enumerable)continue;let y=m.get?rn:m.value?._zod?on(m.value,t,n):bt;y>d&&(d=y)}return d},a=l=>{l>o&&(o=l)},c=e._zod.def,u=c.type;switch(u){case"object":{let l=pt(c);a(l?s(l,!0):rn),i(c.catchall);break}case"array":i(c.element);break;case"tuple":for(let l of c.items)i(l);i(c.rest);break;case"record":case"map":i(c.keyType),i(c.valueType);break;case"set":i(c.valueType);break;case"union":for(let l of c.options)i(l);break;case"intersection":i(c.left),i(c.right);break;case"optional":case"nullable":case"default":case"prefault":case"catch":case"readonly":case"nonoptional":case"promise":case"success":i(c.innerType);break;case"pipe":i(c.in),i(c.out);break;case"function":i(c.input),i(c.output);break;case"lazy":{let l=c._cachedInner??(n?e._zod.innerType:void 0);a(l?on(l,t,!1):rn);break}case"template_literal":case"string":case"number":case"int":case"boolean":case"bigint":case"symbol":case"undefined":case"null":case"void":case"never":case"any":case"unknown":case"date":case"nan":case"enum":case"literal":case"file":case"transform":case"custom":break;default:for(let l in c){let f=Object.getOwnPropertyDescriptor(c,l);if(!f||f.get)continue;let d=f.value;if(!(!d||typeof d!="object")){if(d._zod)i(d);else if(Array.isArray(d))for(let h of d)i(h)}}}return t.delete(e),Yu(e,o)}function Yu(e,t){return t!==rn&&Ps.set(e,t===yt),t}function Xu(e,t){let n=e.buckets.get(t);return n||(n=new WeakMap,e.buckets.set(t,n)),n}var tn,nn=[],Qu={alloc(e,t,n){let r=tn;if(!r)return n;tn=void 0;let o={value:n,issues:null};return r.set(t.value,o),nn.push(o),n},guard(e){var t;(t=e._zod).deferred??(t.deferred=[]),e._zod.deferred.push(()=>{let n=e._zod.parse,r=(o,i)=>{if(i.direction!=="backward"&&el(i,o.value))throw new er;return n(o,i)};e._zod.parse=r,e._zod.run===n&&(e._zod.run=r)})},attach(e){var t;let n,r=!1,o,i;(t=e._zod).deferred??(t.deferred=[]),e._zod.deferred.push(()=>{let s=e._zod.parse,a=(c,u)=>{if(n===void 0){let k=on(e,new Set,!1);if(k===bt)return e._zod.parse=s,e._zod.run===a&&(e._zod.run=s),s(c,u);k===yt||r?n=!0:r=!0}let l=c.value;if(!Ss(l))return s(c,u);let f=u[tr];f||(f={buckets:new WeakMap,backEdges:void 0},u[tr]=f);let d;o===u?d=i:(d=Xu(f,e),o=u,i=d);let h=d.get(l);if(h)return c.value=h.value,h.issues?h.issues.length&&c.issues.push(...Qn(h.issues)):(c.memo=!0,f.backEdges??(f.backEdges=new WeakSet),f.backEdges.add(h.value)),c;tn=d;let m=nn.length,y=s(c,u);tn=void 0;let _=nn.length>m?nn.pop():void 0;return y instanceof Promise?y.then(k=>(_&&(_.issues=k.issues.length?Qn(k.issues):zs),k)):(_&&(_.issues=y.issues.length?Qn(y.issues):zs),y)};e._zod.parse=a,e._zod.run===s&&(e._zod.run=a)})}};function nr(){return Qu}function el(e,t){let n=e[tr]?.backEdges;return n!==void 0&&Ss(t)&&n.has(t)}var tl=()=>{let e={string:{unit:"characters",verb:"to have"},file:{unit:"bytes",verb:"to have"},array:{unit:"items",verb:"to have"},set:{unit:"items",verb:"to have"},map:{unit:"entries",verb:"to have"}};function t(i){return e[i]??null}let n={regex:"input",email:"email address",url:"URL",emoji:"emoji",uuid:"UUID",uuidv4:"UUIDv4",uuidv6:"UUIDv6",nanoid:"nanoid",guid:"GUID",cuid:"cuid",cuid2:"cuid2",ulid:"ULID",xid:"XID",ksuid:"KSUID",datetime:"ISO datetime",date:"ISO date",time:"ISO time",duration:"ISO duration",ipv4:"IPv4 address",ipv6:"IPv6 address",mac:"MAC address",cidrv4:"IPv4 range",cidrv6:"IPv6 range",base64:"base64-encoded string",base64url:"base64url-encoded string",json_string:"JSON string",e164:"E.164 number",currency_code:"currency code",credit_card:"credit card number",iban:"IBAN",jwt:"JWT",template_literal:"input"},r={nan:"NaN"};function o(i,s){return i==="number"&&typeof s=="number"&&!Number.isFinite(s)?String(s):r[i]??i}return i=>{switch(i.code){case"invalid_type":{let s=o(i.expected),a=Cn(i.input),c=o(a,i.input);return`Invalid input: expected ${s}, received ${c}`}case"invalid_value":return i.values.length===1?`Invalid input: expected ${Lt(i.values[0])}`:`Invalid option: expected one of ${Rt(i.values,"|")}`;case"too_big":{let s=i.exact?"exactly ":i.inclusive?"<=":"<",a=t(i.origin);return a?`Too big: expected ${i.origin??"value"} to have ${s}${i.maximum.toString()} ${a.unit??"elements"}`:`Too big: expected ${i.origin??"value"} to be ${s}${i.maximum.toString()}`}case"too_small":{let s=i.exact?"exactly ":i.inclusive?">=":">",a=t(i.origin);return a?`Too small: expected ${i.origin} to have ${s}${i.minimum.toString()} ${a.unit}`:`Too small: expected ${i.origin} to be ${s}${i.minimum.toString()}`}case"invalid_format":{let s=i;return s.format==="starts_with"?`Invalid string: must start with "${s.prefix}"`:s.format==="ends_with"?`Invalid string: must end with "${s.suffix}"`:s.format==="includes"?`Invalid string: must include "${s.includes}"`:s.format==="regex"?`Invalid string: must match pattern ${s.pattern}`:`Invalid ${n[s.format]??i.format}`}case"not_multiple_of":return`Invalid number: must be a multiple of ${i.divisor}`;case"unrecognized_keys":return`Unrecognized key${i.keys.length>1?"s":""}: ${Rt(i.keys,", ")}`;case"invalid_key":return`Invalid key in ${i.origin}`;case"invalid_union":return i.options&&Array.isArray(i.options)&&i.options.length>0?`Invalid discriminator value. Expected ${i.options.map(a=>`'${a}'`).join(" | ")}`:i.inclusive===!1?"Invalid input: more than one option matched":"Invalid input";case"invalid_element":return`Invalid value in ${i.origin}`;default:return"Invalid input"}}};function Ts(){return{localeError:tl()}}var As;var rr=class{constructor(){this._map=new WeakMap,this._idmap=new Map}add(t,...n){let r=n[0];return this._map.set(t,r),r&&typeof r=="object"&&"id"in r&&this._idmap.set(r.id,t),this}clear(){return this._map=new WeakMap,this._idmap=new Map,this}remove(t){let n=this._map.get(t);return n&&typeof n=="object"&&"id"in n&&this._idmap.delete(n.id),this._map.delete(t),this}get(t){let n=t._zod.parent;if(n){let r={...this.get(n)??{}};delete r.id;let o={...r,...this._map.get(t)};return Object.keys(o).length?o:void 0}return this._map.get(t)}has(t){return this._map.has(t)}};function Is(){return new rr}(As=globalThis).__zod_globalRegistry??(As.__zod_globalRegistry=Is());var Ce=globalThis.__zod_globalRegistry;function Os(e){return e.checks&&(e.checks=[...e.checks]),e}function Cs(e,t){return new e(Os({type:"string",...S(t)}))}function Ns(e,t){return new e({type:"string",format:"email",check:"string_format",abort:!1,...S(t)})}function Rs(e,t){return new e({type:"string",format:"guid",check:"string_format",abort:!1,...S(t)})}function Zs(e,t){return new e({type:"string",format:"uuid",check:"string_format",abort:!1,...S(t)})}function Ls(e,t){return new e({type:"string",format:"uuid",check:"string_format",abort:!1,version:"v4",...S(t)})}function Ms(e,t){return new e({type:"string",format:"uuid",check:"string_format",abort:!1,version:"v6",...S(t)})}function Ds(e,t){return new e({type:"string",format:"uuid",check:"string_format",abort:!1,version:"v7",...S(t)})}function Fs(e,t){return new e({type:"string",format:"url",check:"string_format",abort:!1,...S(t)})}function Us(e,t){return new e({type:"string",format:"emoji",check:"string_format",abort:!1,...S(t)})}function Bs(e,t){return new e({type:"string",format:"nanoid",check:"string_format",abort:!1,...S(t)})}function js(e,t){return new e({type:"string",format:"cuid",check:"string_format",abort:!1,...S(t)})}function Ws(e,t){return new e({type:"string",format:"cuid2",check:"string_format",abort:!1,...S(t)})}function Vs(e,t){return new e({type:"string",format:"ulid",check:"string_format",abort:!1,...S(t)})}function Gs(e,t){return new e({type:"string",format:"xid",check:"string_format",abort:!1,...S(t)})}function Js(e,t){return new e({type:"string",format:"ksuid",check:"string_format",abort:!1,...S(t)})}function Hs(e,t){return new e({type:"string",format:"ipv4",check:"string_format",abort:!1,...S(t)})}function qs(e,t){return new e({type:"string",format:"ipv6",check:"string_format",abort:!1,...S(t)})}function Ks(e,t){return new e({type:"string",format:"cidrv4",check:"string_format",abort:!1,...S(t)})}function Ys(e,t){return new e({type:"string",format:"cidrv6",check:"string_format",abort:!1,...S(t)})}function Xs(e,t){return new e({type:"string",format:"base64",check:"string_format",abort:!1,...S(t)})}function Qs(e,t){return new e({type:"string",format:"base64url",check:"string_format",abort:!1,...S(t)})}function ea(e,t){return new e({type:"string",format:"e164",check:"string_format",abort:!1,...S(t)})}function ta(e,t){return new e({type:"string",format:"jwt",check:"string_format",abort:!1,...S(t)})}function na(e,t){return new e({type:"string",format:"datetime",check:"string_format",offset:!1,local:!1,precision:null,...S(t)})}function ra(e,t){return new e({type:"string",format:"date",check:"string_format",...S(t)})}function oa(e,t){return new e({type:"string",format:"time",check:"string_format",precision:null,...S(t)})}function ia(e,t){return new e({type:"string",format:"duration",check:"string_format",...S(t)})}function sa(e,t){return new e(Os({type:"number",checks:[],...S(t)}))}function aa(e,t){return new e({type:"number",check:"number_format",abort:!1,format:"safeint",...S(t)})}function ca(e,t){return new e({type:"boolean",...S(t)})}function ua(e){return new e({type:"unknown"})}function la(e,t){return new e({type:"never",...S(t)})}function sn(e,t){return new Gn({check:"less_than",...S(t),value:e,inclusive:!1})}function xt(e,t){return new Gn({check:"less_than",...S(t),value:e,inclusive:!0})}function an(e,t){return new Jn({check:"greater_than",...S(t),value:e,inclusive:!1})}function wt(e,t){return new Jn({check:"greater_than",...S(t),value:e,inclusive:!0})}function cn(e,t){return new ai({check:"multiple_of",...S(t),value:e})}function un(e,t){return new ui({check:"max_length",...S(t),maximum:e})}function et(e,t){return new li({check:"min_length",...S(t),minimum:e})}function ln(e,t){return new pi({check:"length_equals",...S(t),length:e})}function or(e,t){return new di({check:"string_format",format:"regex",...S(t),pattern:e})}function ir(e){return new fi({check:"string_format",format:"lowercase",...S(e)})}function sr(e){return new hi({check:"string_format",format:"uppercase",...S(e)})}function ar(e,t){return new mi({check:"string_format",format:"includes",...S(t),includes:e})}function cr(e,t){return new gi({check:"string_format",format:"starts_with",...S(t),prefix:e})}function ur(e,t){return new _i({check:"string_format",format:"ends_with",...S(t),suffix:e})}function Ne(e){return new bi({check:"overwrite",tx:e})}function lr(e){return Ne(t=>t.normalize(e))}function pr(){return Ne(e=>e.trim())}function dr(){return Ne(e=>e.toLowerCase())}function fr(){return Ne(e=>e.toUpperCase())}function hr(){return Ne(e=>Pn(e))}function pa(e,t,n){return new e({type:"array",element:t,...S(n)})}function da(e,t,n){return new e({type:"custom",check:"custom",fn:t,...S(n)})}function fa(e,t){let n=nl(r=>(r.addIssue=o=>{if(typeof o=="string")r.issues.push(Ye(o,r.value,n._zod.def));else{let i=o;i.fatal&&(i.continue=!1),i.code??(i.code="custom"),"input"in i||(i.input=r.value),i.inst??(i.inst=n),i.continue??(i.continue=!n._zod.def.abort),r.issues.push(Ye(i))}},e(r.value,r)),t);return n}function nl(e,t){let n=new re({check:"custom",...S(t)});return n._zod.check=e,n}function vt(e,...t){for(let n of t)for(let r of Reflect.ownKeys(n))Object.prototype.propertyIsEnumerable.call(n,r)&&le(e,r,n[r]);return e}function $t(e){let t=e?.target??"draft-2020-12";return t==="draft-4"&&(t="draft-04"),t==="draft-7"&&(t="draft-07"),{processors:e.processors??{},metadataRegistry:e?.metadata??Ce,target:t,unrepresentable:e?.unrepresentable??"throw",override:e?.override??(()=>{}),io:e?.io??"output",counter:0,seen:new Map,sharedDefsExtractedFor:void 0,sharedEmitDoneFor:void 0,cycles:e?.cycles??"ref",reused:e?.reused??"inline",intersections:[],deferred:[],external:e?.external??void 0}}function Q(e,t,n,r,o){let i=typeof t.unrepresentable=="function"?t.unrepresentable({zodSchema:e,path:r.path,message:o}):t.unrepresentable;if(i==="any")return!1;if(i===void 0||i==="throw")throw new Error(o);return Object.assign(n,i),!0}function F(e,t,n={path:[],schemaPath:[]}){var r;let o=e._zod.def,i=t.seen.get(e);if(i)return i.count++,n.schemaPath.includes(e)&&(i.cycle=n.path),i.schema;let s={schema:{},count:1,cycle:void 0,path:n.path};t.seen.set(e,s),t.sharedDefsExtractedFor=void 0,t.sharedEmitDoneFor=void 0;let a=e._zod.toJSONSchema?.();if(a)s.schema=a;else{let l={...n,schemaPath:[...n.schemaPath,e],path:n.path};if(e._zod.processJSONSchema)e._zod.processJSONSchema(t,s.schema,l);else{let d=s.schema,h=t.processors[o.type];if(!h)throw new Error(`[toJSONSchema]: Non-representable type encountered: ${o.type}`);h(e,t,d,l)}let f=e._zod.parent;f&&(s.ref||(s.ref=f),F(f,t,l),t.seen.get(f).isParent=!0)}let c=t.metadataRegistry.get(e);return c&&vt(s.schema,c),t.io==="input"&&se(e)&&(delete s.schema.examples,delete s.schema.default),t.io==="input"&&"_prefault"in s.schema&&((r=s.schema).default??(r.default=s.schema._prefault)),delete s.schema._prefault,t.seen.get(e).schema}function ha(e){return e.replace(/~/g,"~0").replace(/\//g,"~1")}function Et(e,t){let n=e.seen.get(t);if(!n)throw new Error("Unprocessed schema. This is a bug in Zod.");if(e.external&&e.sharedDefsExtractedFor===e.external)return;let r=new Map;for(let s of e.seen.entries()){let a=e.metadataRegistry.get(s[0])?.id;if(a){let c=r.get(a);if(c&&c!==s[0])throw new Error(`Duplicate schema id "${a}" detected during JSON Schema conversion. Two different schemas cannot share the same id when converted together.`);r.set(a,s[0])}}let o=s=>{let a=e.target==="draft-2020-12"?"$defs":"definitions";if(e.external){let f=e.external.registry.get(s[0])?.id,d=e.external.uri??(m=>m);if(f)return{ref:d(f)};let h=s[1].defId??s[1].schema.id??`schema${e.counter++}`;return s[1].defId=h,{defId:h,ref:`${d("__shared")}#/${a}/${ha(h)}`}}let c="#",u=`${c}/${a}/`;if(s[1]===n&&!s[1].schema.id)return{ref:c};let l=s[1].schema.id??`__schema${e.counter++}`;return{defId:l,ref:u+ha(l)}},i=s=>{if(s[1].schema.$ref)return;let a=s[1],{ref:c,defId:u}=o(s);a.def={...a.schema},u&&(a.defId=u);let l=a.schema;for(let f in l)delete l[f];l.$ref=c};if(e.cycles==="throw")for(let s of e.seen.entries()){let a=s[1];if(a.cycle)throw new Error(`Cycle detected: #/${a.cycle?.join("/")}/<root>

Set the \`cycles\` parameter to \`"ref"\` to resolve cyclical schemas with defs.`)}for(let s of e.seen.entries()){let a=s[1];if(t===s[0]){i(s);continue}if(e.external){let u=e.external.registry.get(s[0])?.id;if(t!==s[0]&&u){i(s);continue}}if(e.metadataRegistry.get(s[0])?.id){i(s);continue}if(a.cycle){i(s);continue}a.count>1&&e.reused==="ref"&&i(s)}e.external&&(e.sharedDefsExtractedFor=e.external)}function _a(e){let t=e.anyOf;if(!Array.isArray(t)||t.length===0||e.type!==void 0)return;let n=[];for(let r of t){if(!r||typeof r!="object")return;_a(r);let o=Object.keys(r);if(o.length!==1||o[0]!=="type")return;let i=r.type;for(let s of Array.isArray(i)?i:[i]){if(typeof s!="string")return;n.includes(s)||n.push(s)}}delete e.anyOf,e.type=n.length===1?n[0]:n}var ba=new Set(["type","properties","required","additionalProperties"]),ma=["oneOf","anyOf"];function ga(e){let t=e.additionalProperties;return t===void 0||t===!1||typeof t!="object"||t===null?null:Object.keys(t).length?t:null}function mr(e){let t=[];for(let i of e){if(typeof i!="object"||i.type!=="object")return null;for(let s in i)if(!ba.has(s))return null;t.push(i)}let n={},r=new Set;for(let i of t){for(let s in i.properties){if(Object.prototype.hasOwnProperty.call(n,s))continue;let a=[];for(let u of t){let l=u.properties?.[s]??ga(u);l!=null&&(a.some(f=>JSON.stringify(f)===JSON.stringify(l))||a.push(l))}let c=a.length===1?a[0]:mr(a)??{allOf:a};le(n,s,c)}for(let s of i.required??[])r.add(s)}let o={type:"object",properties:n};if(r.size&&(o.required=[...r]),t.every(i=>i.additionalProperties===!1))o.additionalProperties=!1;else{let i=[];for(let s of t){let a=ga(s);a&&!i.some(c=>JSON.stringify(c)===JSON.stringify(a))&&i.push(a)}i.length===1?o.additionalProperties=i[0]:i.length>1&&(o.additionalProperties={allOf:i})}return o}function rl(e){let t=e.allOf;if(!Array.isArray(t)||t.length<2)return;for(let o of ba)if(o in e)return;let n=t.filter(o=>ma.some(i=>Array.isArray(o[i]))),r=null;if(!n.length)r=mr(t);else{let o=n[0],i=ma.find(c=>Array.isArray(o[c]));if(Object.keys(o).length!==1)return;let s=t.filter(c=>c!==o),a=o[i].map(c=>mr([...s,c]));if(a.some(c=>!c))return;r={[i]:a}}r&&(delete e.allOf,vt(e,r))}function zt(e,t){let n=e.seen.get(t);if(!n)throw new Error("Unprocessed schema. This is a bug in Zod.");let r=a=>{let c=e.seen.get(a);if(c.ref===null)return;let u=c.def??c.schema,l={...u},f=c.ref;if(c.ref=null,f){r(f);let h=e.seen.get(f),m=h.schema;if(m.$ref&&(e.target==="draft-07"||e.target==="draft-04"||e.target==="openapi-3.0")?(u.allOf=u.allOf??[],u.allOf.push(m)):vt(u,m),vt(u,l),a._zod.parent===f)for(let _ in u)_==="$ref"||_==="allOf"||_ in l||delete u[_];if(m.$ref&&h.def)for(let _ in u)_==="$ref"||_==="allOf"||_ in h.def&&JSON.stringify(u[_])===JSON.stringify(h.def[_])&&delete u[_]}let d=a._zod.parent;if(d&&d!==f){r(d);let h=e.seen.get(d);if(h?.schema.$ref&&(u.$ref=h.schema.$ref,h.def))for(let m in u)m==="$ref"||m==="allOf"||m in h.def&&JSON.stringify(u[m])===JSON.stringify(h.def[m])&&delete u[m]}e.override({zodSchema:a,jsonSchema:u,path:c.path??[]})};if(!e.external||e.sharedEmitDoneFor!==e.external){for(let a of[...e.seen.entries()].reverse())r(a[0]);if(e.target!=="openapi-3.0")for(let a of e.seen.entries())_a(a[1].def??a[1].schema);for(let a of e.deferred)a();if(e.intersections.length){let a=new Map;for(let c of e.seen.values())for(let u of[c.schema,c.def]){let l=u?.allOf;if(!Array.isArray(l))continue;let f=a.get(l);f?f.push(u):a.set(l,[u])}for(let c of e.intersections)for(let u of a.get(c)??[])rl(u)}}let o={};if(e.target==="draft-2020-12"?o.$schema="https://json-schema.org/draft/2020-12/schema":e.target==="draft-07"?o.$schema="http://json-schema.org/draft-07/schema#":e.target==="draft-04"?o.$schema="http://json-schema.org/draft-04/schema#":e.target,e.external?.uri){let a=e.external.registry.get(t)?.id;if(!a)throw new Error("Schema is missing an `id` property");o.$id=e.external.uri(a)}vt(o,n.defId?n.schema:n.def??n.schema);let i=e.metadataRegistry.get(t)?.id;i!==void 0&&o.id===i&&delete o.id;let s=e.external?.defs??{};if(!e.external||e.sharedEmitDoneFor!==e.external)for(let a of e.seen.entries()){let c=a[1];c.def&&c.defId&&(c.def.id===c.defId&&delete c.def.id,le(s,c.defId,c.def))}e.external&&(e.sharedEmitDoneFor=e.external),e.external||Object.keys(s).length>0&&(e.target==="draft-2020-12"?o.$defs=s:o.definitions=s);try{let a=JSON.parse(JSON.stringify(o));return Object.defineProperty(a,"~standard",{value:{...t["~standard"],jsonSchema:{input:kt(t,"input",e.processors),output:kt(t,"output",e.processors)}},enumerable:!1,writable:!1}),a}catch{throw new Error("Error converting schema to JSON.")}}function se(e,t){let n=t??{seen:new Set};if(n.seen.has(e))return!1;n.seen.add(e);let r=e._zod.def;if(r.type==="transform")return!0;if(r.type==="array")return se(r.element,n);if(r.type==="set")return se(r.valueType,n);if(r.type==="lazy")return se(r.getter(),n);if(r.type==="promise"||r.type==="optional"||r.type==="nonoptional"||r.type==="nullable"||r.type==="readonly"||r.type==="default"||r.type==="prefault"||r.type==="catch")return se(r.innerType,n);if(r.type==="intersection")return se(r.left,n)||se(r.right,n);if(r.type==="record"||r.type==="map")return se(r.keyType,n)||se(r.valueType,n);if(r.type==="pipe")return e._zod.traits.has("$ZodCodec")?!0:se(r.in,n)||se(r.out,n);if(r.type==="object"){for(let o in r.shape)if(se(r.shape[o],n))return!0;return!1}if(r.type==="union"){for(let o of r.options)if(se(o,n))return!0;return!1}if(r.type==="tuple"){for(let o of r.items)if(se(o,n))return!0;return!!(r.rest&&se(r.rest,n))}return!1}var ya=(e,t={})=>n=>{let r=$t({...n,processors:t});return F(e,r),Et(r,e),zt(r,e)},kt=(e,t,n={})=>r=>{let{libraryOptions:o,target:i}=r??{},s=$t({...o??{},target:i,io:t,processors:n});return F(e,s),Et(s,e),zt(s,e)};var tt=(e,t,n)=>{(e[t]===void 0||n>e[t])&&(e[t]=n)},nt=(e,t,n)=>{(e[t]===void 0||n<e[t])&&(e[t]=n)},xa=(e,t)=>{tt(e,"minimum",t),nt(e,"maximum",t)},Ea=(e,t)=>{e.multipleOf??(e.multipleOf=[]),e.multipleOf.includes(t)||e.multipleOf.push(t)},za=(e,t)=>{e.patterns??(e.patterns=new Set),e.patterns.add(t)},Sa=(e,t)=>{e.mime=e.mime?e.mime.filter(n=>t.includes(n)):[...t]},Pa=(e,t)=>{e.format=t,t.includes("int")&&(e.isInt=!0)},wa=(e,t)=>tt(e,"minimum",t.minimum),va=(e,t)=>nt(e,"maximum",t.maximum),ka=e=>(t,n)=>{Pa(t,n.format);let[r,o]=e[n.format];tt(t,"minimum",r),nt(t,"maximum",o)},ol={greater_than:(e,t)=>tt(e,t.inclusive?"minimum":"exclusiveMinimum",t.value),less_than:(e,t)=>nt(e,t.inclusive?"maximum":"exclusiveMaximum",t.value),multiple_of:(e,t)=>Ea(e,t.value),number_format:ka(dt),bigint_format:ka(Mt),min_length:wa,max_length:va,length_equals:(e,t)=>xa(e,t.length),min_size:wa,max_size:va,size_equals:(e,t)=>xa(e,t.size),string_format:(e,t)=>{Pa(e,t.format),t.pattern&&za(e,t.pattern),(t.format==="base64"||t.format==="base64url")&&(e.contentEncoding=t.format),(t.local||t.precision===-1)&&(e.laxFormat=!0)},mime_type:(e,t)=>Sa(e,t.mime)};function ae(e){let t={},n=e._zod.def,r=e._zod.traits.has("$ZodCheck")?[e,...n.checks??[]]:n.checks??[];for(let i of r)ol[i._zod.def.check]?.(t,i._zod.def);let o=e._zod.bag;o.minimum!==void 0&&tt(t,"minimum",o.minimum),o.exclusiveMinimum!==void 0&&tt(t,"exclusiveMinimum",o.exclusiveMinimum),o.maximum!==void 0&&nt(t,"maximum",o.maximum),o.exclusiveMaximum!==void 0&&nt(t,"exclusiveMaximum",o.exclusiveMaximum),o.multipleOf!==void 0&&Ea(t,o.multipleOf),o.format!==void 0&&(t.format??(t.format=o.format),o.format.includes("int")&&(t.isInt=!0)),o.mime&&Sa(t,o.mime);for(let i of o.patterns??[])za(t,i);return t}var il={guid:"uuid",url:"uri",datetime:"date-time",json_string:"json-string",regex:""},sl=new Map([[Kn,qo],[en,Ko]]),Ta=e=>sl.get(e)??e,br=(e,t,n,r)=>{let o=n;o.type="string";let{minimum:i,maximum:s,format:a,patterns:c,contentEncoding:u,laxFormat:l}=ae(e);if(typeof i=="number"&&(o.minLength=i),typeof s=="number"&&(o.maxLength=s),a&&(o.format=il[a]??a,o.format===""&&delete o.format,(a==="time"||l)&&delete o.format),u&&(o.contentEncoding=u),c&&c.size>0){let f=[...c].map(Ta);f.length===1?o.pattern=f[0].source:f.length>1&&(o.allOf=[...f.map(d=>({...t.target==="draft-07"||t.target==="draft-04"||t.target==="openapi-3.0"?{type:"string"}:{},pattern:d.source}))])}},yr=(e,t,n,r)=>{let o=n,{minimum:i,maximum:s,multipleOf:a,exclusiveMaximum:c,exclusiveMinimum:u,isInt:l}=ae(e);o.type=l?"integer":"number";let f=typeof u=="number"&&u>=(i??Number.NEGATIVE_INFINITY),d=typeof c=="number"&&c<=(s??Number.POSITIVE_INFINITY),h=t.target==="draft-04"||t.target==="openapi-3.0";if(f?h?(o.minimum=u,o.exclusiveMinimum=!0):o.exclusiveMinimum=u:typeof i=="number"&&(o.minimum=i),d?h?(o.maximum=c,o.exclusiveMaximum=!0):o.exclusiveMaximum=c:typeof s=="number"&&(o.maximum=s),a){let m=new Set;for(let k of a)Number.isFinite(k)&&k!==0?m.add(Math.abs(k)):Q(e,t,o,r,`A multipleOf divisor of ${k} cannot be represented in JSON Schema`);let[y,..._]=m;y!==void 0&&(o.multipleOf=y),_.length&&(o.allOf=[...o.allOf??[],..._.map(k=>({multipleOf:k}))])}},xr=(e,t,n,r)=>{n.type="boolean"},Aa=(e,t,n,r)=>{Q(e,t,n,r,"BigInt cannot be represented in JSON Schema")},Ia=(e,t,n,r)=>{Q(e,t,n,r,"Symbols cannot be represented in JSON Schema")},Oa=(e,t,n,r)=>{t.target==="openapi-3.0"?(n.type="string",n.nullable=!0,n.enum=[null]):n.type="null"},Ca=(e,t,n,r)=>{Q(e,t,n,r,"Undefined cannot be represented in JSON Schema")},Na=(e,t,n,r)=>{Q(e,t,n,r,"Void cannot be represented in JSON Schema")},wr=(e,t,n,r)=>{n.not={}},Ra=(e,t,n,r)=>{},vr=(e,t,n,r)=>{},Za=(e,t,n,r)=>{Q(e,t,n,r,"Date cannot be represented in JSON Schema")},kr=(e,t,n,r)=>{let o=e._zod.def,i=qe(o.entries);if(i.length===0){n.not={};return}i.every(s=>typeof s=="number")&&(n.type="number"),i.every(s=>typeof s=="string")&&(n.type="string"),n.enum=i},La=(e,t,n,r)=>{let o=e._zod.def;if(o.values.length===0){n.not={};return}let i=[];for(let s of o.values)if(s===void 0){if(Q(e,t,n,r,"Literal `undefined` cannot be represented in JSON Schema"))return}else if(typeof s=="bigint"){if(Q(e,t,n,r,"BigInt literals cannot be represented in JSON Schema"))return;i.push(Number(s))}else i.push(s);if(i.length!==0)if(i.length===1){let s=i[0];n.type=s===null?"null":typeof s,t.target==="draft-04"||t.target==="openapi-3.0"?n.enum=[s]:n.const=s}else i.every(s=>typeof s=="number")&&(n.type="number"),i.every(s=>typeof s=="string")&&(n.type="string"),i.every(s=>typeof s=="boolean")&&(n.type="boolean"),i.every(s=>s===null)&&(n.type="null"),n.enum=i},Ma=(e,t,n,r)=>{Q(e,t,n,r,"NaN cannot be represented in JSON Schema")},Da=(e,t,n,r)=>{let o=n,i=e._zod.pattern;if(!i)throw new Error("Pattern not found in template literal");o.type="string",o.pattern=i.source},Fa=(e,t,n,r)=>{let o=n;o.type="string",o.format="binary",o.contentEncoding="binary";let{minimum:i,maximum:s,mime:a}=ae(e);i!==void 0&&(o.minLength=i),s!==void 0&&(o.maxLength=s),a&&(a.length===0?o.not={}:a.length===1?o.contentMediaType=a[0]:o.anyOf=a.map(c=>({contentMediaType:c})))},Ua=(e,t,n,r)=>{n.type="boolean"},$r=(e,t,n,r)=>{Q(e,t,n,r,"Custom types cannot be represented in JSON Schema")},Ba=(e,t,n,r)=>{Q(e,t,n,r,"Function types cannot be represented in JSON Schema")},Er=(e,t,n,r)=>{Q(e,t,n,r,"Transforms cannot be represented in JSON Schema")},ja=(e,t,n,r)=>{Q(e,t,n,r,"Map cannot be represented in JSON Schema")},Wa=(e,t,n,r)=>{Q(e,t,n,r,"Set cannot be represented in JSON Schema")},zr=(e,t,n,r)=>{let o=n,i=e._zod.def,{minimum:s,maximum:a}=ae(e);typeof s=="number"&&(o.minItems=s),typeof a=="number"&&(o.maxItems=a),o.type="array",o.items=F(i.element,t,{...r,path:[...r.path,"items"]})};function St(e){let t=e._zod.def;return t.type==="pipe"&&t.in._zod.traits.has("$ZodTransform")?St(t.out):t.type==="catch"?St(t.innerType):e._zod.optin}var Sr=(e,t,n,r)=>{let o=n,i=e._zod.def,s=i.shape;if(Object.getOwnPropertySymbols(s).length&&Q(e,t,o,r,"Symbol keys cannot be represented in JSON Schema"))return;o.type="object",o.properties={};for(let u in s)le(o.properties,u,F(s[u],t,{...r,path:[...r.path,"properties",u]}));let c=[];for(let u of Object.keys(s)){let l=i.shape[u];(t.io==="input"?St(l)===void 0:l._zod.optout===void 0)&&c.push(u)}c.length>0&&(o.required=c),i.catchall?._zod.def.type==="never"?o.additionalProperties=!1:i.catchall?i.catchall&&(o.additionalProperties=F(i.catchall,t,{...r,path:[...r.path,"additionalProperties"]})):t.io==="output"&&(o.additionalProperties=!1)},Pr=(e,t,n,r)=>{let o=e._zod.def,i=o.inclusive===!1,s=o.options.map((a,c)=>F(a,t,{...r,path:[...r.path,i?"oneOf":"anyOf",c]}));i?n.oneOf=s:n.anyOf=s},Tr=(e,t,n,r)=>{let o=e._zod.def,i=F(o.left,t,{...r,path:[...r.path,"allOf",0]}),s=F(o.right,t,{...r,path:[...r.path,"allOf",1]}),a=u=>"allOf"in u&&Object.keys(u).length===1,c=[...a(i)?i.allOf:[i],...a(s)?s.allOf:[s]];n.allOf=c,t.intersections.push(c)},Va=(e,t,n,r)=>{let o=n,i=e._zod.def;o.type="array";let s=t.target==="draft-2020-12"?"prefixItems":"items",a=t.target==="draft-2020-12"||t.target==="openapi-3.0"?"items":"additionalItems",c=i.items.map((y,_)=>F(y,t,{...r,path:[...r.path,s,_]})),u=i.rest?F(i.rest,t,{...r,path:[...r.path,a,...t.target==="openapi-3.0"?[i.items.length]:[]]}):null,l=i.items.length;for(;l>0;){let y=i.items[l-1];if(!(t.io==="input"?St(y)!==void 0:y._zod.optout==="optional"))break;l--}let f=i.items.length,d=!i.rest;t.target==="draft-2020-12"?(o.prefixItems=c,d?o.items=!1:u&&(o.items=u),l>0&&(o.minItems=l),d&&(o.maxItems=f)):t.target==="openapi-3.0"?(o.items={anyOf:c},u&&o.items.anyOf.push(u),l>0&&(o.minItems=l),d&&(o.maxItems=f)):(o.items=c,d?o.additionalItems=!1:u&&(o.additionalItems=u),l>0&&(o.minItems=l),d&&(o.maxItems=f));let{minimum:h,maximum:m}=ae(e);typeof h=="number"&&(o.minItems=h),typeof m=="number"&&(o.maxItems=m)};function gr(e,t,n){if(t.$ref){if(n.has(t))return t;n.add(t);let m=e.get(t)?.def;if(!m)return t;let y=gr(e,m,n);return y===m?t:y}for(let m of["anyOf","oneOf"]){let y=t[m];if(!Array.isArray(y))continue;let _=y.map(k=>gr(e,k,n));_.some((k,P)=>k!==y[P])&&(t={...t,[m]:_})}let r=Array.isArray(t.type)?t.type:[t.type],o=!r.includes("string")&&r.some(m=>m==="number"||m==="integer"),i=t.enum??(t.const!==void 0?[t.const]:void 0);if(!o&&!i?.some(m=>typeof m=="number"))return t;let{minimum:s,maximum:a,exclusiveMinimum:c,exclusiveMaximum:u,multipleOf:l,format:f,id:d,...h}=t;return h.enum?h.enum=h.enum.map(m=>typeof m=="number"?String(m):m):typeof h.const=="number"&&(h.const=String(h.const)),o&&(h.type="string",i||(h.pattern=(r.includes("number")?Jt:Wn).source)),h}var _r=new WeakMap;function al(e){let t=new Map;for(let r of e.seen.values())r.def&&!t.has(r.schema)&&t.set(r.schema,r);let n=new Map;for(let r of _r.get(e)??[]){let o=e.seen.get(r),i=(o?.def??o?.schema)?.propertyNames;if(!i||i===!0||n.has(i))continue;let s=gr(t,i,new Set);s!==i&&n.set(i,s)}if(n.size)for(let r of e.seen.values())for(let o of[r.schema,r.def]){let i=o&&n.get(o.propertyNames);i&&(o.propertyNames=i)}}var Ga=(e,t,n,r)=>{let o=n,i=e._zod.def;o.type="object";let s=i.keyType,a=ae(s).patterns;if(i.mode==="loose"&&a&&a.size>0){let l=F(i.valueType,t,{...r,path:[...r.path,"patternProperties","*"]});o.patternProperties={};for(let f of a)le(o.patternProperties,Ta(f).source,l)}else{if(t.target==="draft-07"||t.target==="draft-2020-12"){o.propertyNames=F(i.keyType,t,{...r,path:[...r.path,"propertyNames"]});let l=_r.get(t);l||(l=[],_r.set(t,l),t.deferred.push(()=>al(t))),l.push(e)}o.additionalProperties=F(i.valueType,t,{...r,path:[...r.path,"additionalProperties"]})}let c=s._zod.values,u=t.io==="input"&&St(i.valueType)!==void 0;if(c&&!i.partial&&!u){let l=[...c].filter(f=>typeof f=="string"||typeof f=="number");l.length>0&&(o.required=l.map(String))}},Ar=(e,t,n,r)=>{let o=e._zod.def,i=F(o.innerType,t,r),s=t.seen.get(e);t.target==="openapi-3.0"?(s.ref=o.innerType,n.nullable=!0):n.anyOf=[i,{type:"null"}]},Ir=(e,t,n,r)=>{let o=e._zod.def;F(o.innerType,t,r);let i=t.seen.get(e);i.ref=o.innerType},Or=Symbol();function Ja(e,t,n,r,o){let i=!1,s=JSON.stringify(e,(a,c)=>typeof c!="bigint"?c:(i=!0,null));return i?(Q(t,n,r,o,"BigInt defaults cannot be represented in JSON Schema"),Or):JSON.parse(s)}var Cr=(e,t,n,r)=>{let o=e._zod.def;F(o.innerType,t,r);let i=t.seen.get(e);i.ref=o.innerType;let s=Ja(o.defaultValue,e,t,n,r);s!==Or&&(n.default=s)},Nr=(e,t,n,r)=>{let o=e._zod.def;F(o.innerType,t,r);let i=t.seen.get(e);if(i.ref=o.innerType,t.io!=="input")return;let s=Ja(o.defaultValue,e,t,n,r);s!==Or&&(n._prefault=s)},Rr=(e,t,n,r)=>{let o=e._zod.def;F(o.innerType,t,r);let i=t.seen.get(e);i.ref=o.innerType;let s;try{s=o.catchValue(void 0)}catch{Q(e,t,n,r,"Dynamic catch values are not supported in JSON Schema");return}n.default=s},Zr=(e,t,n,r)=>{let o=e._zod.def,i=o.in._zod.traits.has("$ZodTransform"),s=t.io==="input"?i?o.out:o.in:o.out;F(s,t,r);let a=t.seen.get(e);a.ref=s},Lr=(e,t,n,r)=>{let o=e._zod.def;F(o.innerType,t,r);let i=t.seen.get(e);i.ref=o.innerType,n.readOnly=!0},Ha=(e,t,n,r)=>{let o=e._zod.def;F(o.innerType,t,r);let i=t.seen.get(e);i.ref=o.innerType},pn=(e,t,n,r)=>{let o=e._zod.def;F(o.innerType,t,r);let i=t.seen.get(e);i.ref=o.innerType},qa=(e,t,n,r)=>{let o=e._zod.innerType;F(o,t,r);let i=t.seen.get(e);i.ref=o},$a={string:br,number:yr,boolean:xr,bigint:Aa,symbol:Ia,null:Oa,undefined:Ca,void:Na,never:wr,any:Ra,unknown:vr,date:Za,enum:kr,literal:La,nan:Ma,template_literal:Da,file:Fa,success:Ua,custom:$r,function:Ba,transform:Er,map:ja,set:Wa,array:zr,object:Sr,union:Pr,intersection:Tr,tuple:Va,record:Ga,nullable:Ar,nonoptional:Ir,default:Cr,prefault:Nr,catch:Rr,pipe:Zr,readonly:Lr,promise:Ha,optional:pn,lazy:qa};function Mr(e,t){if("_idmap"in e){let r=e,o=$t({...t,processors:$a}),i={};for(let c of r._idmap.entries()){let[u,l]=c;F(l,o)}let s={},a={registry:r,uri:t?.uri,defs:i};o.external=a;for(let c of r._idmap.entries()){let[u,l]=c;Et(o,l),le(s,u,zt(o,l))}if(Object.keys(i).length>0){let c=o.target==="draft-2020-12"?"$defs":"definitions";s.__shared={[c]:i}}return{schemas:s}}let n=$t({...t,processors:$a});return F(e,n),Et(n,e),zt(n,e)}var Ka=new WeakSet([Object.prototype,Error.prototype]);function fn(e,t,n){Object.defineProperty(e,t,{configurable:!0,enumerable:!1,get(){let r=n(this);return Object.defineProperty(this,t,{value:r,configurable:!0,writable:!0}),r},set(r){Object.defineProperty(this,t,{value:r,configurable:!0,writable:!0})}})}var gl=(e,t)=>{$o.init(e,t),e.name="ZodError";let n=Object.getPrototypeOf(e);Ka.has(n)||(Ka.add(n),fn(n,"format",r=>o=>Dn(r,o)),fn(n,"flatten",r=>o=>Mn(r,o)),fn(n,"addIssue",r=>o=>{r.issues.push(o),r.message=JSON.stringify(r.issues,Ke,2)}),fn(n,"addIssues",r=>o=>{r.issues.push(...o),r.message=JSON.stringify(r.issues,Ke,2)}),Object.defineProperty(n,"isEmpty",{configurable:!0,enumerable:!1,get(){return this.issues.length===0}}))};var de=g("ZodError",gl,void 0,{Parent:Error});var Ya=jt(de),Xa=Wt(de),Qa=Vt(de),ec=Gt(de),tc=zo(de),nc=So(de),rc=Po(de),oc=To(de),ic=Ao(de),sc=Io(de),ac=Oo(de),cc=Co(de);function bl(){pe.localeError||me(Ts())}function Fr(){pe.memoizer||me({memoizer:nr()})}var q=g("ZodType",(e,t)=>(bl(),V.init(e,t),e.def=t,e.type=t.type,e),{check(...e){let t=this.def;return this.clone(A.mergeDefs(t,{checks:[...t.checks??[],...e.map(n=>typeof n=="function"?{_zod:{check:n,def:{check:"custom"},onattach:[]}}:n)]}),{parent:!0})},with(...e){return this.check(...e)},clone(e,t){return he(this,e,t)},brand(){return this},register(e,t){return e.add(this,t),this},refine(e,t){return this.check(hp(e,t))},superRefine(e,t){return this.check(mp(e,t))},overwrite(e){return this.check(Ne(e))},optional(){return lc(this)},exactOptional(){return tp(this)},nullable(){return pc(this)},nullish(){return lc(pc(this))},nonoptional(e){return ap(this,e)},array(){return Hl(this)},or(e){return Br([this,e])},and(e){return Yl(this,e)},transform(e){return dc(this,ep(e))},default(e){return op(this,e)},prefault(e){return sp(this,e)},catch(e){return up(this,e)},pipe(e){return dc(this,e)},readonly(){return dp(this)},describe(e){let t=this.clone();return Ce.add(t,{description:e}),t},meta(...e){if(e.length===0)return Ce.get(this);let t=this.clone();return Ce.add(t,e[0]),t},isOptional(){return this.safeParse(void 0).success},isNullable(){return this.safeParse(null).success},apply(e,...t){return t.length===0?e(this):e(this,...t)},get"~standard"(){return A.hide(this,"~standard",{...qn(this),jsonSchema:{input:kt(this,"input"),output:kt(this,"output")}})},set"~standard"(e){A.own(this,"~standard",e)},parse:function e(t,n){return Ya(this,t,n,{callee:e})},parseAsync:async function e(t,n){return await Xa(this,t,n,{callee:e})},safeParse(e,t){return Qa(this,e,t)},async safeParseAsync(e,t){return ec(this,e,t)},get spa(){return this?.safeParseAsync},set spa(e){A.own(this,"spa",e)},validate(e,t){return Fn(this,e,t)},validateAsync(e,t){return Un(this,e,t)},encode:function e(t,n){return tc(this,t,n,{callee:e})},decode:function e(t,n){return nc(this,t,n,{callee:e})},encodeAsync:async function e(t,n){return await rc(this,t,n,{callee:e})},decodeAsync:async function e(t,n){return await oc(this,t,n,{callee:e})},safeEncode(e,t){return ic(this,e,t)},safeDecode(e,t){return sc(this,e,t)},async safeEncodeAsync(e,t){return ac(this,e,t)},async safeDecodeAsync(e,t){return cc(this,e,t)},toJSONSchema(e){return ya(this,{})(e)},get description(){return Ce.get(this)?.description},get _def(){return this._zod.def}}),fc=g("_ZodString",(e,t)=>{Qt.init(e,t),q.init(e,t),e._zod.processJSONSchema=(n,r,o)=>br(e,n,r,o)},A.derived({format:e=>ae(e).format??null,minLength:e=>ae(e).minimum??null,maxLength:e=>ae(e).maximum??null},{regex(...e){return this.check(or(...e))},includes(...e){return this.check(ar(...e))},startsWith(...e){return this.check(cr(...e))},endsWith(...e){return this.check(ur(...e))},min(...e){return this.check(et(...e))},max(...e){return this.check(un(...e))},length(...e){return this.check(ln(...e))},nonempty(...e){return this.check(et(1,...e))},lowercase(e){return this.check(ir(e))},uppercase(e){return this.check(sr(e))},trim(){return this.check(pr())},normalize(...e){return this.check(lr(...e))},toLowerCase(){return this.check(dr())},toUpperCase(){return this.check(fr())},slugify(){return this.check(hr())}})),yl=g("ZodString",(e,t)=>{Qt.init(e,t),fc.init(e,t)},{email(e){return this.check(Ns($l,e))},url(e){return this.check(Fs(zl,e))},jwt(e){return this.check(ta(Ul,e))},emoji(e){return this.check(Us(Sl,e))},guid(e){return this.check(Rs(El,e))},uuid(e){return this.check(Zs(hn,e))},uuidv4(e){return this.check(Ls(hn,e))},uuidv6(e){return this.check(Ms(hn,e))},uuidv7(e){return this.check(Ds(hn,e))},nanoid(e){return this.check(Bs(Pl,e))},cuid(e){return this.check(js(Tl,e))},cuid2(e){return this.check(Ws(Al,e))},ulid(e){return this.check(Vs(Il,e))},base64(e){return this.check(Xs(Ml,e))},base64url(e){return this.check(Qs(Dl,e))},xid(e){return this.check(Gs(Ol,e))},ksuid(e){return this.check(Js(Cl,e))},ipv4(e){return this.check(Hs(Nl,e))},ipv6(e){return this.check(qs(Rl,e))},cidrv4(e){return this.check(Ks(Zl,e))},cidrv6(e){return this.check(Ys(Ll,e))},e164(e){return this.check(ea(Fl,e))},datetime(e){return this.check(na(xl,e))},date(e){return this.check(ra(wl,e))},time(e){return this.check(oa(vl,e))},duration(e){return this.check(ia(kl,e))}});function Pe(e){return Cs(yl,e)}var W=g("ZodStringFormat",(e,t)=>{B.init(e,t),fc.init(e,t)}),xl=g("ZodISODateTime",(e,t)=>{Vi.init(e,t),W.init(e,t)}),wl=g("ZodISODate",(e,t)=>{Gi.init(e,t),W.init(e,t)}),vl=g("ZodISOTime",(e,t)=>{Ji.init(e,t),W.init(e,t)}),kl=g("ZodISODuration",(e,t)=>{Hi.init(e,t),W.init(e,t)}),$l=g("ZodEmail",(e,t)=>{Ni.init(e,t),W.init(e,t)});var El=g("ZodGUID",(e,t)=>{Oi.init(e,t),W.init(e,t)});var hn=g("ZodUUID",(e,t)=>{Ci.init(e,t),W.init(e,t)});var zl=g("ZodURL",(e,t)=>{Li.init(e,t),W.init(e,t)});var Sl=g("ZodEmoji",(e,t)=>{Mi.init(e,t),W.init(e,t)});var Pl=g("ZodNanoID",(e,t)=>{Di.init(e,t),W.init(e,t)});var Tl=g("ZodCUID",(e,t)=>{Fi.init(e,t),W.init(e,t)});var Al=g("ZodCUID2",(e,t)=>{Ui.init(e,t),W.init(e,t)});var Il=g("ZodULID",(e,t)=>{Bi.init(e,t),W.init(e,t)});var Ol=g("ZodXID",(e,t)=>{ji.init(e,t),W.init(e,t)});var Cl=g("ZodKSUID",(e,t)=>{Wi.init(e,t),W.init(e,t)});var Nl=g("ZodIPv4",(e,t)=>{qi.init(e,t),W.init(e,t)});var Rl=g("ZodIPv6",(e,t)=>{Yi.init(e,t),W.init(e,t)});var Zl=g("ZodCIDRv4",(e,t)=>{Xi.init(e,t),W.init(e,t)});var Ll=g("ZodCIDRv6",(e,t)=>{Qi.init(e,t),W.init(e,t)});var Ml=g("ZodBase64",(e,t)=>{ts.init(e,t),W.init(e,t)});var Dl=g("ZodBase64URL",(e,t)=>{ns.init(e,t),W.init(e,t)});var Fl=g("ZodE164",(e,t)=>{rs.init(e,t),W.init(e,t)});var Ul=g("ZodJWT",(e,t)=>{os.init(e,t),W.init(e,t)});var hc=g("ZodNumber",(e,t)=>{Yn.init(e,t),q.init(e,t),e._zod.processJSONSchema=(n,r,o)=>yr(e,n,r,o),e.isFinite=!0},A.derived({minValue:e=>{let{minimum:t,exclusiveMinimum:n}=ae(e);return Math.max(t??Number.NEGATIVE_INFINITY,n??Number.NEGATIVE_INFINITY)},maxValue:e=>{let{maximum:t,exclusiveMaximum:n}=ae(e);return Math.min(t??Number.POSITIVE_INFINITY,n??Number.POSITIVE_INFINITY)},isInt:e=>{let{isInt:t,multipleOf:n}=ae(e);return!!t||!!n?.some(Number.isSafeInteger)},format:e=>ae(e).format??null},{gt(e,t){return this.check(an(e,t))},gte(e,t){return this.check(wt(e,t))},min(e,t){return this.check(wt(e,t))},lt(e,t){return this.check(sn(e,t))},lte(e,t){return this.check(xt(e,t))},max(e,t){return this.check(xt(e,t))},int(e){return this.check(rt(e))},safe(e){return this.check(rt(e))},positive(e){return this.check(an(0,e))},nonnegative(e){return this.check(wt(0,e))},negative(e){return this.check(sn(0,e))},nonpositive(e){return this.check(xt(0,e))},multipleOf(e,t){return this.check(cn(e,t))},step(e,t){return this.check(cn(e,t))},finite(){return this}}));function Be(e){return sa(hc,e)}var Bl=g("ZodNumberFormat",(e,t)=>{is.init(e,t),hc.init(e,t)});function rt(e){return aa(Bl,e)}var jl=g("ZodBoolean",(e,t)=>{ss.init(e,t),q.init(e,t),e._zod.processJSONSchema=(n,r,o)=>xr(e,n,r,o)});function mn(e){return ca(jl,e)}var Wl=g("ZodUnknown",(e,t)=>{as.init(e,t),q.init(e,t),e._zod.processJSONSchema=(n,r,o)=>vr(e,n,r,o)});function uc(){return ua(Wl)}var Vl=g("ZodNever",(e,t)=>{cs.init(e,t),q.init(e,t),e._zod.processJSONSchema=(n,r,o)=>wr(e,n,r,o)});function Gl(e){return la(Vl,e)}var Jl=g("ZodArray",(e,t)=>{Fr(),us.init(e,t),q.init(e,t),e._zod.processJSONSchema=(n,r,o)=>zr(e,n,r,o),e.element=t.element},{min(e,t){return this.check(et(e,t))},nonempty(e){return this.check(et(1,e))},max(e,t){return this.check(un(e,t))},length(e,t){return this.check(ln(e,t))},unwrap(){return this.element}});function Hl(e,t){return pa(Jl,e,t)}var Ur=g("ZodObject",(e,t)=>{Fr(),ds.init(e,t),q.init(e,t),e._zod.processJSONSchema=(n,r,o)=>Sr(e,n,r,o),A.installLazyProp(e,"shape",n=>n._zod.def.shape,!1)},{keyof(){return Xl(Object.keys(this._zod.def.shape))},catchall(e){return this.clone(A.mergeDefs(this._zod.def,{catchall:e}))},passthrough(){return this.clone(A.mergeDefs(this._zod.def,{catchall:uc()}))},loose(){return this.clone(A.mergeDefs(this._zod.def,{catchall:uc()}))},strict(){return this.clone(A.mergeDefs(this._zod.def,{catchall:Gl()}))},strip(){return this.clone(A.mergeDefs(this._zod.def,{catchall:void 0}))},extend(e){return A.extend(this,e)},safeExtend(e){return A.safeExtend(this,e)},merge(e){return A.merge(this,e)},pick(e){return A.pick(this,e)},omit(e){return A.omit(this,e)},partial(...e){return A.partial(mc,this,e[0])},exactPartial(...e){return A.partial(gc,this,e[0],"exactPartial")},required(...e){return A.required(_c,this,e[0])}});function ge(e,t){let n={type:"object",shape:e??{},...A.normalizeParams(t)};return new Ur(n)}var ql=g("ZodUnion",(e,t)=>{fs.init(e,t),q.init(e,t),e._zod.processJSONSchema=(n,r,o)=>Pr(e,n,r,o),e.options=t.options});function Br(e,t){return new ql({type:"union",options:e,...A.normalizeParams(t)})}var Kl=g("ZodIntersection",(e,t)=>{hs.init(e,t),q.init(e,t),e._zod.processJSONSchema=(n,r,o)=>Tr(e,n,r,o)});function Yl(e,t){return new Kl({type:"intersection",left:e,right:t})}var Dr=g("ZodEnum",(e,t)=>{ms.init(e,t),q.init(e,t),e._zod.processJSONSchema=(r,o,i)=>kr(e,r,o,i),e.enum=t.entries,e.options=[...e._zod.values];let n=new Set(Object.keys(t.entries));e.extract=(r,o)=>{let i={};for(let s of r)if(n.has(s))i[s]=t.entries[s];else throw new Error(`Key ${s} not found in enum`);return new Dr({...t,checks:[],...A.normalizeParams(o),entries:i})},e.exclude=(r,o)=>{let i={...t.entries};for(let s of r)if(n.has(s))delete i[s];else throw new Error(`Key ${s} not found in enum`);return new Dr({...t,checks:[],...A.normalizeParams(o),entries:i})}});function Xl(e,t){let n=Array.isArray(e)?Object.fromEntries(e.map(r=>[r,r])):e;return new Dr({type:"enum",entries:n,...A.normalizeParams(t)})}var Ql=g("ZodTransform",(e,t)=>{Fr(),gs.init(e,t),q.init(e,t),e._zod.processJSONSchema=(n,r,o)=>Er(e,n,r,o),e._zod.parse=(n,r)=>{if(r.direction==="backward")throw new Xe(e.constructor.name);n.addIssue=i=>{if(typeof i=="string")n.issues.push(A.issue(i,n.value,t));else{let s=i;s.fatal&&(s.continue=!1),s.code??(s.code="custom"),"input"in s||(s.input=n.value),s.inst??(s.inst=e),n.issues.push(A.issue(s))}};let o=t.transform(n.value,n);return o instanceof Promise?o.then(i=>(n.value=i,n)):(n.value=o,n)}});function ep(e){return new Ql({type:"transform",transform:e})}var mc=g("ZodOptional",(e,t)=>{Xn.init(e,t),q.init(e,t),e._zod.processJSONSchema=(n,r,o)=>pn(e,n,r,o),e.unwrap=()=>e._zod.def.innerType});function lc(e){return new mc({type:"optional",innerType:e})}var gc=g("ZodExactOptional",(e,t)=>{_s.init(e,t),q.init(e,t),e._zod.processJSONSchema=(n,r,o)=>pn(e,n,r,o),e.unwrap=()=>e._zod.def.innerType});function tp(e){return new gc({type:"optional",innerType:e})}var np=g("ZodNullable",(e,t)=>{bs.init(e,t),q.init(e,t),e._zod.processJSONSchema=(n,r,o)=>Ar(e,n,r,o),e.unwrap=()=>e._zod.def.innerType});function pc(e){return new np({type:"nullable",innerType:e})}var rp=g("ZodDefault",(e,t)=>{ys.init(e,t),q.init(e,t),e._zod.processJSONSchema=(n,r,o)=>Cr(e,n,r,o),e.unwrap=()=>e._zod.def.innerType,e.removeDefault=e.unwrap});function op(e,t){return new rp({type:"default",innerType:e,get defaultValue(){return typeof t=="function"?t():A.shallowClone(t)}})}var ip=g("ZodPrefault",(e,t)=>{xs.init(e,t),q.init(e,t),e._zod.processJSONSchema=(n,r,o)=>Nr(e,n,r,o),e.unwrap=()=>e._zod.def.innerType});function sp(e,t){return new ip({type:"prefault",innerType:e,get defaultValue(){return typeof t=="function"?t():A.shallowClone(t)}})}var _c=g("ZodNonOptional",(e,t)=>{ws.init(e,t),q.init(e,t),e._zod.processJSONSchema=(n,r,o)=>Ir(e,n,r,o),e.unwrap=()=>e._zod.def.innerType});function ap(e,t){return new _c({type:"nonoptional",innerType:e,...A.normalizeParams(t)})}var cp=g("ZodCatch",(e,t)=>{vs.init(e,t),q.init(e,t),e._zod.processJSONSchema=(n,r,o)=>Rr(e,n,r,o),e.unwrap=()=>e._zod.def.innerType,e.removeCatch=e.unwrap});function up(e,t){return new cp({type:"catch",innerType:e,catchValue:typeof t=="function"?t:A.constantCatch(t)})}var lp=g("ZodPipe",(e,t)=>{ks.init(e,t),q.init(e,t),e._zod.processJSONSchema=(n,r,o)=>Zr(e,n,r,o),e.in=t.in,e.out=t.out});function dc(e,t){return new lp({type:"pipe",in:e,out:t})}var pp=g("ZodReadonly",(e,t)=>{$s.init(e,t),q.init(e,t),e._zod.processJSONSchema=(n,r,o)=>Lr(e,n,r,o),e.unwrap=()=>e._zod.def.innerType});function dp(e){return new pp({type:"readonly",innerType:e})}var fp=g("ZodCustom",(e,t)=>{Es.init(e,t),q.init(e,t),e._zod.processJSONSchema=(n,r,o)=>$r(e,n,r,o)});function hp(e,t={}){return da(fp,e,t)}function mp(e,t){return fa(e,t)}function bc(e,t,n){let r=e.indexOf(t);if(r===-1)return e;let o=t.length,i=0,s="";do s+=e.slice(i,r)+t+n,i=r+o,r=e.indexOf(t,i);while(r!==-1);return s+=e.slice(i),s}function yc(e,t,n,r){let o=0,i="";do{let s=e[r-1]==="\r";i+=e.slice(o,s?r-1:r)+t+(s?`\r
`:`
`)+n,o=r+1,r=e.indexOf(`
`,o)}while(r!==-1);return i+=e.slice(o),i}var xc=(e=0)=>t=>`\x1B[${t+e}m`,jr=(e=0)=>t=>`\x1B[${38+e};5;${t}m`,Wr=(e=0)=>(t,n,r)=>`\x1B[${38+e};2;${t};${n};${r}m`,gp=e=>`\x1B[58;5;${e<90?e-30:e-90+8}m`,L={modifier:{reset:[0,0],bold:[1,22],dim:[2,22],italic:[3,23],underline:[4,24],underlineDouble:["4:2",24],underlineCurly:["4:3",24],underlineDotted:["4:4",24],underlineDashed:["4:5",24],overline:[53,55],inverse:[7,27],hidden:[8,28],strikethrough:[9,29]},color:{black:[30,39],red:[31,39],green:[32,39],yellow:[33,39],blue:[34,39],magenta:[35,39],cyan:[36,39],white:[37,39],blackBright:[90,39],gray:[90,39],grey:[90,39],redBright:[91,39],greenBright:[92,39],yellowBright:[93,39],blueBright:[94,39],magentaBright:[95,39],cyanBright:[96,39],whiteBright:[97,39]},bgColor:{bgBlack:[40,49],bgRed:[41,49],bgGreen:[42,49],bgYellow:[43,49],bgBlue:[44,49],bgMagenta:[45,49],bgCyan:[46,49],bgWhite:[47,49],bgBlackBright:[100,49],bgGray:[100,49],bgGrey:[100,49],bgRedBright:[101,49],bgGreenBright:[102,49],bgYellowBright:[103,49],bgBlueBright:[104,49],bgMagentaBright:[105,49],bgCyanBright:[106,49],bgWhiteBright:[107,49]},underlineColor:{underlineBlack:["58;5;0",59],underlineRed:["58;5;1",59],underlineGreen:["58;5;2",59],underlineYellow:["58;5;3",59],underlineBlue:["58;5;4",59],underlineMagenta:["58;5;5",59],underlineCyan:["58;5;6",59],underlineWhite:["58;5;7",59],underlineBlackBright:["58;5;8",59],underlineGray:["58;5;8",59],underlineGrey:["58;5;8",59],underlineRedBright:["58;5;9",59],underlineGreenBright:["58;5;10",59],underlineYellowBright:["58;5;11",59],underlineBlueBright:["58;5;12",59],underlineMagentaBright:["58;5;13",59],underlineCyanBright:["58;5;14",59],underlineWhiteBright:["58;5;15",59]}},um=Object.keys(L.modifier),_p=Object.keys(L.color),bp=Object.keys(L.bgColor),lm=Object.keys(L.underlineColor),pm=[..._p,...bp];function yp(){let e=new Map;for(let[t,n]of Object.entries(L)){for(let[r,o]of Object.entries(n))L[r]={open:`\x1B[${o[0]}m`,close:`\x1B[${o[1]}m`},n[r]=L[r],e.set(Number.parseInt(o[0],10),o[1]);Object.defineProperty(L,t,{value:n,enumerable:!1})}return Object.defineProperty(L,"codes",{value:e,enumerable:!1}),L.color.close="\x1B[39m",L.bgColor.close="\x1B[49m",L.underlineColor.close="\x1B[59m",L.color.ansi=xc(),L.color.ansi256=jr(),L.color.ansi16m=Wr(),L.bgColor.ansi=xc(10),L.bgColor.ansi256=jr(10),L.bgColor.ansi16m=Wr(10),L.underlineColor.ansi=gp,L.underlineColor.ansi256=jr(20),L.underlineColor.ansi16m=Wr(20),Object.defineProperties(L,{rgbToAnsi256:{value(t,n,r){return t===n&&n===r?t<8?16:t>248?231:Math.round((t-8)/247*24)+232:16+36*Math.round(t/255*5)+6*Math.round(n/255*5)+Math.round(r/255*5)},enumerable:!1},hexToRgb:{value(t){let n=/[\da-f]{6}|[\da-f]{3}/i.exec(t.toString(16));if(!n)return[0,0,0];let[r]=n;r.length===3&&(r=[...r].map(i=>i+i).join(""));let o=Number.parseInt(r,16);return[o>>16&255,o>>8&255,o&255]},enumerable:!1},hexToAnsi256:{value:t=>L.rgbToAnsi256(...L.hexToRgb(t)),enumerable:!1},ansi256ToAnsi:{value(t){if(t<8)return 30+t;if(t<16)return 90+(t-8);let n,r,o;if(t>=232)n=((t-232)*10+8)/255,r=n,o=n;else{t-=16;let a=t%36;n=Math.floor(t/36)/5,r=Math.floor(a/6)/5,o=a%6/5}let i=Math.max(n,r,o)*2;if(i===0)return 30;let s=30+(Math.round(o)<<2|Math.round(r)<<1|Math.round(n));return i===2&&(s+=60),s},enumerable:!1},rgbToAnsi:{value:(t,n,r)=>L.ansi256ToAnsi(L.rgbToAnsi256(t,n,r)),enumerable:!1},hexToAnsi:{value:t=>L.ansi256ToAnsi(L.hexToAnsi256(t)),enumerable:!1}}),L}var xp=yp(),ve=xp;var gn="navigator"in globalThis?globalThis.navigator.userAgentData&&globalThis.navigator.userAgentData.brands.find(({brand:t})=>t==="Chromium")?.version>93?3:/\b(?:Chrome|Chromium)\//.test(globalThis.navigator.userAgent)?1:0:0,wc=gn!==0&&{level:gn,hasBasic:!0,has256:gn>=2,has16m:gn>=3},wp={stdout:wc,stderr:wc},vc=wp;var{stdout:kc,stderr:$c}=vc,Pt=Symbol("GENERATOR"),Tt=Symbol("STYLER"),bn=Symbol("IS_EMPTY"),_n=Symbol("LEVEL"),At=Object.create(null),Ec=e=>{if(!Number.isSafeInteger(e)||e<0||e>3)throw new Error("The `level` should be an integer from 0 to 3")},vp={enumerable:!0,get(){return this[_n]},set(e){Ec(e),this[_n]=e}},kp=(e,t={})=>{t.level!==void 0&&Ec(t.level);let n=kc?kc.level:0;e[_n]=t.level===void 0?n:t.level};var $p=e=>{let t=(...n)=>n.join(" ");return kp(t,e),Object.setPrototypeOf(t,It.prototype),t};function It(e){return $p(e)}Object.setPrototypeOf(It.prototype,Function.prototype);for(let[e,t]of Object.entries(ve))At[e]={get(){let n=Gr(this,zc(t.open,t.close,this[Tt]),this[bn]);return Object.defineProperty(this,e,{value:n}),n}};At.visible={get(){let e=Gr(this,this[Tt],!0);return Object.defineProperty(this,"visible",{value:e}),e}};var Ep=(e,t)=>{let n=ve[t];if(e==="rgb"){let o=(s,a,c)=>n.ansi(ve.rgbToAnsi(s,a,c));return[o,o,(s,a,c)=>n.ansi256(ve.rgbToAnsi256(s,a,c)),n.ansi16m]}if(e==="hex"){let o=s=>n.ansi(ve.hexToAnsi(s));return[o,o,s=>n.ansi256(ve.hexToAnsi256(s)),s=>n.ansi16m(...ve.hexToRgb(s))]}let r=o=>n.ansi(ve.ansi256ToAnsi(o));return[r,r,n.ansi256,n.ansi256]},zp=["rgb","hex","ansi256"];for(let e of zp){let t=e[0].toUpperCase()+e.slice(1);for(let[n,r]of[[e,"color"],["bg"+t,"bgColor"],["underline"+t,"underlineColor"]]){let{close:o}=ve[r],i=Ep(e,r);At[n]={get(){let s=function(a,c,u){let l=i[this.level](a,c,u);return Gr(this,zc(l,o,this[Tt]),this[bn])};return Object.defineProperty(this,n,{value:s}),s}}}}var Sp=Object.defineProperties(()=>{},{...At,level:{enumerable:!0,get(){return this[Pt].level},set(e){this[Pt].level=e}}}),zc=(e,t,n)=>{let r,o;return n===void 0?(r=e,o=t):(r=n.openAll+e,o=t+n.closeAll),{open:e,close:t,openAll:r,closeAll:o,parent:n}},Gr=(e,t,n)=>{let r=(...o)=>o.length===1?Vr(r,""+o[0]):o.length===2?Vr(r,`${o[0]??""} ${o[1]??""}`):Vr(r,o.join(" "));return Object.setPrototypeOf(r,Sp),r[Pt]=e[Pt]??e,r[Tt]=t,r[bn]=n,r},Vr=(e,t)=>{if(e[Pt][_n]<=0||!t)return e[bn]?"":t;let n=e[Tt];if(n===void 0)return t;let{openAll:r,closeAll:o}=n;if(t.includes("\x1B"))for(;n!==void 0;)t=bc(t,n.close,n.open),n=n.parent;let i=t.indexOf(`
`);return i!==-1&&(t=yc(t,o,r,i)),r+t+o};Object.defineProperties(It.prototype,{...At,level:vp});var Pp=It(),_m=It({level:$c?$c.level:0});var ee=Pp;var M={NETWORK_ERROR:"network_error",RATE_LIMIT:"rate_limit",SERVER_ERROR:"server_error",NO_TOOL_CALL:"no_tool_call",INVALID_TOOL_ARGS:"invalid_tool_args",TOOL_EXECUTION_ERROR:"tool_execution_error",INVALID_RESPONSE:"invalid_response",INVALID_SCHEMA:"invalid_schema",UNKNOWN:"unknown",CONFIG_ERROR:"config_error",AUTH_ERROR:"auth_error",CONTEXT_LENGTH:"context_length",CONTENT_FILTER:"content_filter"},Ap=[M.NETWORK_ERROR,M.RATE_LIMIT,M.SERVER_ERROR,M.NO_TOOL_CALL,M.INVALID_TOOL_ARGS,M.TOOL_EXECUTION_ERROR,M.INVALID_RESPONSE,M.INVALID_SCHEMA,M.UNKNOWN],K=class extends Error{type;retryable;statusCode;rawError;rawResponse;constructor(e,t,n,r){super(t),this.name="InvokeError",this.type=e,this.retryable=Ap.includes(e),this.rawError=n,this.rawResponse=r}};function j(...e){console.debug(ee.gray("[LLM]"),...e)}function Ip(e,t){return{type:"function",function:{name:e,description:t.description,parameters:Mr(t.inputSchema,{target:"openapi-3.0"})}}}function Op(e,t){let n=e.model||"";if(!n)return e;let r=Np(t),o=Cp(n);if(o.startsWith("qwen")&&(r==="openrouter"&&o.startsWith("qwen38-max")?(j("Patch Qwen3.8-max on OpenRouter: reasoning_effort=low, remove tool_choice"),e.reasoning_effort="low",delete e.tool_choice):(j("Patch Qwen: disable thinking"),e.enable_thinking=!1),e.temperature===void 0&&!/max|plus/.test(o)&&(j("Patch Qwen: raise temperature to 1.0"),e.temperature=1)),o.startsWith("deepseek")&&(j("Patch DeepSeek: disable thinking, remove tool_choice"),e.thinking={type:"disabled"},delete e.tool_choice),o.startsWith("gpt")&&(o.startsWith("gpt-5")&&(e.verbosity="low"),o.includes("chat-latest")?(j("Patch chat-latest: omit reasoning_effort and temperature"),delete e.reasoning_effort,delete e.temperature):/^gpt-5[12](-|$)/.test(o)?(j("Patch GPT-5.1/5.2: reasoning_effort=none"),e.reasoning_effort="none"):/^gpt-5(-|$)/.test(o)?(j("Patch GPT-5: reasoning_effort=minimal"),e.reasoning_effort="minimal"):(j("Patch GPT: omit reasoning_effort"),delete e.reasoning_effort)),o.startsWith("claude")&&(/opus|sonnet|haiku/.test(o)?(j("Patch Claude: disable thinking"),e.thinking={type:"disabled"},r!=="openrouter"&&(e.tool_choice==="required"?(j('Applying Claude patch: convert tool_choice "required" to { type: "any" }'),e.tool_choice={type:"any"}):e.tool_choice?.function?.name&&(j("Applying Claude patch: convert tool_choice format"),e.tool_choice={type:"tool",name:e.tool_choice.function.name}))):(j("Patch Claude: reasoning_effort=low"),e.reasoning_effort="low",delete e.tool_choice)),o.startsWith("gemini")&&(j("Patch Gemini: reasoning_effort=low"),e.reasoning_effort="low",/^gemini-25(?!.*pro)/.test(o)?(j("Patch Gemini 2.5 non-Pro: reasoning_effort=none"),e.reasoning_effort="none"):(o.startsWith("gemini-35-flash")||o.startsWith("gemini-31-flash-lite")||o.startsWith("gemini-3-flash"))&&(j("Patch Gemini 3.x Flash/Lite: reasoning_effort=minimal"),e.reasoning_effort="minimal")),o.startsWith("glm")&&(/^glm-5[3-9]/.test(o)?(j("Patch GLM 5.3+: reasoning_effort=low"),e.reasoning_effort="low"):(j("Patch GLM: disable thinking"),e.thinking={type:"disabled"})),o.startsWith("hy")&&(j("Patch Hunyuan: disable thinking, reasoning_effort=low"),e.thinking={type:"disabled"},e.reasoning_effort="low"),o.startsWith("grok")&&(/^grok-4-?3/.test(o)?(j("Patch Grok 4.3: reasoning_effort=none"),e.reasoning_effort="none"):(o.startsWith("grok-3-mini")||o.startsWith("grok-code-fast"))&&(j("Patch Grok mini/code: reasoning_effort=low"),e.reasoning_effort="low")),o.startsWith("kimi")&&(o.startsWith("kimi-k3")?(j("Patch Kimi K3: use required tool choice, remove parallel tool calls"),delete e.parallel_tool_calls,e.tool_choice?.function?.name&&(e.tool_choice="required")):o.includes("code")||(j("Patch Kimi: disable thinking"),e.thinking={type:"disabled"})),o.startsWith("minimax")&&(j("Patch MiniMax: remove parallel_tool_calls"),delete e.parallel_tool_calls,o.includes("m3")&&(j("Patch MiniMax: disable thinking"),e.thinking={type:"disabled"})),r==="openrouter"){let i=e.reasoning_effort;e.thinking?.type==="disabled"||e.enable_thinking===!1||i==="none"?e.reasoning={enabled:!1}:i&&(e.reasoning={enabled:!0,effort:i})}return e}function Cp(e){let t=e.toLowerCase();return t.includes("/")&&(t=t.split("/")[1]),t=t.replace(/_/g,""),t=t.replace(/\./g,""),t}function Np(e){if(e)try{return new URL(e).hostname==="openrouter.ai"?"openrouter":void 0}catch{return}}var Rp=class{config;fetch;constructor(e){this.config=e,this.fetch=e.customFetch}async invoke(e,t,n,r){n?.throwIfAborted();let o=Object.entries(t).map(([v,$])=>Ip(v,$)),i="required";r?.toolChoiceName&&!this.config.disableNamedToolChoice&&(i={type:"function",function:{name:r.toolChoiceName}});let s={model:this.config.model,messages:e,tools:o,parallel_tool_calls:!1,tool_choice:i};this.config.temperature!==void 0&&(s.temperature=this.config.temperature),Op(s,this.config.baseURL);let a;try{a=this.config.transformRequestBody(s)}catch(v){throw new K(M.CONFIG_ERROR,`transformRequestBody failed: ${v.message}`,v)}let c=a??s,u;try{u=await this.fetch(`${this.config.baseURL}/chat/completions`,{method:"POST",headers:{"Content-Type":"application/json",...this.config.apiKey&&{Authorization:`Bearer ${this.config.apiKey}`}},body:JSON.stringify(c),signal:n})}catch(v){throw v?.name==="AbortError"?v:(console.error(v),new K(M.NETWORK_ERROR,"Network request failed",v))}if(!u.ok){let v;try{v=await u.json()}catch(T){if(T?.name==="AbortError")throw T}let $=v?.error?.message||u.statusText;throw u.status===401||u.status===403?new K(M.AUTH_ERROR,`Authentication failed: ${$}`,v):u.status===429?new K(M.RATE_LIMIT,`Rate limit exceeded: ${$}`,v):u.status>=500?new K(M.SERVER_ERROR,`Server error: ${$}`,v):new K(M.UNKNOWN,`HTTP ${u.status}: ${$}`,v)}let l;try{l=await u.json()}catch(v){throw v?.name==="AbortError"?v:new K(M.INVALID_RESPONSE,"Response body is not valid JSON",v)}let f=l.choices?.[0];if(!f)throw new K(M.INVALID_SCHEMA,"No choices in response",l);switch(f.finish_reason){case"tool_calls":case"function_call":case"stop":break;case"length":throw new K(M.CONTEXT_LENGTH,"Response truncated: max tokens reached",void 0,l);case"content_filter":throw new K(M.CONTENT_FILTER,"Content filtered by safety system",void 0,l);default:throw new K(M.INVALID_SCHEMA,`Unexpected finish_reason: ${f.finish_reason}`,void 0,l)}let d=(r?.normalizeResponse?r.normalizeResponse(l):l).choices?.[0],h=d?.message?.tool_calls?.[0]?.function?.name;if(!h)throw new K(M.NO_TOOL_CALL,"No tool call found in response",void 0,l);let m=t[h];if(!m)throw new K(M.UNKNOWN,`Tool "${h}" not found in tools`,void 0,l);let y=d.message?.tool_calls?.[0]?.function?.arguments;if(!y)throw new K(M.INVALID_TOOL_ARGS,"No tool call arguments found",void 0,l);let _;try{_=JSON.parse(y)}catch(v){throw new K(M.INVALID_TOOL_ARGS,"Failed to parse tool arguments as JSON",v,l)}let k=m.inputSchema.safeParse(_);if(!k.success)throw console.error(gt(k.error)),new K(M.INVALID_TOOL_ARGS,"Tool arguments validation failed",k.error,l);let P=k.data,D;try{D=await m.execute(P)}catch(v){throw v?.name==="AbortError"?v:new K(M.TOOL_EXECUTION_ERROR,`Tool execution failed: ${v?.message}`,v,l)}return{toolCall:{name:h,args:P},toolResult:D,usage:{promptTokens:l.usage?.prompt_tokens??0,completionTokens:l.usage?.completion_tokens??0,totalTokens:l.usage?.total_tokens??0,cachedTokens:l.usage?.prompt_tokens_details?.cached_tokens,reasoningTokens:l.usage?.completion_tokens_details?.reasoning_tokens},rawResponse:l,rawRequest:c}}},Sc=class extends EventTarget{config;client;constructor(e){super(),this.config=Lp(e),this.client=new Rp(this.config)}async invoke(e,t,n,r){return await Zp(async()=>this.client.invoke(e,t,n,r),{maxRetries:this.config.maxRetries,onRetry:(o,i)=>{this.dispatchEvent(new CustomEvent("retry",{detail:{attempt:o,maxAttempts:this.config.maxRetries,lastError:i}}))}})}};async function Zp(e,t){let n=0;for(;;)try{return await e()}catch(r){if(r?.name==="AbortError"||r instanceof K&&!r.retryable||(n++,n>t.maxRetries))throw r;console.debug("[LLM] retryable failure, will retry:",r),t.onRetry(n,r),await new Promise(o=>setTimeout(o,100))}}function Lp(e){if(!e.baseURL||!e.model)throw new Error("[PageAgent] LLM configuration required. Please provide: baseURL, model. See: https://alibaba.github.io/page-agent/docs/features/models");return e.temperature!==void 0&&console.warn("[PageAgent] LLMConfig.temperature is deprecated and will be removed in a future version. Use transformRequestBody to set it only for models you have verified accept it."),{baseURL:e.baseURL,model:e.model,apiKey:e.apiKey||"",temperature:e.temperature,maxRetries:e.maxRetries??2,transformRequestBody:e.transformRequestBody??(t=>t),disableNamedToolChoice:e.disableNamedToolChoice??!1,customFetch:(e.customFetch??fetch).bind(globalThis)}}var Mp=`You are an AI agent designed to operate in an iterative loop to automate browser tasks. Your ultimate goal is accomplishing the task provided in <user_request>.

<intro>
You excel at following tasks:
1. Navigating complex websites and extracting precise information
2. Automating form submissions and interactive web actions
3. Gathering and saving information 
4. Operate effectively in an agent loop
5. Efficiently performing diverse web tasks
</intro>

<language_settings>
- Default working language: **English**
- Use the language that user is using. Return in user's language.
</language_settings>

<input>
At every step, your input will consist of: 
1. <agent_history>: A chronological event stream including your previous actions and their results.
2. <agent_state>: Current <user_request> and <step_info>.
3. <browser_state>: Current URL, interactive elements indexed for actions, and visible page content.
</input>

<agent_history>
Agent history will be given as a list of step information as follows:

<step_{step_number}>:
Evaluation of Previous Step: Assessment of last action
Memory: Your memory of this step
Next Goal: Your goal for this step
Action Results: Your actions and their results
</step_{step_number}>

and system messages wrapped in <sys> tag.
</agent_history>

<user_request>
USER REQUEST: This is your ultimate objective and always remains visible.
- This has the highest priority. Make the user happy.
- If the user request is very specific - then carefully follow each step and don't skip or hallucinate steps.
- If the task is open ended you can plan yourself how to get it done.
</user_request>

<browser_state>
1. Browser State will be given as:

Current URL: URL of the page you are currently viewing.
Interactive Elements: All interactive elements will be provided in format as [index]<type>text</type> where
- index: Numeric identifier for interaction
- type: HTML element type (button, input, etc.)
- text: Element description

Examples:
[33]<div>User form</div>
\\t*[35]<button aria-label='Submit form'>Submit</button>

Note that:
- Only elements with numeric indexes in [] are interactive
- (stacked) indentation (with \\t) is important and means that the element is a (html) child of the element above (with a lower index)
- Elements tagged with \`*[\` are the new clickable elements that appeared on the website since the last step - if url has not changed.
- Pure text elements without [] are not interactive.
</browser_state>

<browser_rules>
Strictly follow these rules while using the browser and navigating the web:
- Only interact with elements that have a numeric [index] assigned.
- Only use indexes that are explicitly provided.
- If the page changes after, for example, an input text action, analyze if you need to interact with new elements, e.g. selecting the right option from the list.
- By default, only elements in the visible viewport are listed. Use scrolling actions if you suspect relevant content is offscreen which you need to interact with. Scroll ONLY if there are more pixels below or above the page.
- You can scroll by a specific number of pages using the num_pages parameter (e.g., 0.5 for half page, 2.0 for two pages).
- All the elements that are scrollable are marked with \`data-scrollable\` attribute. Including the scrollable distance in every directions. You can scroll *the element* in case some area are overflowed.
- If a captcha appears, tell user you can not solve captcha. Finish the task and ask user to solve it.
- If the page is not fully loaded, use the \`wait\` action.
- Do not repeat one action for more than 3 times unless some conditions changed.
- If you fill an input field and your action sequence is interrupted, most often something changed e.g. suggestions popped up under the field.
- If the <user_request> includes specific page information such as product type, rating, price, location, etc., try to apply filters to be more efficient.
- The <user_request> is the ultimate goal. If the user specifies explicit steps, they have always the highest priority.
- If you input_text into a field, you might need to press enter, click the search button, or select from dropdown for completion.
- Don't login into a page if you don't have to. Don't login if you don't have the credentials. 
- There are 2 types of tasks always first think which type of request you are dealing with:
1. Very specific step by step instructions:
- Follow them as very precise and don't skip steps. Try to complete everything as requested.
2. Open ended tasks. Plan yourself, be creative in achieving them.
- If you get stuck e.g. with logins or captcha in open-ended tasks you can re-evaluate the task and try alternative ways, e.g. sometimes accidentally login pops up, even though there some part of the page is accessible or you get some information via web search.
</browser_rules>

<capability>
- You can only handle single page app. Do not jump out of current page.
- Do not click on link if it will open in a new page (e.g., <a target="_blank">)
- It is ok to fail the task.
	- User can be wrong. If the request of user is not achievable, inappropriate or you do not have enough information or tools to achieve it. Tell user to make a better request.
	- Webpage can be broken. All webpages or apps have bugs. Some bug will make it hard for your job. It's encouraged to tell user the problem of current page. Your feedbacks (including failing) are valuable for user.
	- Trying too hard can be harmful. Repeating some action back and forth or pushing for a complex procedure with little knowledge can cause unwanted results and harmful side-effects. User would rather you complete the task with a fail.
- If you do not have knowledge for the current webpage or task. You must require user to give specific instructions and detailed steps.
</capability>

<task_completion_rules>
You must call the \`done\` action in one of three cases:
- When you have fully completed the USER REQUEST.
- When you reach the final allowed step (\`max_steps\`), even if the task is incomplete.
- When you feel stuck or unable to solve user request. Or user request is not clear or contains inappropriate content.
- If it is ABSOLUTELY IMPOSSIBLE to continue.

The \`done\` action is your opportunity to terminate and share your findings with the user.
- Set \`success\` to \`true\` only if the full USER REQUEST has been completed with no missing components.
- If any part of the request is missing, incomplete, or uncertain, set \`success\` to \`false\`.
- You can use the \`text\` field of the \`done\` action to communicate your findings and to provide a coherent reply to the user and fulfill the USER REQUEST.
- You are ONLY ALLOWED to call \`done\` as a single action. Don't call it together with other actions.
- If the user asks for specified format, such as "return JSON with following structure", "return a list of format...", MAKE sure to use the right format in your answer.
- If the user asks for a structured output, your \`done\` action's schema may be modified. Take this schema into account when solving the task!
</task_completion_rules>

<reasoning_rules>
Exhibit the following reasoning patterns to successfully achieve the <user_request>:

- Reason about <agent_history> to track progress and context toward <user_request>.
- Analyze the most recent "Next Goal" and "Action Result" in <agent_history> and clearly state what you previously tried to achieve.
- Analyze all relevant items in <agent_history> and <browser_state> to understand your state.
- Explicitly judge success/failure/uncertainty of the last action. Never assume an action succeeded just because it appears to be executed in your last step in <agent_history>. If the expected change is missing, mark the last action as failed (or uncertain) and plan a recovery.
- Analyze whether you are stuck, e.g. when you repeat the same actions multiple times without any progress. Then consider alternative approaches e.g. scrolling for more context or ask user for help.
- Ask user for help if you have any difficulty. Keep user in the loop.
- If you see information relevant to <user_request>, plan saving the information to memory.
- Always reason about the <user_request>. Make sure to carefully analyze the specific steps and information required. E.g. specific filters, specific form fields, specific information to search. Make sure to always compare the current trajectory with the user request and think carefully if thats how the user requested it.
</reasoning_rules>

<examples>
Here are examples of good output patterns. Use them as reference but never copy them directly.

<evaluation_examples>
"evaluation_previous_goal": "Successfully navigated to the product page and found the target information. Verdict: Success"
"evaluation_previous_goal": "Clicked the login button and user authentication form appeared. Verdict: Success"
</evaluation_examples>

<memory_examples>
"memory": "Found many pending reports that need to be analyzed in the main page. Successfully processed the first 2 reports on quarterly sales data and moving on to inventory analysis and customer feedback reports."
</memory_examples>

<next_goal_examples>
"next_goal": "Click on the 'Add to Cart' button to proceed with the purchase flow."
</next_goal_examples>
</examples>

<output>
{
  "evaluation_previous_goal": "Concise one-sentence analysis of your last action. Clearly state success, failure, or uncertain.",
  "memory": "1-3 concise sentences of specific memory of this step and overall progress. You should put here everything that will help you track progress in future steps. Like counting pages visited, items found, etc.",
  "next_goal": "State the next immediate goal and action to achieve it, in one clear sentence.",
  "action":{
    "Action name": {// Action parameters}
  }
}
</output>
`,ot=console.log.bind(console,ee.yellow("[autoFixer]"));function Dp(e,t){let n,r=e.choices?.[0];if(!r)throw new Error("No choices in response");let o=r.message;if(!o)throw new Error("No message in choice");let i=o.tool_calls?.[0];if(i?.function?.arguments)n=Re(i.function.arguments),i.function.name&&i.function.name!=="AgentOutput"&&(ot("#1: fixing tool_call"),n={action:Re(n)});else if(o.content){let s=Up(o.content.trim());if(s)n=Re(s),n?.name==="AgentOutput"&&(ot("#2: fixing tool_call"),n=Re(n.arguments)),n?.type==="function"&&(ot("#3: fixing tool_call"),n=Re(n.function.arguments)),!n?.action&&!n?.evaluation_previous_goal&&!n?.memory&&!n?.next_goal&&!n?.thinking&&(ot("#4: fixing tool_call"),n={action:Re(n)});else throw new Error("No tool_call and the message content does not contain valid JSON")}else throw new Error("No tool_call nor message content is present");return n=Re(n),n.action&&(n.action=Re(n.action)),n.action&&t&&(n.action=Fp(n.action,t)),n.action||(ot("#5: fixing tool_call"),n.action={wait:{seconds:1}}),{...e,choices:[{...r,message:{...o,tool_calls:[{...i||{},function:{...i?.function||{},name:"AgentOutput",arguments:JSON.stringify(n)}}]}}]}}function Fp(e,t){if(typeof e!="object"||e===null)return e;let n=Object.keys(e)[0];if(!n)return e;let r=t.get(n);if(!r){let a=Array.from(t.keys()).join(", ");throw new K(M.INVALID_TOOL_ARGS,`Unknown action "${n}". Available: ${a}`)}let o=e[n],i=r.inputSchema;if(i instanceof Ur&&o!==null&&typeof o!="object"){let a=Object.keys(i.shape).find(c=>!i.shape[c].safeParse(void 0).success);a&&(ot(`coercing primitive action input for "${n}"`),o={[a]:o})}let s=i.safeParse(o);if(!s.success)throw new K(M.INVALID_TOOL_ARGS,`Invalid input for action "${n}": ${gt(s.error)}`);return{[n]:s.data}}function Re(e){if(typeof e=="string")try{return JSON.parse(e.trim())}catch{return e}return e}function Up(e){try{let t=/({[\s\S]*})/.exec(e)??[];return t.length===0?null:JSON.parse(t[0])}catch{return null}}async function qr(e,t){if(!t){await new Promise(n=>setTimeout(n,e*1e3));return}t.throwIfAborted(),await new Promise((n,r)=>{let o=setTimeout(()=>{t.removeEventListener("abort",i),n()},e*1e3),i=()=>{clearTimeout(o),r(t.reason)};t.addEventListener("abort",i,{once:!0})})}function Bp(e,t){return e.length>t?e.substring(0,t)+"...":e}function jp(e){let t=Math.random().toString(36).substring(2,11);if(!e)return t;let n=1e3,r=0;for(;e.includes(t);)if(t=Math.random().toString(36).substring(2,11),r++,r>n)throw new Error("randomID: too many tries");return t}var Kr=globalThis;Kr.__PAGE_AGENT_IDS__||(Kr.__PAGE_AGENT_IDS__=[]);var Pc=Kr.__PAGE_AGENT_IDS__;function Tc(){let e=jp(Pc);return Pc.push(e),e}var Jr=new Map;async function Wp(e){let t;try{t=new URL(e).origin}catch{return null}if(t==="null")return null;if(Jr.has(t))return Jr.get(t);let n=`${t}/llms.txt`,r=null;try{console.log(ee.gray(`[llms.txt] Fetching ${n}`));let o=await fetch(n,{signal:AbortSignal.timeout(3e3)});o.ok?(r=await o.text(),console.log(ee.green(`[llms.txt] Found (${r.length} chars)`)),r.length>1e3&&(console.log(ee.yellow("[llms.txt] Truncating to 1000 chars")),r=Bp(r,1e3))):console.debug(ee.gray(`[llms.txt] ${o.status} for ${n}`))}catch(o){console.debug(ee.gray(`[llms.txt] not found for ${n}`),o)}return Jr.set(t,r),r}function Vp(e,t,n){if(!e){let r=t??"Assertion failed";throw n||console.error(ee.red(`\u274C assert: ${r}`)),new Error(r)}}async function Hr(e){try{return await e()}catch(t){console.error(t);return}}var ke=new Map;ke.set("done",{description:"Complete task. Text is your final response to the user \u2014 keep it concise unless the user explicitly asks for detail.",inputSchema:ge({text:Pe(),success:mn().default(!0)}),execute:async function(e){return Promise.resolve("Task completed")}});ke.set("wait",{description:"Wait for x seconds. Can be used to wait until the page or data is fully loaded.",inputSchema:ge({seconds:Be().min(1).max(10).default(1)}),execute:async function(e,{signal:t}){let n=await this.pageController.getLastUpdateTime(),r=(Date.now()-n)/1e3,o=Math.max(0,e.seconds-r);return console.log(`actualWaitTime: ${o} seconds`),await qr(o,t),`\u2705 Waited for ${(r+o).toFixed(2)} seconds.`}});ke.set("ask_user",{description:"Ask the user a question and wait for their answer. Use this if you need more information or clarification.",inputSchema:ge({question:Pe()}),execute:async function(e,{signal:t}){if(!this.onAskUser)throw new Error("ask_user tool requires onAskUser callback to be set");return`User answered: ${await this.onAskUser(e.question,{signal:t})}`}});ke.set("click_element_by_index",{description:"Click element by index",inputSchema:ge({index:rt().min(0)}),execute:async function(e){return(await this.pageController.clickElement(e.index)).message}});ke.set("input_text",{description:"Click and type text into an interactive input element",inputSchema:ge({index:rt().min(0),text:Pe()}),execute:async function(e){return(await this.pageController.inputText(e.index,e.text)).message}});ke.set("select_dropdown_option",{description:"Select dropdown option for interactive element index by the text of the option you want to select",inputSchema:ge({index:rt().min(0),text:Pe()}),execute:async function(e){return(await this.pageController.selectOption(e.index,e.text)).message}});ke.set("scroll",{description:"Scroll vertically. Without index: scrolls the document. With index: scrolls the container at that index (or its nearest scrollable ancestor). Use index of a data-scrollable element to scroll a specific area.",inputSchema:ge({down:mn().default(!0),num_pages:Be().min(0).max(10).optional().default(.1),pixels:Be().int().min(0).optional(),index:Be().int().min(0).optional()}),execute:async function(e){return(await this.pageController.scroll({...e,numPages:e.num_pages})).message}});ke.set("scroll_horizontally",{description:"Scroll horizontally. Without index: scrolls the document. With index: scrolls the container at that index (or its nearest scrollable ancestor). Use index of a data-scrollable element to scroll a specific area.",inputSchema:ge({right:mn().default(!0),pixels:Be().int().min(0),index:Be().int().min(0).optional()}),execute:async function(e){return(await this.pageController.scrollHorizontally(e)).message}});ke.set("execute_javascript",{description:"Execute JavaScript code on the current page. Supports async/await syntax. Use with caution! An `AbortSignal` named `signal` is available in scope: long-running async code MUST honor it (e.g. `await fetch(url, { signal })`, or `signal.throwIfAborted()` in loops)",inputSchema:ge({script:Pe()}),execute:async function(e,{signal:t}){let n=await this.pageController.executeJavascript(e.script,t);return t.throwIfAborted(),n.message}});var Yr=class extends EventTarget{id=Tc();config;tools;pageController;task="";taskId="";history=[];disposed=!1;onAskUser;#o="idle";#e;#t=new AbortController;#n=[];#s=Promise.resolve();#i=null;#r={totalWaitTime:0,lastURL:"",browserState:null};constructor(e){if(super(),this.config={...e,maxSteps:e.maxSteps??40},this.#e=new Sc(this.config),this.tools=new Map(ke),this.pageController=e.pageController,this.#e.addEventListener("retry",t=>{let{attempt:n,maxAttempts:r,lastError:o}=t.detail;this.#a({type:"retrying",attempt:n,maxAttempts:r}),this.history.push({type:"error",message:String(o),rawResponse:o.rawResponse}),this.history.push({type:"retry",message:`LLM retry attempt ${n} of ${r}`,attempt:n,maxAttempts:r}),this.#c()}),this.config.customTools)for(let[t,n]of Object.entries(this.config.customTools)){if(n===null){this.tools.delete(t);continue}this.tools.set(t,n)}this.config.experimentalScriptExecutionTool||this.tools.delete("execute_javascript")}get status(){return this.#o}get lastResult(){return this.#i}#u(){this.dispatchEvent(new Event("statuschange"))}#c(e){e&&this.history.push(e),this.dispatchEvent(new Event("historychange"))}#a(e){this.dispatchEvent(new CustomEvent("activity",{detail:e}))}#l(e){this.#o!==e&&(this.#o=e,this.#u())}pushObservation(e){this.#n.push(e)}async stop(){this.#o==="running"&&(this.#t.abort(),await this.#s)}async execute(e){if(this.disposed)throw new Error("PageAgent has been disposed. Create a new instance.");if(this.#o==="running")throw new Error("A task is already running.");if(!e)throw new Error("Task is required");this.task=e,this.taskId=Tc(),this.history=[],this.#n=[],this.#r={totalWaitTime:0,lastURL:"",browserState:null},this.#t=new AbortController;let t=this.#t.signal,n;this.#s=new Promise(d=>n=d),this.#l("running"),this.#c(),this.onAskUser||this.tools.delete("ask_user");let r=this.config.onBeforeStep,o=this.config.onAfterStep,i=this.config.onBeforeTask,s=this.config.onAfterTask,a=this.config.stepDelay??.4,c=this.config.maxSteps,u=0,l,f="error";await Hr(()=>this.pageController.showMask());try{for(await i?.(this);;){await r?.(this,u);try{console.group(`step: ${u}`),u>0&&await qr(a,t),t.throwIfAborted(),console.log(ee.blue.bold("\u{1F440} Observing...")),this.#r.browserState=await this.pageController.getBrowserState(),await this.#h(u);let d=[{role:"system",content:this.#d()},{role:"user",content:await this.#m()}],h={AgentOutput:this.#p()};console.log(ee.blue.bold("\u{1F9E0} Thinking...")),this.#a({type:"thinking"});let m=await this.#e.invoke(d,h,t,{toolChoiceName:"AgentOutput",normalizeResponse:$=>Dp($,this.tools)}),y=m.toolResult,_=y.input,k=y.output,P={evaluation_previous_goal:_.evaluation_previous_goal,memory:_.memory,next_goal:_.next_goal},D=Object.keys(_.action)[0],v={name:D,input:_.action[D],output:k};if(this.#c({type:"step",stepIndex:u,reflection:P,action:v,usage:m.usage,rawResponse:m.rawResponse,rawRequest:m.rawRequest}),D==="done"){let $=v.input?.success??!1,T=v.input?.text||"no text provided";console.log(ee.green.bold("Task completed"),$,T),l={success:$,data:T,history:this.history},this.#i=l,f="completed";break}}catch(d){let h=d?.name==="AbortError";h||console.error("Task failed",d);let m=h?"Task aborted":String(d);this.#a({type:"error",message:m}),this.#c({type:"error",message:m,rawResponse:d}),l={success:!1,data:m,history:this.history},this.#i=l,f=h?"stopped":"error";break}finally{console.groupEnd(),await o?.(this,this.history)}if(u++,u>c){let d="Step count exceeded maximum limit";console.error(d),this.#a({type:"error",message:d}),this.#c({type:"error",message:d}),l={success:!1,data:d,history:this.history},this.#i=l,f="error";break}}return await s?.(this,l),l}catch(d){throw this.#a({type:"error",message:String(d)}),f="error",d}finally{await Hr(()=>this.pageController.cleanUpHighlights()),await Hr(()=>this.pageController.hideMask()),this.#t.abort(),n(),this.#l(f)}}#p(){let e=this.tools,t=Array.from(e.entries()).map(([r,o])=>ge({[r]:o.inputSchema}).describe(o.description)),n=Br(t);return{description:"You MUST call this tool every step!",inputSchema:ge({evaluation_previous_goal:Pe().optional(),memory:Pe().optional(),next_goal:Pe().optional(),action:n}),execute:async r=>{let o=this.#t.signal;o.throwIfAborted(),console.log(ee.blue.bold("MacroTool input"),r);let i=r.action,s=Object.keys(i)[0],a=i[s],c=[];r.evaluation_previous_goal&&c.push(`\u2705: ${r.evaluation_previous_goal}`),r.memory&&c.push(`\u{1F4BE}: ${r.memory}`),r.next_goal&&c.push(`\u{1F3AF}: ${r.next_goal}`);let u=c.length>0?c.join(`
`):"";u&&console.log(u);let l=e.get(s);Vp(l,`Tool ${s} not found`),console.log(ee.blue.bold(`Executing tool: ${s}`),a),this.#a({type:"executing",tool:s,input:a});let f=Date.now(),d=await l.execute.bind(this)(a,{signal:o});o.throwIfAborted();let h=Date.now()-f;return console.log(ee.green.bold(`Tool (${s}) executed for ${h}ms`),d),this.#a({type:"executed",tool:s,input:a,output:d,duration:h}),s==="wait"?this.#r.totalWaitTime+=a?.seconds||0:this.#r.totalWaitTime=0,{input:r,output:d}}}}#d(){if(this.config.customSystemPrompt)return this.config.customSystemPrompt;let e=this.config.language==="zh-CN"?"\u4E2D\u6587":"English";return Mp.replace(/Default working language: \*\*.*?\*\*/,`Default working language: **${e}**`)}async#f(){let{instructions:e,experimentalLlmsTxt:t}=this.config,n=e?.system?.trim(),r,o=this.#r.browserState?.url||"";if(e?.getPageInstructions&&o)try{r=e.getPageInstructions(o)?.trim()}catch(a){console.error(ee.red("[PageAgent] Failed to execute getPageInstructions callback:"),a)}let i=t&&o?await Wp(o):void 0;if(!n&&!r&&!i)return"";let s=`<instructions>
`;return n&&(s+=`<system_instructions>
${n}
</system_instructions>
`),r&&(s+=`<page_instructions>
${r}
</page_instructions>
`),i&&(s+=`<llms_txt>
${i}
</llms_txt>
`),s+=`</instructions>

`,s}async#h(e){this.#r.totalWaitTime>=3&&this.pushObservation(`You have waited ${this.#r.totalWaitTime} seconds accumulatively. DO NOT wait any longer unless you have a good reason.`);let t=this.#r.browserState?.url||"";t!==this.#r.lastURL&&(this.pushObservation(`Page navigated to \u2192 ${t}`),this.#r.lastURL=t,await qr(.5));let n=this.config.maxSteps-e;if(n===5?this.pushObservation(`\u26A0\uFE0F Only ${n} steps remaining. Consider wrapping up or calling done with partial results.`):n===2&&this.pushObservation(`\u26A0\uFE0F Critical: Only ${n} steps left! You must finish the task or call done immediately.`),this.#n.length>0){for(let r of this.#n)this.history.push({type:"observation",content:r}),console.log(ee.cyan("Observation:"),r);this.#n=[],this.#c()}}async#m(){let e=this.#r.browserState,t="";t+=await this.#f();let n=this.history.filter(i=>i.type==="step").length;t+=`<agent_state>
`,t+=`<user_request>
`,t+=`${this.task}
`,t+=`</user_request>
`,t+=`<step_info>
`,t+=`Step ${n+1} of ${this.config.maxSteps} max possible steps
`,t+=`Current time: ${new Date().toLocaleString()}
`,t+=`</step_info>
`,t+=`</agent_state>

`,t+=`<agent_history>
`;let r=0;for(let i of this.history)i.type==="step"?(r++,t+=`<step_${r}>
`,t+=`Evaluation of Previous Step: ${i.reflection.evaluation_previous_goal}
`,t+=`Memory: ${i.reflection.memory}
`,t+=`Next Goal: ${i.reflection.next_goal}
`,t+=`Action Results: ${i.action.output}
`,t+=`</step_${r}>
`):i.type==="observation"?t+=`<sys>${i.content}</sys>
`:i.type==="user_takeover"?t+=`<sys>User took over control and made changes to the page</sys>
`:i.type;t+=`</agent_history>

`;let o=e.content;return this.config.transformPageContent&&(o=await this.config.transformPageContent(o)),t+=`<browser_state>
`,t+=e.header+`
`,t+=o+`
`,t+=e.footer+`

`,t+=`</browser_state>

`,t}dispose(){console.log("Disposing PageAgent..."),this.disposed=!0,this.pageController.dispose(),this.#t.abort(),this.dispatchEvent(new Event("dispose")),this.config.onDispose?.(this)}};var Zc=Object.defineProperty,sd=(e,t)=>{let n={};for(var r in e)Zc(n,r,{get:e[r],enumerable:!0});return t||Zc(n,Symbol.toStringTag,{value:"Module"}),n};function ad(e){return!!e&&e.nodeType===1}function cd(e){return e?.nodeType===1&&e.tagName==="INPUT"}function ud(e){return e?.nodeType===1&&e.tagName==="TEXTAREA"}function ld(e){return e?.nodeType===1&&e.tagName==="SELECT"}function pd(e){return e?.nodeType===1&&e.tagName==="A"}function dd(e){let t=e.ownerDocument.defaultView?.frameElement;if(!t)return{x:0,y:0};let n=t.getBoundingClientRect();return{x:n.left,y:n.top}}function fd(e){return Object.getOwnPropertyDescriptor(Object.getPrototypeOf(e),"value").set}async function We(e){await new Promise(t=>setTimeout(t,e*1e3))}async function hd(e,t,n){let r=dd(e);window.dispatchEvent(new CustomEvent("PageAgent::MovePointerTo",{detail:{x:t+r.x,y:n+r.y}})),await We(.3)}async function md(){window.dispatchEvent(new CustomEvent("PageAgent::ClickPointer"))}async function gd(){window.dispatchEvent(new CustomEvent("PageAgent::EnablePassThrough"))}async function _d(){window.dispatchEvent(new CustomEvent("PageAgent::DisablePassThrough"))}function Ot(e,t){let n=e.get(t);if(!n)throw new Error(`No interactive element found at index ${t}`);let r=n.ref;if(!r)throw new Error(`Element at index ${t} does not have a reference`);if(!ad(r))throw new Error(`Element at index ${t} is not an HTMLElement`);return r}var Ze=null;function bd(){Ze&&(Ze.dispatchEvent(new PointerEvent("pointerout",{bubbles:!0})),Ze.dispatchEvent(new PointerEvent("pointerleave",{bubbles:!1})),Ze.dispatchEvent(new MouseEvent("mouseout",{bubbles:!0})),Ze.dispatchEvent(new MouseEvent("mouseleave",{bubbles:!1})),Ze.blur(),Ze=null)}async function Fc(e){bd(),Ze=e,await Lc(e);let t=e.ownerDocument.defaultView?.frameElement;t&&await Lc(t);let n=e.getBoundingClientRect(),r=n.left+n.width/2,o=n.top+n.height/2;await hd(e,r,o),await md(),await We(.1);let i=e.ownerDocument;await gd();let s=i.elementFromPoint(r,o);await _d();let a=s instanceof HTMLElement&&e.contains(s)?s:e,c={bubbles:!0,cancelable:!0,clientX:r,clientY:o,pointerType:"mouse"},u={bubbles:!0,cancelable:!0,clientX:r,clientY:o,button:0};a.dispatchEvent(new PointerEvent("pointerover",c)),a.dispatchEvent(new PointerEvent("pointerenter",{...c,bubbles:!1})),a.dispatchEvent(new MouseEvent("mouseover",u)),a.dispatchEvent(new MouseEvent("mouseenter",{...u,bubbles:!1})),a.dispatchEvent(new PointerEvent("pointerdown",c)),a.dispatchEvent(new MouseEvent("mousedown",u)),e.focus({preventScroll:!0}),a.dispatchEvent(new PointerEvent("pointerup",c)),a.dispatchEvent(new MouseEvent("mouseup",u)),a.click(),await We(.2)}async function yd(e,t){let n=e.isContentEditable;if(!cd(e)&&!ud(e)&&!n)throw new Error("Element is not an input, textarea, or contenteditable");if(await Fc(e),n){if(e.dispatchEvent(new InputEvent("beforeinput",{bubbles:!0,cancelable:!0,inputType:"deleteContent"}))&&(e.innerText="",e.dispatchEvent(new InputEvent("input",{bubbles:!0,inputType:"deleteContent"}))),e.dispatchEvent(new InputEvent("beforeinput",{bubbles:!0,cancelable:!0,inputType:"insertText",data:t}))&&(e.innerText=t,e.dispatchEvent(new InputEvent("input",{bubbles:!0,inputType:"insertText",data:t}))),e.innerText.trim()!==t.trim()){e.focus();let r=e.ownerDocument,o=(r.defaultView||window).getSelection(),i=r.createRange();i.selectNodeContents(e),o?.removeAllRanges(),o?.addRange(i),r.execCommand("delete",!1),r.execCommand("insertText",!1,t)}e.dispatchEvent(new Event("change",{bubbles:!0})),e.blur()}else fd(e).call(e,t);n||e.dispatchEvent(new Event("input",{bubbles:!0})),await We(.1)}async function xd(e,t){if(!ld(e))throw new Error("Element is not a select element");let n=Array.from(e.options).find(r=>r.textContent?.trim()===t.trim());if(!n)throw new Error(`Option with text "${t}" not found in select element`);e.value=n.value,e.dispatchEvent(new Event("change",{bubbles:!0})),await We(.1)}async function Lc(e){let t=e;typeof t.scrollIntoViewIfNeeded=="function"?t.scrollIntoViewIfNeeded():e.scrollIntoView({behavior:"auto",block:"center",inline:"nearest"})}async function wd(e,t){if(t){let s=t,a=s,c=!1,u=null,l=0,f=0,d=e;for(;a&&f<10;){let h=window.getComputedStyle(a),m=/(auto|scroll|overlay)/.test(h.overflowY)||h.scrollbarWidth&&h.scrollbarWidth!=="auto"||h.scrollbarGutter&&h.scrollbarGutter!=="auto",y=a.scrollHeight>a.clientHeight;if(m&&y){let _=a.scrollTop,k=a.scrollHeight-a.clientHeight,P=d/3;P>0?P=Math.min(P,k-_):P=Math.max(P,-_),a.scrollTop=_+P;let D=a.scrollTop-_;if(Math.abs(D)>.5){c=!0,u=a,l=D;break}}if(a===document.body||a===document.documentElement)break;a=a.parentElement,f++}return c?`Scrolled container (${u?.tagName}) by ${l}px`:`No scrollable container found for element (${s.tagName})`}let n=e,r=s=>s.clientHeight>=window.innerHeight*.5,o=s=>!!(s&&/(auto|scroll|overlay)/.test(getComputedStyle(s).overflowY)&&s.scrollHeight>s.clientHeight&&r(s)),i=document.activeElement;for(;i&&!o(i)&&i!==document.body;)i=i.parentElement;if(i=o(i)?i:Array.from(document.querySelectorAll("*")).find(o)||document.scrollingElement||document.documentElement,i===document.scrollingElement||i===document.documentElement||i===document.body){let s=window.scrollY,a=document.documentElement.scrollHeight-window.innerHeight;window.scrollBy(0,n);let c=window.scrollY,u=c-s;if(Math.abs(u)<1)return n>0?"\u26A0\uFE0F Already at the bottom of the page, cannot scroll down further.":"\u26A0\uFE0F Already at the top of the page, cannot scroll up further.";let l=n>0&&c>=a-1,f=n<0&&c<=1;return l?`\u2705 Scrolled page by ${u}px. Reached the bottom of the page.`:f?`\u2705 Scrolled page by ${u}px. Reached the top of the page.`:`\u2705 Scrolled page by ${u}px.`}else{let s="The document is not scrollable. Falling back to container scroll.";console.log(`[PageController] ${s}`);let a=i.scrollTop,c=i.scrollHeight-i.clientHeight;i.scrollBy({top:n,behavior:"smooth"}),await We(.1);let u=i.scrollTop,l=u-a;if(Math.abs(l)<1)return n>0?`\u26A0\uFE0F ${s} Already at the bottom of container (${i.tagName}), cannot scroll down further.`:`\u26A0\uFE0F ${s} Already at the top of container (${i.tagName}), cannot scroll up further.`;let f=n>0&&u>=c-1,d=n<0&&u<=1;return f?`\u2705 ${s} Scrolled container (${i.tagName}) by ${l}px. Reached the bottom.`:d?`\u2705 ${s} Scrolled container (${i.tagName}) by ${l}px. Reached the top.`:`\u2705 ${s} Scrolled container (${i.tagName}) by ${l}px.`}}async function vd(e,t){if(t){let s=t,a=s,c=!1,u=null,l=0,f=0,d=e;for(;a&&f<10;){let h=window.getComputedStyle(a),m=/(auto|scroll|overlay)/.test(h.overflowX)||h.scrollbarWidth&&h.scrollbarWidth!=="auto"||h.scrollbarGutter&&h.scrollbarGutter!=="auto",y=a.scrollWidth>a.clientWidth;if(m&&y){let _=a.scrollLeft,k=a.scrollWidth-a.clientWidth,P=d/3;P>0?P=Math.min(P,k-_):P=Math.max(P,-_),a.scrollLeft=_+P;let D=a.scrollLeft-_;if(Math.abs(D)>.5){c=!0,u=a,l=D;break}}if(a===document.body||a===document.documentElement)break;a=a.parentElement,f++}return c?`Scrolled container (${u?.tagName}) horizontally by ${l}px`:`No horizontally scrollable container found for element (${s.tagName})`}let n=e,r=s=>s.clientWidth>=window.innerWidth*.5,o=s=>!!(s&&/(auto|scroll|overlay)/.test(getComputedStyle(s).overflowX)&&s.scrollWidth>s.clientWidth&&r(s)),i=document.activeElement;for(;i&&!o(i)&&i!==document.body;)i=i.parentElement;if(i=o(i)?i:Array.from(document.querySelectorAll("*")).find(o)||document.scrollingElement||document.documentElement,i===document.scrollingElement||i===document.documentElement||i===document.body){let s=window.scrollX,a=document.documentElement.scrollWidth-window.innerWidth;window.scrollBy(n,0);let c=window.scrollX,u=c-s;if(Math.abs(u)<1)return n>0?"\u26A0\uFE0F Already at the right edge of the page, cannot scroll right further.":"\u26A0\uFE0F Already at the left edge of the page, cannot scroll left further.";let l=n>0&&c>=a-1,f=n<0&&c<=1;return l?`\u2705 Scrolled page by ${u}px. Reached the right edge of the page.`:f?`\u2705 Scrolled page by ${u}px. Reached the left edge of the page.`:`\u2705 Scrolled page horizontally by ${u}px.`}else{let s="The document is not scrollable. Falling back to container scroll.";console.log(`[PageController] ${s}`);let a=i.scrollLeft,c=i.scrollWidth-i.clientWidth;i.scrollBy({left:n,behavior:"smooth"}),await We(.1);let u=i.scrollLeft,l=u-a;if(Math.abs(l)<1)return n>0?`\u26A0\uFE0F ${s} Already at the right edge of container (${i.tagName}), cannot scroll right further.`:`\u26A0\uFE0F ${s} Already at the left edge of container (${i.tagName}), cannot scroll left further.`;let f=n>0&&u>=c-1,d=n<0&&u<=1;return f?`\u2705 ${s} Scrolled container (${i.tagName}) by ${l}px. Reached the right edge.`:d?`\u2705 ${s} Scrolled container (${i.tagName}) by ${l}px. Reached the left edge.`:`\u2705 ${s} Scrolled container (${i.tagName}) horizontally by ${l}px.`}}var kd=(e={doHighlightElements:!0,focusHighlightIndex:-1,viewportExpansion:0,debugMode:!1,interactiveBlacklist:[],interactiveWhitelist:[],highlightOpacity:.1,highlightLabelOpacity:.5})=>{let{interactiveBlacklist:t,interactiveWhitelist:n,highlightOpacity:r,highlightLabelOpacity:o}=e,{doHighlightElements:i,focusHighlightIndex:s,viewportExpansion:a,debugMode:c}=e,u=0,l=new WeakMap;function f(p,b){!p||p.nodeType!==Node.ELEMENT_NODE||l.set(p,{...l.get(p),...b})}let d={boundingRects:new WeakMap,clientRects:new WeakMap,computedStyles:new WeakMap,clearCache:()=>{d.boundingRects=new WeakMap,d.clientRects=new WeakMap,d.computedStyles=new WeakMap}};function h(p){if(!p)return null;if(d.boundingRects.has(p))return d.boundingRects.get(p);let b=p.getBoundingClientRect();return b&&d.boundingRects.set(p,b),b}function m(p){if(!p)return null;if(d.computedStyles.has(p))return d.computedStyles.get(p);let b=window.getComputedStyle(p);return b&&d.computedStyles.set(p,b),b}function y(p){if(!p)return null;if(d.clientRects.has(p))return d.clientRects.get(p);let b=p.getClientRects();return b&&d.clientRects.set(p,b),b}let _={},k={current:0},P="playwright-highlight-container";function D(p,b,C=null){if(!p)return b;let x=[],z=null,R=20,w=16,I=null;try{let E=document.getElementById(P);E||(E=document.createElement("div"),E.id=P,E.style.position="fixed",E.style.pointerEvents="none",E.style.top="0",E.style.left="0",E.style.width="100%",E.style.height="100%",E.style.zIndex="2147483640",E.style.backgroundColor="transparent",document.body.appendChild(E));let N=p.getClientRects();if(!N||N.length===0)return b;let fe=["#FF0000","#00FF00","#0000FF","#FFA500","#800080","#008080","#FF69B4","#4B0082","#FF4500","#2E8B57","#DC143C","#4682B4"],ne=fe[b%fe.length],ye=ne+Math.floor(r*255).toString(16).padStart(2,"0");ne=ne+Math.floor(o*255).toString(16).padStart(2,"0");let ie={x:0,y:0};if(C){let J=C.getBoundingClientRect();ie.x=J.left,ie.y=J.top}let ct=document.createDocumentFragment();for(let J of N){if(J.width===0||J.height===0)continue;let H=document.createElement("div");H.style.position="fixed",H.style.border=`2px solid ${ne}`,H.style.backgroundColor=ye,H.style.pointerEvents="none",H.style.boxSizing="border-box";let U=J.top+ie.y,$e=J.left+ie.x;H.style.top=`${U}px`,H.style.left=`${$e}px`,H.style.width=`${J.width}px`,H.style.height=`${J.height}px`,ct.appendChild(H),x.push({element:H,initialRect:J})}let Me=N[0];z=document.createElement("div"),z.className="playwright-highlight-label",z.style.position="fixed",z.style.background=ne,z.style.color="white",z.style.padding="1px 4px",z.style.borderRadius="4px",z.style.fontSize=`${Math.min(12,Math.max(8,Me.height/2))}px`,z.textContent=b.toString(),R=z.offsetWidth>0?z.offsetWidth:R,w=z.offsetHeight>0?z.offsetHeight:w;let ro=Me.top+ie.y,wn=Me.left+ie.x,Ct=ro+2,Ve=wn+Me.width-R-2;(Me.width<R+4||Me.height<w+4)&&(Ct=ro-w-2,Ve=wn+Me.width-R,Ve<ie.x&&(Ve=wn)),Ct=Math.max(0,Math.min(Ct,window.innerHeight-w)),Ve=Math.max(0,Math.min(Ve,window.innerWidth-R)),z.style.top=`${Ct}px`,z.style.left=`${Ve}px`,ct.appendChild(z);let Nt=((J,H)=>{let U=0;return(...$e)=>{let ue=performance.now();if(!(ue-U<H))return U=ue,J(...$e)}})(()=>{let J=p.getClientRects(),H={x:0,y:0};if(C){let U=C.getBoundingClientRect();H.x=U.left,H.y=U.top}if(x.forEach((U,$e)=>{if($e<J.length){let ue=J[$e],Ge=ue.top+H.y,Ae=ue.left+H.x;U.element.style.top=`${Ge}px`,U.element.style.left=`${Ae}px`,U.element.style.width=`${ue.width}px`,U.element.style.height=`${ue.height}px`,U.element.style.display=ue.width===0||ue.height===0?"none":"block"}else U.element.style.display="none"}),J.length<x.length)for(let U=J.length;U<x.length;U++)x[U].element.style.display="none";if(z&&J.length>0){let U=J[0],$e=U.top+H.y,ue=U.left+H.x,Ge=$e+2,Ae=ue+U.width-R-2;(U.width<R+4||U.height<w+4)&&(Ge=$e-w-2,Ae=ue+U.width-R,Ae<H.x&&(Ae=ue)),Ge=Math.max(0,Math.min(Ge,window.innerHeight-w)),Ae=Math.max(0,Math.min(Ae,window.innerWidth-R)),z.style.top=`${Ge}px`,z.style.left=`${Ae}px`,z.style.display="block"}else z&&(z.style.display="none")},16);return window.addEventListener("scroll",Nt,!0),window.addEventListener("resize",Nt),I=()=>{window.removeEventListener("scroll",Nt,!0),window.removeEventListener("resize",Nt),x.forEach(J=>J.element.remove()),z&&z.remove()},E.appendChild(ct),b+1}finally{I&&(window._highlightCleanupFunctions=window._highlightCleanupFunctions||[]).push(I)}}function v(p){if(!p||p.nodeType!==Node.ELEMENT_NODE)return null;let b=m(p);if(!b)return null;let C=b.display;if(C==="inline"||C==="inline-block")return null;let x=b.overflowX,z=b.overflowY,R=b.scrollbarWidth&&b.scrollbarWidth!=="auto"||b.scrollbarGutter&&b.scrollbarGutter!=="auto",w=x==="auto"||x==="scroll",I=z==="auto"||z==="scroll";if(!w&&!I&&!R)return null;let E=p.scrollWidth-p.clientWidth,N=p.scrollHeight-p.clientHeight,fe=4;if(E<fe&&N<fe||!I&&!R&&E<fe||!w&&!R&&N<fe)return null;let ne=p.scrollTop,ye=p.scrollLeft,ie={top:ne,right:p.scrollWidth-p.clientWidth-p.scrollLeft,bottom:p.scrollHeight-p.clientHeight-p.scrollTop,left:ye};return f(p,{scrollable:!0,scrollData:ie}),ie}function $(p){try{if(a===-1){let w=p.parentElement;if(!w)return!1;try{return w.checkVisibility({checkOpacity:!0,checkVisibilityCSS:!0})}catch{let E=window.getComputedStyle(w);return E.display!=="none"&&E.visibility!=="hidden"&&E.opacity!=="0"}}let b=document.createRange();b.selectNodeContents(p);let C=b.getClientRects();if(!C||C.length===0)return!1;let x=!1,z=!1;for(let w of C)if(w.width>0&&w.height>0&&(x=!0,!(w.bottom<-a||w.top>window.innerHeight+a||w.right<-a||w.left>window.innerWidth+a))){z=!0;break}if(!x||!z)return!1;let R=p.parentElement;if(!R)return!1;try{return R.checkVisibility({checkOpacity:!0,checkVisibilityCSS:!0})}catch{let I=window.getComputedStyle(R);return I.display!=="none"&&I.visibility!=="hidden"&&I.opacity!=="0"}}catch(b){return console.warn("Error checking text node visibility:",b),!1}}function T(p){if(!p||!p.tagName)return!1;let b=new Set(["body","div","main","article","section","nav","header","footer"]),C=p.tagName.toLowerCase();return b.has(C)?!0:!new Set(["svg","script","style","link","meta","noscript","template"]).has(C)}function O(p){let b=m(p);return p.offsetWidth>0&&p.offsetHeight>0&&b?.visibility!=="hidden"&&b?.display!=="none"}function ce(p){if(!p||p.nodeType!==Node.ELEMENT_NODE||t.includes(p))return!1;if(n.includes(p))return!0;let b=p.tagName.toLowerCase(),C=m(p),x=new Set(["pointer","move","text","grab","grabbing","cell","copy","alias","all-scroll","col-resize","context-menu","crosshair","e-resize","ew-resize","help","n-resize","ne-resize","nesw-resize","ns-resize","nw-resize","nwse-resize","row-resize","s-resize","se-resize","sw-resize","vertical-text","w-resize","zoom-in","zoom-out"]),z=new Set(["not-allowed","no-drop","wait","progress","initial","inherit"]);function R(ne){return ne.tagName.toLowerCase()==="html"?!1:!!(C?.cursor&&x.has(C.cursor))}if(R(p))return!0;let w=new Set(["a","button","input","select","textarea","details","summary","label","option","optgroup","fieldset","legend"]),I=new Set(["disabled","readonly"]);if(w.has(b)){if(C?.cursor&&z.has(C.cursor))return!1;for(let ne of I)if(p.hasAttribute(ne)||p.getAttribute(ne)==="true"||p.getAttribute(ne)==="")return!1;return!(p.disabled||p.readOnly||p.inert)}let E=p.getAttribute("role"),N=p.getAttribute("aria-role");if(p.getAttribute("contenteditable")==="true"||p.isContentEditable||p.classList&&(p.classList.contains("button")||p.classList.contains("dropdown-toggle")||p.getAttribute("data-index")||p.getAttribute("data-toggle")==="dropdown"||p.getAttribute("aria-haspopup")==="true"))return!0;let fe=new Set(["button","menu","menubar","menuitem","menuitemradio","menuitemcheckbox","radio","checkbox","tab","switch","slider","spinbutton","combobox","searchbox","textbox","listbox","option","scrollbar"]);if(w.has(b)||E&&fe.has(E)||N&&fe.has(N))return!0;try{if(typeof getEventListeners=="function"){let ye=getEventListeners(p);for(let ie of["click","mousedown","mouseup","dblclick"])if(ye[ie]&&ye[ie].length>0)return!0}let ne=p?.ownerDocument?.defaultView?.getEventListenersForNode||window.getEventListenersForNode;if(typeof ne=="function"){let ye=ne(p);for(let ie of["click","mousedown","mouseup","keydown","keyup","submit","change","input","focus","blur"])for(let ct of ye)if(ct.type===ie)return!0}for(let ye of["onclick","onmousedown","onmouseup","ondblclick"])if(p.hasAttribute(ye)||typeof p[ye]=="function")return!0}catch{}return!!v(p)}function te(p){if(a===-1)return!0;let b=y(p);if(!b||b.length===0)return!1;let C=!1;for(let w of b)if(w.width>0&&w.height>0&&!(w.bottom<-a||w.top>window.innerHeight+a||w.right<-a||w.left>window.innerWidth+a)){C=!0;break}if(!C)return!1;if(p.ownerDocument!==window.document)return!0;let x=Array.from(b).find(w=>w.width>0&&w.height>0);if(!x)return!1;let z=p.getRootNode();if(z instanceof ShadowRoot){let w=x.left+x.width/2,I=x.top+x.height/2;try{let E=z.elementFromPoint(w,I);if(!E)return!1;let N=E;for(;N&&N!==z;){if(N===p)return!0;N=N.parentElement}return!1}catch{return!0}}let R=5;return[{x:x.left+x.width/2,y:x.top+x.height/2},{x:x.left+R,y:x.top+R},{x:x.right-R,y:x.bottom-R}].some(({x:w,y:I})=>{try{let E=document.elementFromPoint(w,I);if(!E)return!1;let N=E;for(;N&&N!==document.documentElement;){if(N===p)return!0;N=N.parentElement}return!1}catch{return!0}})}function Y(p,b){if(b===-1)return!0;let C=p.getClientRects();if(!C||C.length===0){let x=h(p);return!x||x.width===0||x.height===0?!1:!(x.bottom<-b||x.top>window.innerHeight+b||x.right<-b||x.left>window.innerWidth+b)}for(let x of C)if(!(x.width===0||x.height===0)&&!(x.bottom<-b||x.top>window.innerHeight+b||x.right<-b||x.left>window.innerWidth+b))return!0;return!1}let G=["aria-expanded","aria-checked","aria-selected","aria-pressed","aria-haspopup","aria-controls","aria-owns","aria-activedescendant","aria-valuenow","aria-valuetext","aria-valuemax","aria-valuemin","aria-autocomplete"];function X(p){for(let b=0;b<G.length;b++)if(p.hasAttribute(G[b]))return!0;return!1}function Le(p){if(!p||p.nodeType!==Node.ELEMENT_NODE)return!1;let b=p.tagName.toLowerCase();return new Set(["a","button","input","select","textarea","details","summary","label"]).has(b)?!0:p.hasAttribute("onclick")||p.hasAttribute("role")||p.hasAttribute("tabindex")||X(p)||p.hasAttribute("data-action")||p.getAttribute("contenteditable")==="true"}let _e=new Set(["a","button","input","select","textarea","summary","details","label","option","li"]),it=new Set(["button","link","menuitem","menuitemradio","menuitemcheckbox","radio","checkbox","tab","switch","slider","spinbutton","combobox","searchbox","textbox","listbox","listitem","treeitem","row","option","scrollbar"]);function st(p){if(!p||p.nodeType!==Node.ELEMENT_NODE||!O(p))return!1;let b=p.hasAttribute("role")||p.hasAttribute("tabindex")||p.hasAttribute("onclick")||typeof p.onclick=="function",C=/\b(btn|clickable|menu|item|entry|link)\b/i.test(p.className||""),x=!!p.closest('button,a,[role="button"],.menu,.dropdown,.list,.toolbar'),z=[...p.children].some(O),R=p.parentElement&&p.parentElement.isSameNode(document.body);return(ce(p)||b||C)&&z&&x&&!R}function at(p){if(!p||p.nodeType!==Node.ELEMENT_NODE)return!1;let b=p.tagName.toLowerCase(),C=p.getAttribute("role");if(b==="iframe"||_e.has(b)||C&&it.has(C)||p.isContentEditable||p.getAttribute("contenteditable")==="true"||p.hasAttribute("data-testid")||p.hasAttribute("data-cy")||p.hasAttribute("data-test")||p.hasAttribute("onclick")||typeof p.onclick=="function"||X(p))return!0;try{let x=p?.ownerDocument?.defaultView?.getEventListenersForNode||window.getEventListenersForNode;if(typeof x=="function"){let z=x(p);for(let R of["click","mousedown","mouseup","keydown","keyup","submit","change","input","focus","blur"])for(let w of z)if(w.type===R)return!0}if(["onmousedown","onmouseup","onkeydown","onkeyup","onsubmit","onchange","oninput","onfocus","onblur"].some(z=>p.hasAttribute(z)))return!0}catch{}return!!(st(p)||l.get(p)?.scrollable)}function be(p,b,C,x){if(!p.isInteractive)return!1;let z=!1;return x?at(b)?z=!0:z=!1:z=!0,z&&(p.isInViewport=Y(b,a),(p.isInViewport||a===-1)&&(p.highlightIndex=u++,i))?(s>=0?s===p.highlightIndex&&D(b,p.highlightIndex,C):D(b,p.highlightIndex,C),!0):!1}function oe(p,b=null,C=!1){if(!p||p.id===P||p.nodeType!==Node.ELEMENT_NODE&&p.nodeType!==Node.TEXT_NODE||!p||p.id===P||p.dataset?.browserUseIgnore==="true"||p.dataset?.pageAgentIgnore==="true"||p.getAttribute&&p.getAttribute("aria-hidden")==="true")return null;if(p===document.body){let w={tagName:"body",attributes:{},xpath:"/body",children:[]};for(let E of p.childNodes){let N=oe(E,b,!1);N&&w.children.push(N)}let I=`${k.current++}`;return _[I]=w,I}if(p.nodeType!==Node.ELEMENT_NODE&&p.nodeType!==Node.TEXT_NODE)return null;if(p.nodeType===Node.TEXT_NODE){let w=p.textContent?.trim();if(!w)return null;let I=p.parentElement;if(!I||I.tagName.toLowerCase()==="script")return null;let E=`${k.current++}`;return _[E]={type:"TEXT_NODE",text:w,isVisible:$(p)},E}if(p.nodeType===Node.ELEMENT_NODE&&!T(p))return null;if(a!==-1&&!p.shadowRoot){let w=h(p),I=m(p),E=I&&(I.position==="fixed"||I.position==="sticky"),N=p.offsetWidth>0||p.offsetHeight>0;if(!w||!E&&!N&&(w.bottom<-a||w.top>window.innerHeight+a||w.right<-a||w.left>window.innerWidth+a))return null}let x={tagName:p.tagName.toLowerCase(),attributes:{},children:[]};if(Le(p)||p.tagName.toLowerCase()==="iframe"||p.tagName.toLowerCase()==="body"){let w=p.getAttributeNames?.()||[];for(let I of w){let E=p.getAttribute(I);x.attributes[I]=E}p.tagName.toLowerCase()==="input"&&(p.type==="checkbox"||p.type==="radio")&&(x.attributes.checked=p.checked?"true":"false")}let z=!1;if(p.nodeType===Node.ELEMENT_NODE&&(x.isVisible=O(p),x.isVisible)){x.isTopElement=te(p);let w=p.getAttribute("role"),I=w==="menu"||w==="menubar"||w==="listbox";if((x.isTopElement||I)&&(x.isInteractive=ce(p),z=be(x,p,b,C),x.ref=p,x.isInteractive&&Object.keys(x.attributes).length===0)){let E=p.getAttributeNames?.()||[];for(let N of E){let fe=p.getAttribute(N);x.attributes[N]=fe}}}if(p.tagName){let w=p.tagName.toLowerCase();if(w==="iframe")try{let I=p.contentDocument||p.contentWindow?.document;if(I)for(let E of I.childNodes){let N=oe(E,p,!1);N&&x.children.push(N)}}catch(I){console.warn("Unable to access iframe:",I)}else if(p.isContentEditable||p.getAttribute("contenteditable")==="true"||p.id==="tinymce"||p.classList.contains("mce-content-body")||w==="body"&&p.getAttribute("data-id")?.startsWith("mce_"))for(let I of p.childNodes){let E=oe(I,b,z);E&&x.children.push(E)}else{if(p.shadowRoot){x.shadowRoot=!0;for(let I of p.shadowRoot.childNodes){let E=oe(I,b,z);E&&x.children.push(E)}}for(let I of p.childNodes){let E=oe(I,b,z||C);E&&x.children.push(E)}}}if(x.tagName==="a"&&x.children.length===0&&!x.attributes.href){let w=h(p);if(!(w&&w.width>0&&w.height>0||p.offsetWidth>0||p.offsetHeight>0))return null}x.extra=l.get(p)||null;let R=`${k.current++}`;return _[R]=x,R}let xn=oe(document.body);return d.clearCache(),{rootId:xn,map:_}},Im=sd({cleanUpHighlights:()=>Te,flatTreeToString:()=>Bc,getAllTextTillNextClickableElement:()=>jc,getElementTextMap:()=>Vc,getFlatTree:()=>Uc,getSelectorMap:()=>Wc,resolveViewportExpansion:()=>to}),$d=-1;function to(e){return e??$d}var Ed=new Set(["nav","menu","header","footer","aside","dialog"]),Mc=new WeakMap;function Uc(e){let t=to(e.viewportExpansion),n=[];for(let s of e.interactiveBlacklist||[])typeof s=="function"?n.push(s()):n.push(s);let r=[];for(let s of e.interactiveWhitelist||[])typeof s=="function"?r.push(s()):r.push(s);let o=kd({doHighlightElements:!0,debugMode:!0,focusHighlightIndex:-1,viewportExpansion:t,interactiveBlacklist:n,interactiveWhitelist:r,highlightOpacity:e.highlightOpacity??0,highlightLabelOpacity:e.highlightLabelOpacity??.1}),i=window.location.href;for(let s in o.map){let a=o.map[s];if(a.isInteractive&&a.ref){let c=a.ref;Mc.has(c)||(Mc.set(c,i),a.isNew=!0)}}return o}var Dc=new Map;function zd(e){let t=Dc.get(e);if(!t){let n=e.replace(/[.+^${}()|[\]\\]/g,"\\$&");t=new RegExp(`^${n.replace(/\*/g,".*")}$`),Dc.set(e,t)}return t}function Sd(e,t){let n={};for(let r of t)if(r.includes("*")){let o=zd(r);for(let i of Object.keys(e))o.test(i)&&e[i].trim()&&(n[i]=e[i].trim())}else{let o=e[r];o&&o.trim()&&(n[r]=o.trim())}return n}function Bc(e,t=[],n=!1){let r=["title","type","checked","name","role","value","placeholder","data-date-format","alt","aria-label","aria-expanded","data-state","aria-checked","id","for","target","aria-haspopup","aria-controls","aria-owns","contenteditable"],o=[...t,...r],i=(d,h)=>d.length>h?d.substring(0,h)+"...":d,s=d=>{let h=e.map[d];if(!h)return null;if(h.type==="TEXT_NODE"){let m=h;return{type:"text",text:m.text,isVisible:m.isVisible,parent:null,children:[]}}else{let m=h,y=[];if(m.children)for(let _ of m.children){let k=s(_);k&&(k.parent=null,y.push(k))}return{type:"element",tagName:m.tagName,attributes:m.attributes??{},isVisible:m.isVisible??!1,isInteractive:m.isInteractive??!1,isTopElement:m.isTopElement??!1,isNew:m.isNew??!1,highlightIndex:m.highlightIndex,parent:null,children:y,extra:m.extra??{}}}},a=(d,h=null)=>{d.parent=h;for(let m of d.children)a(m,d)},c=s(e.rootId);if(!c)return"";a(c);let u=d=>{let h=d.parent;for(;h;){if(h.type==="element"&&h.highlightIndex!==void 0)return!0;h=h.parent}return!1},l=(d,h,m)=>{let y=h,_="	".repeat(h);if(d.type==="element"){let k=n&&d.tagName&&Ed.has(d.tagName);if(d.highlightIndex!==void 0){y+=1;let v=jc(d),$="";if(o.length>0&&d.attributes){let O=Sd(d.attributes,o),ce=Object.keys(O);if(ce.length>1){let te=new Set,Y={};for(let G of ce){let X=O[G];X.length>5&&(X in Y?te.add(G):Y[X]=G)}for(let G of te)delete O[G]}O.role===d.tagName&&delete O.role;for(let te of["aria-label","placeholder","title"])O[te]&&O[te].toLowerCase().trim()===v.toLowerCase().trim()&&delete O[te];Object.keys(O).length>0&&($=Object.entries(O).map(([te,Y])=>`${te}=${i(Y,20)}`).join(" "))}let T=`${_}${d.isNew?`*[${d.highlightIndex}]`:`[${d.highlightIndex}]`}<${d.tagName??""}`;if($&&(T+=` ${$}`),d.extra&&d.extra.scrollable){let O="";d.extra.scrollData?.left&&(O+=`left=${d.extra.scrollData.left}, `),d.extra.scrollData?.top&&(O+=`top=${d.extra.scrollData.top}, `),d.extra.scrollData?.right&&(O+=`right=${d.extra.scrollData.right}, `),d.extra.scrollData?.bottom&&(O+=`bottom=${d.extra.scrollData.bottom}`),T+=` data-scrollable="${O}"`}if(v){let O=v.trim();$||(T+=" "),T+=`>${O}`}else $||(T+=" ");T+=" />",m.push(T)}let P=k&&d.highlightIndex===void 0,D=P?m.length:-1;P&&(m.push(`${_}<${d.tagName}>`),y+=1);for(let v of d.children)l(v,y,m);P&&(m.length===D+1?m.pop():m.push(`${_}</${d.tagName}>`))}else if(d.type==="text"){if(u(d))return;d.parent&&d.parent.type==="element"&&d.parent.isVisible&&d.parent.isTopElement&&m.push(`${_}${d.text??""}`)}},f=[];return l(c,0,f),f.join(`
`)}var jc=(e,t=-1)=>{let n=[],r=(o,i)=>{if(!(t!==-1&&i>t)&&!(o.type==="element"&&o!==e&&o.highlightIndex!==void 0)){if(o.type==="text"&&o.text)n.push(o.text);else if(o.type==="element")for(let s of o.children)r(s,i+1)}};return r(e,0),n.join(`
`).trim()};function Wc(e){let t=new Map,n=Object.keys(e.map);for(let r of n){let o=e.map[r];o.isInteractive&&typeof o.highlightIndex=="number"&&t.set(o.highlightIndex,o)}return t}function Vc(e){let t=e.split(`
`).map(r=>r.trim()).filter(r=>r.length>0),n=new Map;for(let r of t){let o=/^\[(\d+)\]<[^>]+>([^<]*)/.exec(r);if(o){let i=parseInt(o[1],10);n.set(i,r)}}return n}function Te(){let e=window._highlightCleanupFunctions||[];for(let t of e)typeof t=="function"&&t();window._highlightCleanupFunctions=[]}window.addEventListener("popstate",()=>{Te()});window.addEventListener("hashchange",()=>{Te()});window.addEventListener("beforeunload",()=>{Te()});var eo=window.navigation;if(eo&&typeof eo.addEventListener=="function")eo.addEventListener("navigate",()=>{Te()});else{let e=window.location.href;setInterval(()=>{window.location.href!==e&&(e=window.location.href,Te())},500)}function Pd(){let e=window.innerWidth,t=window.innerHeight,n=Math.max(document.documentElement.scrollWidth,document.body.scrollWidth||0),r=Math.max(document.documentElement.scrollHeight,document.body.scrollHeight||0),o=window.scrollX||window.pageXOffset||document.documentElement.scrollLeft||0,i=window.scrollY||window.pageYOffset||document.documentElement.scrollTop||0,s=Math.max(0,r-(window.innerHeight+i)),a=Math.max(0,n-(window.innerWidth+o));return{viewport_width:e,viewport_height:t,page_width:n,page_height:r,scroll_x:o,scroll_y:i,pixels_above:i,pixels_below:s,pages_above:t>0?i/t:0,pages_below:t>0?s/t:0,total_pages:t>0?r/t:0,current_page_position:i/Math.max(1,r-t),pixels_left:o,pixels_right:a}}function Td(e){let t=document.querySelectorAll('[data-reactroot], [data-reactid], [data-react-checksum], #root, #app, [id^="root-"], [id^="app-"], #adex-wrapper, #adex-root');for(let n of t)n.setAttribute("data-page-agent-not-interactive","true")}var no=class extends EventTarget{config;flatTree=null;selectorMap=new Map;elementTextMap=new Map;simplifiedHTML="<EMPTY>";lastTimeUpdate=0;isIndexed=!1;mask=null;maskReady=null;constructor(e={}){super(),this.config=e,Td(this),e.enableMask&&this.initMask()}initMask(){this.maskReady===null&&(this.maskReady=(async()=>{let{SimulatorMask:e}=await Promise.resolve().then(()=>(Rc(),Nc));this.mask=new e})())}async getCurrentUrl(){return window.location.href}async getLastUpdateTime(){return this.lastTimeUpdate}async getBrowserState(){let e=window.location.href,t=document.title,n=Pd(),r=to(this.config.viewportExpansion);await this.updateTree();let o=this.simplifiedHTML;return{url:e,title:t,header:`${`Current Page: [${t}](${e})`}
${`Page info: ${n.viewport_width}x${n.viewport_height}px viewport, ${n.page_width}x${n.page_height}px total page size, ${n.pages_above.toFixed(1)} pages above, ${n.pages_below.toFixed(1)} pages below, ${n.total_pages.toFixed(1)} total pages, at ${(n.current_page_position*100).toFixed(0)}% of page`}

${r===-1?"Interactive elements from top layer of the current page (full page):":"Interactive elements from top layer of the current page inside the viewport:"}

${n.pixels_above>4&&r!==-1?`... ${n.pixels_above} pixels above (${n.pages_above.toFixed(1)} pages) - scroll to see more ...`:"[Start of page]"}`,content:o,footer:n.pixels_below>4&&r!==-1?`... ${n.pixels_below} pixels below (${n.pages_below.toFixed(1)} pages) - scroll to see more ...`:"[End of page]"}}async updateTree(){this.dispatchEvent(new Event("beforeUpdate")),this.lastTimeUpdate=Date.now(),this.mask&&(this.mask.wrapper.style.pointerEvents="none"),Te();let e=[...this.config.interactiveBlacklist||[],...Array.from(document.querySelectorAll("[data-page-agent-not-interactive]"))];return this.flatTree=Uc({...this.config,interactiveBlacklist:e}),this.simplifiedHTML=Bc(this.flatTree,this.config.includeAttributes,this.config.keepSemanticTags),this.selectorMap.clear(),this.selectorMap=Wc(this.flatTree),this.elementTextMap.clear(),this.elementTextMap=Vc(this.simplifiedHTML),this.isIndexed=!0,this.mask&&(this.mask.wrapper.style.pointerEvents="auto"),this.dispatchEvent(new Event("afterUpdate")),this.simplifiedHTML}async cleanUpHighlights(){console.log("[PageController] cleanUpHighlights"),Te()}assertIndexed(){if(!this.isIndexed)throw new Error("DOM tree not indexed yet. Can not perform actions on elements.")}async clickElement(e){try{this.assertIndexed();let t=Ot(this.selectorMap,e),n=this.elementTextMap.get(e);return await Fc(t),pd(t)&&t.target==="_blank"?{success:!0,message:`\u2705 Clicked element (${n??e}). \u26A0\uFE0F Link opened in a new tab.`}:{success:!0,message:`\u2705 Clicked element (${n??e}).`}}catch(t){return{success:!1,message:`\u274C Failed to click element: ${t}`}}}async inputText(e,t){try{this.assertIndexed();let n=Ot(this.selectorMap,e),r=this.elementTextMap.get(e);return await yd(n,t),{success:!0,message:`\u2705 Input text (${t}) into element (${r??e}).`}}catch(n){return{success:!1,message:`\u274C Failed to input text: ${n}`}}}async selectOption(e,t){try{this.assertIndexed();let n=Ot(this.selectorMap,e),r=this.elementTextMap.get(e);return await xd(n,t),{success:!0,message:`\u2705 Selected option (${t}) in element (${r??e}).`}}catch(n){return{success:!1,message:`\u274C Failed to select option: ${n}`}}}async scroll(e){try{let{down:t,numPages:n,pixels:r,index:o}=e;return this.assertIndexed(),{success:!0,message:await wd((r??n*window.innerHeight)*(t?1:-1),o!==void 0?Ot(this.selectorMap,o):null)}}catch(t){return{success:!1,message:`\u274C Failed to scroll: ${t}`}}}async scrollHorizontally(e){try{let{right:t,pixels:n,index:r}=e;return this.assertIndexed(),{success:!0,message:await vd(n*(t?1:-1),r!==void 0?Ot(this.selectorMap,r):null)}}catch(t){return{success:!1,message:`\u274C Failed to scroll horizontally: ${t}`}}}async executeJavascript(script,signal){try{let asyncFunction=eval(`(async (signal) => { ${script} })`),result=await asyncFunction(signal);return{success:!0,message:`\u2705 Executed JavaScript. Result: ${result}`}}catch(e){return{success:!1,message:`\u274C Error executing JavaScript: ${e}`}}}async showMask(){await this.maskReady,this.mask?.show()}async hideMask(){await this.maskReady,this.mask?.hide()}dispose(){Te(),this.flatTree=null,this.selectorMap.clear(),this.elementTextMap.clear(),this.simplifiedHTML="<EMPTY>",this.isIndexed=!1,this.mask?.dispose(),this.mask=null}};(function(){try{if(typeof document<"u"){var e=document.createElement("style");e.appendChild(document.createTextNode(`._wrapper_1tu05_1 {
	position: fixed;
	bottom: 100px;
	left: 50%;
	transform: translateX(-50%) translateY(20px);
	opacity: 0;
	z-index: 2147483642; /* \u6BD4 SimulatorMask \u9AD8\u4E00\u5C42 */
	box-sizing: border-box;

	overflow: visible;

	* {
		box-sizing: border-box;
	}

	--width: 360px;
	--height: 40px;
	--border-radius: 12px;

	--side-space: 12px; /* \u63A7\u5236\u680F\u4E24\u4FA7\u7684\u95F4\u8DDD */
	--history-width: calc(var(--width) - var(--side-space) * 2);

	--color-1: rgb(57, 182, 255);
	--color-2: rgb(189, 69, 251);
	--color-3: rgb(255, 87, 51);
	--color-4: rgb(255, 214, 0);

	width: var(--width);
	height: var(--height);

	transition: all 0.3s ease-in-out;

	/* \u54CD\u5E94\u5F0F\u8BBE\u8BA1 */
	@media (max-width: 480px) {
		width: calc(100vw - 40px);
		--width: calc(100vw - 40px);
	}

	._background_1tu05_39 {
		position: absolute;
		inset: -2px -8px;
		border-radius: calc(var(--border-radius) + 4px);
		filter: blur(16px);
		overflow: hidden;
		/* mix-blend-mode: lighten; */
		/* display: none; */

		&::before {
			content: '';
			z-index: -1;
			pointer-events: none;
			position: absolute;
			width: 100%;
			height: 100%;
			/* left: -100%; */
			left: 0;
			top: 0;

			background-image: linear-gradient(
				to bottom left,
				var(--color-1),
				var(--color-2),
				var(--color-1)
			);
			animation: _mask-running_1tu05_1 2s linear infinite;
		}
		&::after {
			content: '';
			z-index: -1;
			pointer-events: none;
			position: absolute;
			width: 100%;
			height: 100%;
			left: 0;
			top: 0;

			background-image: linear-gradient(
				to bottom left,
				var(--color-2),
				var(--color-1),
				var(--color-2)
			);
			animation: _mask-running_1tu05_1 2s linear infinite;
			animation-delay: 1s;
		}
	}
}

@keyframes _mask-running_1tu05_1 {
	from {
		transform: translateX(-100%);
	}
	to {
		transform: translateX(100%);
	}
}

/* \u63A7\u5236\u680F */
._header_1tu05_99 {
	display: flex;
	align-items: center;
	justify-content: space-between;
	padding: 8px 12px;
	user-select: none;

	position: absolute;
	inset: 0;

	cursor: pointer;
	flex-shrink: 0; /* \u9632\u6B62 header \u88AB\u538B\u7F29 */

	background: rgba(0, 0, 0, 0.5);
	backdrop-filter: blur(10px);
	border-radius: var(--border-radius);
	background-clip: padding-box;

	box-shadow:
		0 0 0px 2px rgba(255, 255, 255, 0.4),
		0 0 5px 1px rgba(255, 255, 255, 0.3);

	._statusSection_1tu05_121 {
		display: flex;
		align-items: center;
		gap: 8px;
		flex: 1;
		min-height: 24px; /* \u786E\u4FDD\u5782\u76F4\u5C45\u4E2D */

		._indicator_1tu05_128 {
			width: 6px;
			height: 6px;
			border-radius: 50%;
			background: rgba(255, 255, 255, 0.5);
			flex-shrink: 0;
			animation: none; /* \u9ED8\u8BA4\u65E0\u52A8\u753B */

			/* \u8FD0\u884C\u72B6\u6001 - \u6709\u52A8\u753B */
			&._thinking_1tu05_137 {
				background: rgb(57, 182, 255);
				animation: _pulse_1tu05_1 0.8s ease-in-out infinite;
			}

			&._tool_executing_1tu05_142 {
				background: rgb(189, 69, 251);
				animation: _pulse_1tu05_1 0.6s ease-in-out infinite;
			}

			&._retry_1tu05_147 {
				background: rgb(255, 214, 0);
				animation: _retryPulse_1tu05_1 1s ease-in-out infinite;
			}

			/* \u9759\u6B62\u72B6\u6001 - \u65E0\u52A8\u753B */
			&._completed_1tu05_153,
			&._input_1tu05_154,
			&._output_1tu05_155 {
				background: rgb(34, 197, 94);
				animation: none;
			}

			&._error_1tu05_160 {
				background: rgb(239, 68, 68);
				animation: none;
			}
		}

		._statusText_1tu05_166 {
			color: white;
			font-size: 12px;
			line-height: 1;
			font-weight: 500;
			transition: all 0.3s ease-in-out;
			position: relative;
			overflow: hidden;
			display: flex;
			align-items: center;
			min-height: 24px; /* \u786E\u4FDD\u5782\u76F4\u5C45\u4E2D */

			&._fadeOut_1tu05_178 {
				animation: _statusTextFadeOut_1tu05_1 0.3s ease forwards;
			}

			&._fadeIn_1tu05_182 {
				animation: _statusTextFadeIn_1tu05_1 0.3s ease forwards;
			}
		}
	}

	._controls_1tu05_188 {
		display: flex;
		align-items: center;
		gap: 4px;

		._controlButton_1tu05_193 {
			width: 24px;
			height: 24px;
			border: none;
			border-radius: 4px;
			background: rgba(255, 255, 255, 0.1);
			color: white;
			cursor: pointer;
			display: flex;
			align-items: center;
			justify-content: center;
			font-size: 12px;
			line-height: 1;

			&:hover {
				background: rgba(255, 255, 255, 0.2);
			}
		}

		._stopButton_1tu05_212 {
			background: rgba(239, 68, 68, 0.2);
			color: rgb(255, 41, 41);
			font-weight: 600;

			&:hover {
				background: rgba(239, 68, 68, 0.3);
			}
		}
	}
}

@keyframes _statusTextFadeIn_1tu05_1 {
	0% {
		opacity: 0;
		transform: translateY(5px);
	}
	100% {
		opacity: 1;
		transform: translateY(0);
	}
}

@keyframes _statusTextFadeOut_1tu05_1 {
	0% {
		opacity: 1;
		transform: translateY(0);
	}
	100% {
		opacity: 0;
		transform: translateY(-5px);
	}
}

._historySectionWrapper_1tu05_246 {
	position: absolute;
	width: var(--history-width);
	bottom: var(--height);
	left: var(--side-space);
	z-index: -2;

	padding-top: 0px;
	visibility: collapse;
	overflow: hidden;

	transition: all 0.2s;

	background: rgba(2, 0, 20, 0.5);
	/* background: rgba(186, 186, 186, 0.2); */
	backdrop-filter: blur(10px);

	text-shadow: 0 0 1px rgba(0, 0, 0, 0.2);

	border-top-left-radius: calc(var(--border-radius) + 4px);
	border-top-right-radius: calc(var(--border-radius) + 4px);

	/* border: 2px solid rgba(255, 255, 255, 0.8); */
	border: 2px solid rgba(255, 255, 255, 0.4);
	box-shadow: 0 4px 16px rgba(0, 0, 0, 0.6);

	/* @media (prefers-color-scheme: dark) {
		box-shadow:
			0 8px 32px 0 rgba(0, 0, 0, 0.85),
			0 2px 12px 0 rgba(57, 182, 255, 0.1);
	} */

	._expanded_1tu05_278 & {
		padding-top: 8px;
		visibility: visible;
	}

	._historySection_1tu05_246 {
		position: relative;
		overflow-y: auto;
		overscroll-behavior: contain;
		scrollbar-width: none;
		max-height: 0;
		padding-inline: 8px;

		transition: max-height 0.2s;

		._expanded_1tu05_278 & {
			max-height: min(500px, calc(100vh - 200px - var(--height)));
		}

		._historyItem_1tu05_297 {
			/* backdrop-filter: blur(10px); */
			padding: 8px 10px;
			margin-bottom: 6px;
			background: linear-gradient(135deg, rgba(255, 255, 255, 0.08), rgba(255, 255, 255, 0.03));
			border-radius: 8px;
			border-left: 2px solid rgba(57, 182, 255, 0.5);
			font-size: 12px;
			color: white;
			/* color: black; */
			line-height: 1.3;
			position: relative;
			overflow: hidden;

			/* \u5FAE\u5999\u7684\u5185\u9634\u5F71 */
			box-shadow:
				inset 0 1px 0 rgba(255, 255, 255, 0.1),
				0 1px 3px rgba(0, 0, 0, 0.1);

			&::before {
				content: '';
				position: absolute;
				top: 0;
				left: 0;
				right: 0;
				height: 1px;
				background: linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.2), transparent);
			}

			&:hover {
				background: linear-gradient(135deg, rgba(255, 255, 255, 0.12), rgba(255, 255, 255, 0.06));
				/* transform: translateY(-1px); */
				box-shadow:
					inset 0 1px 0 rgba(255, 255, 255, 0.15),
					0 2px 4px rgba(0, 0, 0, 0.15);
			}

			&:last-child {
				margin-bottom: 10px;
			}

			&._completed_1tu05_153,
			&._input_1tu05_154,
			&._output_1tu05_155 {
				border-left-color: rgb(34, 197, 94);
				background: linear-gradient(135deg, rgba(34, 197, 94, 0.1), rgba(34, 197, 94, 0.05));
			}

			&._error_1tu05_160 {
				border-left-color: rgb(239, 68, 68);
				background: linear-gradient(135deg, rgba(239, 68, 68, 0.1), rgba(239, 68, 68, 0.05));
			}

			&._retry_1tu05_147 {
				border-left-color: rgb(255, 214, 0);
				background: linear-gradient(135deg, rgba(255, 214, 0, 0.1), rgba(255, 214, 0, 0.05));
			}

			&._observation_1tu05_355 {
				border-left-color: rgb(147, 51, 234);
				background: linear-gradient(135deg, rgba(147, 51, 234, 0.1), rgba(147, 51, 234, 0.05));
			}

			&._question_1tu05_360 {
				border-left-color: rgb(255, 159, 67);
				background: linear-gradient(135deg, rgba(255, 159, 67, 0.15), rgba(255, 159, 67, 0.08));
			}

			/* \u7A81\u51FA\u663E\u793A done \u6210\u529F\u7ED3\u679C */
			&._doneSuccess_1tu05_366 {
				background: linear-gradient(
					135deg,
					rgba(34, 197, 94, 0.25),
					rgba(34, 197, 94, 0.15),
					rgba(34, 197, 94, 0.08)
				);
				border: none;
				border-left: 4px solid rgb(34, 197, 94);
				box-shadow:
					0 4px 12px rgba(34, 197, 94, 0.3),
					inset 0 1px 0 rgba(255, 255, 255, 0.2),
					0 0 20px rgba(34, 197, 94, 0.1);
				font-weight: 600;
				color: rgb(220, 252, 231);
				padding: 10px 12px;
				margin-bottom: 8px;
				border-radius: 8px;
				position: relative;
				overflow: hidden;

				&::before {
					background: linear-gradient(90deg, transparent, rgba(34, 197, 94, 0.4), transparent);
				}

				&::after {
					content: '';
					position: absolute;
					top: 0;
					left: -100%;
					width: 100%;
					height: 100%;
					background: linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.1), transparent);
					animation: _shimmer_1tu05_1 2s ease-in-out infinite;
				}

				._historyContent_1tu05_402 {
					._statusIcon_1tu05_403 {
						font-size: 16px;
						animation: _celebrate_1tu05_1 0.8s ease-in-out;
						filter: drop-shadow(0 2px 4px rgba(34, 197, 94, 0.5));
					}
				}
			}

			/* \u7A81\u51FA\u663E\u793A done \u5931\u8D25\u7ED3\u679C */
			&._doneError_1tu05_412 {
				background: linear-gradient(
					135deg,
					rgba(239, 68, 68, 0.25),
					rgba(239, 68, 68, 0.15),
					rgba(239, 68, 68, 0.08)
				);
				border: none;
				border-left: 4px solid rgb(239, 68, 68);
				box-shadow:
					0 4px 12px rgba(239, 68, 68, 0.3),
					inset 0 1px 0 rgba(255, 255, 255, 0.2),
					0 0 20px rgba(239, 68, 68, 0.1);
				font-weight: 600;
				color: rgb(254, 226, 226);
				padding: 10px 12px;
				margin-bottom: 8px;
				border-radius: 8px;
				position: relative;
				overflow: hidden;

				&::before {
					background: linear-gradient(90deg, transparent, rgba(239, 68, 68, 0.4), transparent);
				}

				._historyContent_1tu05_402 {
					._statusIcon_1tu05_403 {
						font-size: 16px;
						filter: drop-shadow(0 2px 4px rgba(239, 68, 68, 0.5));
					}
				}
			}

			._historyContent_1tu05_402 {
				display: flex;
				align-items: flex-start;
				gap: 8px;

				word-break: break-all;
				white-space: pre-wrap;

				/* overflow-x: auto; */

				._statusIcon_1tu05_403 {
					font-size: 12px;
					flex-shrink: 0;
					line-height: 1;
					transition: all 0.3s ease;
				}

				._reflectionLines_1tu05_462 {
					display: flex;
					flex-direction: column;
					gap: 4px;
				}
			}

			._historyMeta_1tu05_469 {
				font-size: 10px;
				color: rgba(255, 255, 255, 0.6);
				/* color: rgb(61, 61, 61); */
				margin-top: 8px;
				line-height: 1;
			}
		}
	}
}

/* \u52A8\u753B\u5173\u952E\u5E27 - \u66F4\u5FEB\u7684\u95EA\u70C1 */
@keyframes _pulse_1tu05_1 {
	0%,
	100% {
		opacity: 1;
		transform: scale(1);
	}
	50% {
		opacity: 0.4;
		transform: scale(1.3);
	}
}

/* \u91CD\u8BD5\u52A8\u753B - \u65CB\u8F6C\u8109\u51B2 */
@keyframes _retryPulse_1tu05_1 {
	0%,
	100% {
		opacity: 1;
		transform: scale(1) rotate(0deg);
	}
	25% {
		opacity: 0.6;
		transform: scale(1.2) rotate(90deg);
	}
	50% {
		opacity: 0.8;
		transform: scale(1.1) rotate(180deg);
	}
	75% {
		opacity: 0.6;
		transform: scale(1.2) rotate(270deg);
	}
}

/* \u5E86\u795D\u52A8\u753B */
@keyframes _celebrate_1tu05_1 {
	0%,
	100% {
		transform: scale(1);
	}
	25% {
		transform: scale(1.2) rotate(-5deg);
	}
	75% {
		transform: scale(1.2) rotate(5deg);
	}
}

/* done \u5361\u7247\u7684\u5149\u6CFD\u6548\u679C */
@keyframes _shimmer_1tu05_1 {
	0% {
		left: -100%;
	}
	100% {
		left: 100%;
	}
}

/* \u8F93\u5165\u533A\u57DF\u6837\u5F0F */
._inputSectionWrapper_1tu05_539 {
	position: absolute;
	width: var(--history-width);
	top: var(--height);
	left: var(--side-space);
	z-index: -1;

	visibility: visible;
	overflow: hidden;

	height: 48px;

	transition: all 0.2s;

	background: rgba(186, 186, 186, 0.2);
	backdrop-filter: blur(10px);

	border-bottom-left-radius: calc(var(--border-radius) + 4px);
	border-bottom-right-radius: calc(var(--border-radius) + 4px);

	border: 2px solid rgba(255, 255, 255, 0.3);
	box-shadow: 0 1px 16px rgba(0, 0, 0, 0.4);

	&._hidden_1tu05_562 {
		visibility: collapse;
		height: 0;
	}

	._inputSection_1tu05_539 {
		display: flex;
		align-items: center;
		gap: 4px;
		padding: 8px 8px;

		._taskInput_1tu05_573 {
			flex: 1;
			background: rgba(255, 255, 255, 0.4);
			border: 1px solid rgba(255, 255, 255, 0.3);
			border-radius: 10px;
			padding-inline: 10px;
			color: rgb(20, 20, 20);
			font-size: 12px;
			height: 28px;
			line-height: 1;
			outline: none;
			transition: all 0.2s ease;

			/* text-shadow: 0 0 2px rgba(255, 255, 255, 0.8); */

			/* border-color: rgba(57, 182, 255, 0.3); */

			&::placeholder {
				color: rgb(53, 53, 53);
			}

			&:focus {
				background: rgba(255, 255, 255, 0.8);
				border-color: rgba(57, 182, 255, 0.6);
				box-shadow: 0 0 0 2px rgba(57, 182, 255, 0.2);
			}
		}
	}
}`)),document.head.appendChild(e)}}catch(t){console.error("vite-plugin-css-injected-by-js",t)}})();var Gc=[];for(let e of["MovePointerTo","ClickPointer"])window.addEventListener("PageAgent::"+e,t=>Gc.push([e,t.detail]));var Jc=new Yr({model:"gpt-5.6-luna",baseURL:"http://127.0.0.1:8899/v1",apiKey:"x",maxSteps:6,transformRequestBody:e=>({...e,reasoning_effort:"none"}),pageController:new no({enableMask:!1})}),Hc=[];Jc.addEventListener("activity",e=>Hc.push(e.detail));Jc.execute("Click the Pricing link in the top navigation, then finish with done.").then(e=>{document.documentElement.dataset.paExt=JSON.stringify({r:{success:e.success,data:e.data},pointerEvents:Gc,activity:Hc.map(t=>t.type+":"+(t.tool||"")),world:typeof chrome<"u"&&chrome.runtime?"isolated-content-script":"main"})});})();
/*! Bundled license information:

ai-motion/build/Motion.js:
  (**
   * AI Motion - WebGL2 animated border with AI-style glow effects
   *
   * @author Simon<gaomeng1900@gmail.com>
   * @license MIT
   * @repository https://github.com/gaomeng1900/ai-motion
   *)
*/
