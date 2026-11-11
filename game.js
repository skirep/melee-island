'use strict';
const $ = id => document.getElementById(id);
const canvas = $('view');
import('https://cdn.jsdelivr.net/npm/three@0.187.0/build/three.module.js')
  .then(THREE=>startGame(THREE))
  .catch(error=>{
    console.error(error);
    $('help').textContent='No s’ha pogut iniciar el motor 3D. Comprova la connexió i activa WebGL 2.';
  });

function startGame(THREE) {
  const renderer=new THREE.WebGLRenderer({canvas,antialias:false,alpha:false});
  renderer.setClearColor(new THREE.Color().setRGB(.078,.091,.17,THREE.SRGBColorSpace));
  const scene=new THREE.Scene();
  const camera=new THREE.Camera();
  const vertex = `
    in vec3 position, tint;
    in vec2 uv;
    uniform vec3 eye;
    uniform vec2 turn, tilt;
    uniform float aspect;
    out vec3 color;
    out vec2 tex;
    out float distanceToEye;
    out vec3 surface;
    void main(){
      vec3 d = position-eye;
      float x = d.x*turn.x-d.z*turn.y;
      float z = d.x*turn.y+d.z*turn.x;
      float y = d.y*tilt.x-z*tilt.y;
      z = z*tilt.x+d.y*tilt.y;
      gl_Position = vec4(x*1.34/aspect,y*1.34,z*1.001-.14,z);
      color=tint; tex=uv; distanceToEye=z; surface=position;
    }`;
  const fragment = `
    precision mediump float;
    out vec4 fragColor;
    uniform sampler2D art;
    uniform float layer;
    uniform vec3 shotLight;
    uniform vec3 lamps[9];
    in vec3 color;
    in vec2 tex;
    in float distanceToEye;
    in vec3 surface;
    void main(){
      if(layer>1.5){
        float elevation=atan(surface.y-1.6,84.);
        vec3 sky=texture(art,vec2(tex.x,clamp(.71-elevation*1.35,0.,1.))).rgb*color;
        sky=mix(sky,vec3(.065,.058,.153),smoothstep(.46,.98,elevation));
        fragColor=vec4(sky,1.);return;
      }
      vec4 pixel=texture(art,tex);
      if(pixel.a<.45)discard;
      vec3 tone=color*pixel.rgb;
      if(layer>.5){
        vec3 q=floor(surface*19.);
        float grain=fract(sin(dot(mod(q,vec3(61.)),vec3(3.17,7.17,11.31)))*371.37);
        tone*=.89+grain*.21;
      }
      if(distanceToEye<57.){
        float glow=0.;
        for(int i=0;i<9;i++){
          vec3 delta=surface-lamps[i];
          glow+=max(0.,1.-length(delta)/4.9)*.61;
        }
        glow+=shotLight.z*max(0.,1.-distance(surface.xz,shotLight.xy)/8.);
        tone=tone*(.89+glow*.28)+vec3(.27,.125,.028)*glow;
      }
      float fog=smoothstep(14.,56.,distanceToEye)*(1.-step(57.,distanceToEye));
      fragColor=vec4(mix(tone,vec3(.24,.19,.32),fog*.78),1.);
    }`;
  const viewUniforms={
    eye:{value:new THREE.Vector3()},turn:{value:new THREE.Vector2()},
    tilt:{value:new THREE.Vector2()},aspect:{value:1},
    shotLight:{value:new THREE.Vector3()},lamps:{value:[]}
  };
  function material(art,layer) {
    return new THREE.RawShaderMaterial({
      vertexShader:vertex,fragmentShader:fragment,glslVersion:THREE.GLSL3,
      uniforms:{...viewUniforms,art:{value:art},layer:{value:layer}},
      side:THREE.DoubleSide,depthTest:layer!==2,depthWrite:layer!==2
    });
  }
  function mesh(data,art,layer,order,dynamic=false) {
    const geometry=new THREE.BufferGeometry();
    const buffer=new THREE.InterleavedBuffer(new Float32Array(data),8);
    if(dynamic) buffer.setUsage(THREE.DynamicDrawUsage);
    for(const [name,size,offset] of [['position',3,0],['tint',3,3],['uv',2,6]]) {
      geometry.setAttribute(name,new THREE.InterleavedBufferAttribute(buffer,size,offset));
    }
    const object=new THREE.Mesh(geometry,material(art,layer));
    object.frustumCulled=false;object.renderOrder=order;scene.add(object);
    return object;
  }
  function updateMesh(object,data) {
    const buffer=object.geometry.getAttribute('position').data;
    buffer.array.set(data);
    buffer.needsUpdate=true;
    object.geometry.setDrawRange(0,data.length/8);
    object.visible=data.length>0;
  }
  function texture(source) {
    const t=new THREE.Texture(source);
    t.flipY=false;t.generateMipmaps=false;
    t.minFilter=THREE.NearestFilter;t.magFilter=THREE.NearestFilter;
    t.needsUpdate=true;
    return t;
  }
  let skyTexture;
  const skyImage=new Image();
  skyImage.onload=()=>{skyTexture=texture(skyImage);};
  skyImage.src='./night-sky.svg';
  function makeCanvas(w,h) {
    const c=document.createElement('canvas');
    c.width=w; c.height=h;
    return c;
  }
  const blank=makeCanvas(1,1);
  const blankContext=blank.getContext('2d');
  blankContext.fillStyle='#fff'; blankContext.fillRect(0,0,1,1);
  const white=texture(blank);
  const world=[], solids=[];
  let seed=9152;
  function random() {
    seed=(Math.imul(seed,1664525)+1013904223)>>>0;
    return seed/4294967296;
  }
  function rgb(hex,shade=1) {
    return [16,8,0].map(shift => Math.min(1,((hex>>shift)&255)/255*shade));
  }
  function quad(mesh,a,b,c,d,color,uv=[[0,0],[1,0],[1,1],[0,1]]) {
    const points=[a,b,c,d];
    for(const i of [0,1,2,0,2,3]) mesh.push(...points[i],...color,...uv[i]);
  }
  function block(x,y,z,w,h,d,color,solid=false) {
    const a=[x,y,z], b=[x+w,y,z], c=[x+w,y,z+d], e=[x,y,z+d];
    const A=[x,y+h,z], B=[x+w,y+h,z], C=[x+w,y+h,z+d], E=[x,y+h,z+d];
    quad(world,A,B,C,E,rgb(color,1.17));
    quad(world,a,b,B,A,rgb(color,.94));
    quad(world,b,c,C,B,rgb(color,.69));
    quad(world,c,e,E,C,rgb(color,.78));
    quad(world,e,a,A,E,rgb(color,.85));
    if(solid) solids.push({x,y,z,w,h,d});
  }
  const timber=0x593848, gold=0xeaa759;
  const streets=[[10,8,23,49],[5,21,29,28],[5,34,30,39]];
  for(let z=0;z<55;z++) for(let x=0;x<34;x++) {
    const land=x>=3 && x<31 && z>=12 && z<51;
    const dock=x>=12 && x<21 && z>=2 && z<12;
    const road=streets.some(([x1,z1,x2,z2])=>x>=x1&&z>=z1&&x<x2&&z<z2);
    const base=dock?0x634555:land?(road?0x615569:0x3a424f):0x263c58;
    block(x-.004,land||dock?-.16:-.67,z-.004,1.01,.16,1.01,base);
    if(land||dock) {
      for(let i=0;i<3;i++) {
        const px=x+random()*.86,pz=z+random()*.83;
        block(px,.002,pz,.08+random()*.15,.008,.03+random()*.08,
          road?[0x877079,0x474254,0x9b7a77][i]:dock?0x967064:0x505967);
      }
    } else if(random()<.33) {
      block(x+random()*.6,-.498,z+random()*.7,.22+random()*.36,.005,.05,0x42627c);
    }
  }
  for(let z=2;z<13;z+=2) for(const x of [12.05,20.65]) {
    block(x,-.48,z,.24,1.17,.24,timber,true);
    block(x-.06,.67,z-.06,.36,.13,.36,0x92646a);
  }
  function lamp(x,z) {
    block(x,0,z,.14,2.65,.14,0x4a303e);
    block(x-.14,2.54,z-.14,.42,.12,.42,timber);
    block(x-.09,2.66,z-.09,.32,.36,.32,0xffc57d);
    block(x-.16,3.01,z-.16,.46,.13,.46,0x704852);
    for(let i=0;i<18;i++) {
      const angle=random()*Math.PI*2, radius=random()*1.7;
      block(x+Math.cos(angle)*radius,.019,z+Math.sin(angle)*radius,.18,.006,.1,
        [0x92746f,0x967773,0xb08870][i%3]);
    }
  }
  function windowAt(x,y,z) {
    block(x-.08,y-.09,z+.02,1.02,.95,.13,timber);
    block(x,y,z,.86,.74,.12,0xffac62);
    block(x+.39,y,z-.018,.08,.74,.15,timber);
    block(x,y+.34,z-.017,.86,.08,.15,timber);
    block(x-.13,y-.14,z-.1,1.1,.12,.28,0x89575f);
  }
  function house(x,z,w,d,h,wall,roof) {
    block(x,0,z,w,.37,d,0x51485a,true);
    block(x,.37,z,w,h-.37,d,wall,true);
    for (let row=.54;row<h-.1;row+=.34) {
      block(x-.03,row,z-.03,w+.06,.035,d+.06,timber);
      for(let i=0;i<4;i++) {
        const px=x+random()*(w-.38);
        block(px,row+.08,z-.051,.13+random()*.22,.058,.03,0x9c7475);
      }
    }
    for(const px of [x,x+w-.24]) block(px,0,z-.1,.24,h+.14,.28,timber);
    for(const y of [h*.49,h-.25]) block(x-.08,y,z-.11,w+.16,.2,.22,timber);
    for(let px=x+.52;px<x+w-.95;px+=1.65) windowAt(px,h-.96,z-.11);
    block(x+w*.47,0,z-.15,1.12,1.82,.22,0x432c42);
    for(let i=0;i<5;i++) block(x+w*.47+i*.22,0,z-.18,.04,1.82,.04,0x80565c);
    block(x+w*.47+.91,.85,z-.2,.11,.09,.08,gold);
    for(let i=0;i<8;i++) {
      const inset=i*d/17;
      block(x-.32,h+i*.25,z-.37+inset,w+.64,.27,d+.74-inset*2,
        i%2?roof:roof+0x050506);
    }
    block(x+w*.76,h+1.25,z+d*.53,.53,1.38,.57,0x655569);
    block(x+w*.76-.09,h+2.57,z+d*.53-.09,.71,.17,.75,0x8d6f79);
  }
  house(4,14,6,6,3.5,0x8c647a,0x603950);
  house(23,14,6,7,4.0,0x877280,0x5d4c70);
  house(4,29,6,5,4.6,0x718088,0x434761);
  house(23,29,6,5,3.7,0xa37071,0x623954);
  house(4,40,5,8,3.8,0x866881,0x4d446c);
  house(24,40,6,8,4.2,0x626b83,0x543a62);
  const lampPositions=[[11,12],[21,15],[10,22],[22,22],[9,34],[23,35],[11,44],[22,44],[16,49]];
  for(const [x,z] of lampPositions) lamp(x,z);
  viewUniforms.lamps.value=lampPositions.map(([x,z])=>new THREE.Vector3(x,2.8,z));
  function cobbles(x,z) {
    for(let row=0;row<4;row++) for(let col=0;col<3;col++) {
      const offset=row%2?.075:0;
      const sx=x+col*.31+offset,sz=z+row*.25;
      const colors=[0x615264,0x524659,0x69576a,0x705d70,0x594d60,0x665564];
      quad(world,[sx,.017,sz],[sx+.28,.017,sz],[sx+.27,.017,sz+.222],[sx-.008,.017,sz+.224],rgb(colors[Math.floor(random()*colors.length)]));
    }
  }
  for(let z=12;z<49;z++) for(let x=11;x<23;x++) cobbles(x,z);
  for(let z=3;z<12;z++) for(let i=0;i<6;i++) {
    const y=.019,sz=z+i/6;
    quad(world,[12.28,y,sz],[20.71,y,sz],[20.71,y,sz+.035],[12.28,y,sz+.035],rgb(0x382d46));
  }
  function barrel(x,z){
    for(let i=0;i<5;i++){
      const inset=Math.abs(2-i)*.035;
      block(x+inset,i*.18,z+inset,.75-inset*2,.183,.72-inset*2,
        i===1||i===3?0x625365:0x935f50);
    }
    solids.push({x,y:0,z,w:.74,h:.9,d:.72});
  }
  for(const [x,z] of [[12.8,5],[19.5,8],[10.6,15],[22.4,18],[10,25],[22,31],[12,38],[22,46]]) barrel(x,z);
  function tree(x,z,scale) {
    block(x,0,z,.42*scale,3.1*scale,.45*scale,0x503545,true);
    for(let i=0;i<17;i++){
      const dx=(random()-.5)*3.4*scale,dz=(random()-.5)*2.7*scale;
      block(x+dx,(2.4+random()*1.7)*scale,z+dz,(.65+random())*scale,
        (.4+random()*.8)*scale,(.6+random())*scale,[0x344854,0x3b515b,0x4c6566,0x2c3c50][i%4]);
    }
  }
  for(const [x,z,k] of [[5,25,.95],[28,24,1.35],[6,37,1],[29,37,1.15],[13,47,.9],[20,48,1.03]]) tree(x,z,k);
  // A moored brig and the outline of its rigging frame the entrance to town.
  for(let i=0;i<5;i++) block(21.7-i*.11,-.48+i*.16,4.7-i*.28,2.8+i*.22,.18,6.4+i*.56,i%2?0x493447:0x65434b);
  for(const z of [6.5,9.6]){
    block(23,0,z,.18,5.9,.18,0x59404e);
    block(21.55,4.7,z-.01,3,.15,.16,0x785358);
    for(let i=0;i<7;i++) block(21.67+i*.075,4.65-i*.29,z+i*.037,2.75-i*.15,.3,.08,
      [0x756779,0x8f7d8b,0x97838c][i%3]);
  }
  for(let i=0;i<17;i++){
    const x=1+i*2,z=53+Math.sin(i)*1.9;
    block(x,-.5,z,2.6,1.4+random()*3,3.7,0x424058);
  }
  function crate(x,z,s=.85) {
    block(x,0,z,s,s,s,0x845f63,true);
    for(let i=0;i<5;i++) block(x+i*s/5,.09,z-.016,.035,s-.18,.027,0x4b384e);
    for(const y of [.08,s-.13]) block(x-.03,y,z-.04,s+.06,.09,.09,0xb28672);
  }
  for(const [x,z,s] of [[13,9,.55],[19.4,10,.8],[11,17,.75],[11.82,17,.55],[21.7,27,.8],[10.2,31,.65],[21,38,.7],[12,46,.9]]) crate(x,z,s);
  for(let i=0;i<90;i++) {
    const x=random()*34,z=12+random()*40;
    if(x>3&&x<30&&z<49) continue;
    block(x,-.38,z,.8+random()*1.2,.35+random()*1.5,.9+random(),0x42475e,true);
  }
  // The lighthouse door is a landmark and interaction point.
  for(let i=0;i<10;i++) block(15.2,i*.62,49.3,3.65,.63,2.7,i%2?0x8d7086:0xb09597,true);
  block(16.36,0,49.14,1.18,2,.21,0x30263d);
  block(14.83,6.22,48.95,4.38,.25,3.4,0x5f4666);
  block(15.48,6.49,49.53,3.08,1.22,2.28,0x4c4c64);
  block(15.1,7.71,49.18,3.86,.35,2.98,0x6c486b);
  block(15.51,8.06,49.49,3.04,.37,2.36,0x724d6c);
  block(16.13,8.43,50,1.8,.38,1.4,0x835977);
  block(16.85,8.81,50.47,.36,.65,.36,0xc79971);
  // Moon and stars are distant voxel geometry.
  for(let i=0;i<125;i++) {
    const angle=random()*Math.PI*2, y=8+random()*34;
    const x=17+Math.sin(angle)*71,z=25+Math.cos(angle)*71,s=.065+random()*.14;
    block(x,y,z,s,s,s,[0xe2bec1,0x8d91b5,0xbcb0cf][i%3]);
  }
  for(let row=-5;row<=5;row++) {
    const width=Math.floor(Math.sqrt(31-row*row));
    block(30-width*.55,16+row*.55,68,(2*width+1)*.55,.55,.13,0xffd6a1);
  }
  mesh(world,white,1,1);
  world.length=0;
  const effectsMesh=mesh(new Float32Array(384),white,0,3,true);
  const skyMesh=mesh(new Float32Array(32*48),white,2,0,true);
  skyMesh.visible=false;
  const palettes=[
    ['#8e4052','#d06b60','#d08c63','#ecc49a','#49596f','#deb06e'],
    ['#355269','#528d8f','#aa6655','#d89973','#46364d','#9fbdb7'],
    ['#6d4c7e','#a3779e','#a86859','#e2a67d','#485470','#efd08d'],
    ['#684252','#a35a66','#a16952','#d2a074','#373750','#dbb473'],
    ['#415f55','#7b9c69','#a26651','#df9b72','#3a4658','#dba361'],
    ['#8e633d','#cca56e','#714536','#b57757','#4a4457','#e7c989'],
    ['#435574','#7694b6','#b4745b','#dda078','#3b3a62','#c6d6e1'],
    ['#77364e','#ae5768','#b3795d','#eeaa78','#252e49','#f3cd75'],
    ['#765633','#a48052','#945742','#d8916f','#3b3b50','#e0bc89'],
    ['#457474','#71a59a','#805446','#cc886a','#3b455d','#c6dfcc'],
    ['#864a35','#bc744d','#a15c4b','#db9069','#56475d','#d9c07e'],
    ['#565073','#8883ae','#ad6b57','#e8a686','#3b4264','#d8bad3'],
    ['#8a6c4a','#c8a77e','#945944','#dca076','#574454','#eed3a1'],
    ['#445459','#6d8a81','#8a5449','#ca8b6c','#4c4057','#b5cdb6'],
    ['#6f495c','#9a687e','#a46555','#d39781','#4a445e','#e2c894']
  ];
  const spriteSize=96, columns=8;
  const animations={
    idle:[0,4,4,true],walk:[4,8,12,true],run:[12,8,16,true],
    jump:[20,6,12],aim:[26,4,9],shoot:[30,6,16],
    wind:[36,4,9],slash:[40,4,15],hurt:[44,3,13],down:[47,4,12],talk:[51,5,10,true]
  };
  const rows=7;
  const gunners=new Set([1,6,11]);
  let ink;
  function polygon(ctx,color,points) {
    ctx.fillStyle=color;
    ctx.beginPath();
    for(const [i,[x,y]] of points.entries()) i?ctx.lineTo(x,y):ctx.moveTo(x,y);
    ctx.closePath(); ctx.fill();
  }
  function pirate(colors,state,frame,variant) {
    const [coat,trim,skin,light,pants,metal]=colors;
    const outline='#232036', linen='#e2c3a5', leather='#3e2a42';
    const locomotion=state==='walk'||state==='run';
    const pace=frame*Math.PI/4;
    const running=state==='run';
    const airborne=state==='jump';
    const shot=state==='shoot';
    const aiming=state==='aim'||shot;
    const bob=locomotion?Math.round(-Math.abs(Math.cos(pace))*(running?3:1.5)):
      state==='idle'?[0,-1,-1,0][frame]:airborne?[1,-1,-2,-2,-1,1][frame]:0;
    ink.translate(32,58);
    ink.scale([.94,1.08,.83,1.1,1.16,.86,1,.98,1.12,.83,1.14,.88,1,.91,.92][variant],
      [1,.94,1.04,.98,1.02,.86,1.07,1.05,.92,.95,1,.99,1.03,.86,.9][variant]);
    ink.translate(-32,-58);
    const lunge=state==='slash'?[2,7,5,1][frame]:0;
    const recoil=state==='hurt'?[4,3,1][frame]:shot?[6,5,3,2,1,0][frame]:0;
    const fall=state==='down'?[.16,.48,.8,1][frame]:0;
    ink.translate(32,57);
    ink.scale(1-fall*.38,1-fall*.26);
    ink.rotate(-fall*1.43);
    ink.translate(-32,-57);
    const rect=(x,y,w,h,c)=>{ink.fillStyle=c;ink.fillRect(Math.round(x),Math.round(y),w,h);};
    function shape(color,points) {polygon(ink,color,points);}
    function seam(color,points,width=1) {
      ink.strokeStyle=color; ink.lineWidth=width; ink.beginPath();
      points.forEach(([x,y],i)=>i?ink.lineTo(x,y):ink.moveTo(x,y)); ink.stroke();
    }
    for(const side of [-1,1]) {
      const cycle=pace+(side===1?Math.PI:0);
      const reach=locomotion?Math.sin(cycle)*(running?8:4):airborne?side*5:0;
      const lift=locomotion?Math.max(0,Math.cos(cycle))*(running?7:4):
        airborne?[1,5,9,8,5,0][frame]+side:0;
      const hip=32+side*5, knee=hip+reach*.5, ankle=hip+reach;
      const top=39+bob, foot=55-lift;
      shape(outline,[[hip-5,top],[hip+5,top],[knee+4,46-lift*.33],[ankle+4,foot+2],[ankle-5,foot+2],[knee-4,46-lift*.33]]);
      shape(pants,[[hip-3,top],[hip+3,top],[knee+2,46-lift*.33],[ankle+2,foot],[ankle-3,foot]]);
      seam(trim,[[hip-2,top+2],[knee-2,46-lift*.33],[ankle-2,foot-3]]);
      shape(leather,[[ankle-4,foot-5],[ankle+3,foot-5],[ankle+5,foot+1],[ankle+4,foot+3],[ankle-6,foot+3]]);
      rect(ankle-4,foot-4,7,1,trim); rect(ankle-5,foot+2,9,1,outline);
      rect(ankle-4,foot-2,2,1,metal);
    }
    ink.translate(recoil-lunge*.45,bob);
    if(running||airborne) {
      ink.translate(32,39);
      ink.rotate(running?Math.sin(pace)*.085:Math.sin(frame/5*Math.PI)*.09);
      ink.translate(-32,-39);
    }
    shape(outline,[[21,23],[29,20],[37,20],[44,25],[47,44],[41,48],[34,46],[24,49],[18,44]]);
    shape(coat,[[22,24],[29,22],[37,22],[42,26],[45,43],[40,46],[34,44],[24,47],[20,43]]);
    shape(trim,[[25,24],[29,24],[30,31],[26,43],[22,44],[23,34]]);
    shape(linen,[[28,23],[37,22],[38,30],[34,37],[30,31]]);
    rect(22,37,21,4,outline);rect(31,37,5,4,metal);rect(32,38,3,2,leather);
    rect(25,12,16,13,outline);rect(26,13,14,10,skin);rect(28,13,10,4,light);
    rect(29,17,2,2,outline);rect(35,17,3,2,outline);
    rect(33,18,2,3,light);rect(29,22,9,3,leather);
    shape(outline,[[17,13],[19,10],[24,11],[27,4],[36,3],[41,10],[47,9],[47,14],[42,17],[24,16]]);
    shape(coat,[[19,12],[25,13],[28,6],[35,5],[40,12],[45,11],[43,15],[25,15]]);
    rect(28,7,9,1,trim);rect(29,12,7,2,metal);rect(40,17,2,4,metal);
    if([4,5,8,9,12,13].includes(variant)) {
      shape(outline,[[21,14],[22,8],[27,5],[38,5],[43,10],[43,15]]);
      shape(trim,[[22,14],[23,9],[29,7],[38,7],[41,12],[41,14]]);
      rect(24,13,17,2,coat);
    }
    if([0,2,5,7,10,13].includes(variant)) {
      shape(leather,[[26,20],[29,21],[35,21],[40,19],[39,24],[35,28],[30,26],[27,24]]);
      rect(30,23,6,1,trim);
    }
    if([7,11].includes(variant)) {
      shape(metal,[[37,7],[39,2],[44,0],[44,5],[40,10]]);
      rect(28,17,5,2,outline);
    }
    if([3,6,9,12,14].includes(variant)) {
      shape(metal,[[27,25],[39,25],[39,43],[34,46],[25,43]]);
      shape(trim,[[29,26],[37,26],[36,40],[34,42],[28,40]]);
    }
    if([3,9,12,14].includes(variant)) {
      shape(leather,[[24,13],[27,11],[27,24],[25,30],[22,27]]);
      shape(leather,[[40,13],[43,14],[45,27],[41,29],[39,23]]);
      rect(24,21,2,5,trim);rect(41,18,1,7,trim);
    }
    if([2,4,8,10,13].includes(variant)) {
      shape(trim,[[25,13],[41,13],[41,16],[29,16],[23,21],[21,19]]);
      rect(26,14,12,1,metal);
    }
    if([0,6,7,11].includes(variant)) {
      seam(metal,[[20,12],[25,14],[29,6],[35,6],[41,13],[45,11]]);
      seam(leather,[[27,16],[39,20]]);
    }
    for(const y of [28,32,35,42]) {
      rect(24,y,2,1,metal); rect(40,y,2,1,metal);
    }
    seam(leather,[[24,28],[22,37],[23,44]]);
    seam(trim,[[41,25],[40,33],[43,43]]);
    rect(32,20,4,1,light); rect(28,16,3,1,leather);
    if(frame!==3||state!=='idle') rect(29,17,1,1,'#f5d9aa');
    rect(26,19,1,2,metal); rect(38,22,2,1,skin);
    const armed=[0,1,2,4,6,7,10,11].includes(variant);
    const wind=state==='wind'?(frame+1)*2:0;
    const gesture=state==='talk'?[0,3,7,4,2][frame]:0;
    if(gesture>0) rect(32,21,3,2,outline);
    const swing=locomotion?Math.sin(pace)*(running?6:3):0;
    const armX=19-lunge*1.7-gesture*.55+swing*.45+(aiming?3:0);
    const armY=34-wind-lunge-gesture+swing-(airborne?6:0)-(aiming?8:0);
    shape(outline,[[23,24],[26,29],[armX+3,armY+4],[armX-3,armY+3],[armX-3,armY-2]]);
    rect(Math.round(armX)-2,armY,5,4,skin);
    shape(trim,[[41,25],[44,26],[46,35],[45,39],[41,38],[40,29]]);
    if(aiming || gunners.has(variant)) {
      const x=Math.round(armX), y=Math.round(armY);
      shape(outline,[[x-6,y-5],[x+6,y-6],[x+8,y-2],[x+1,y],[x-1,y+5],[x-5,y+4]]);
      shape(leather,[[x-4,y-3],[x+4,y-3],[x-2,y+4],[x-5,y+3]]);
      rect(x-7,y-5,13,2,'#9eabb9');
      rect(x-7,y-4,3,3,metal);
      if(shot&&frame<2) {
        shape('#ed854b',[[x-6,y-4],[x-12,y-6],[x-18,y-12],[x-16,y-5],[x-22,y-3],[x-14,y],[x-15,y+4],[x-8,y]]);
        shape('#fff0a3',[[x-7,y-4],[x-15,y-7],[x-12,y-4],[x-17,y-2],[x-11,y-1]]);
      }
    } else if(armed){
      const x=Math.round(armX), y=Math.round(armY);
      const tip=[x-5-lunge*1.5,y-18+wind*1.6+lunge*1.4];
      shape(outline,[[x+2,y+4],[x-3,y+2],[tip[0]-2,tip[1]],[tip[0]+1,tip[1]-3],[x+1,y-3]]);
      shape('#bad0db',[[x-2,y-1],[tip[0],tip[1]-2],[tip[0]+2,tip[1]+2],[x+1,y-2]]);
      rect(x-4,y-2,8,2,metal);
    }
  }
  const sprites=palettes.map((palette,variant)=>{
    const atlas=makeCanvas(columns*spriteSize,rows*spriteSize);
    ink=atlas.getContext('2d');
    for(const [state,[offset,count]] of Object.entries(animations)) {
      for(let frame=0;frame<count;frame++) {
        const index=offset+frame;
        ink.save();
        ink.beginPath();
        ink.rect(index%columns*spriteSize,Math.floor(index/columns)*spriteSize,spriteSize,spriteSize);
        ink.clip();
        ink.translate(index%columns*spriteSize,Math.floor(index/columns)*spriteSize);
        ink.scale(1.5,1.5);
        pirate(palette,state,frame,variant);
        ink.restore();
      }
    }
    return texture(atlas);
  });

  const blade=$('blade'), overlay=blade.getContext('2d');
  const keys=new Set();
  const starts=[
    [16.8,15.4,0,false],[19,23.8,1,false],[13,31,2,false],
    [20.8,37.2,4,false],[16.9,44.5,7,true],
    [26,25,6,false],[7,38,10,false],[26,38,11,false]
  ];
  const villagers=[
    [11.2,14.2,3,'La tavernera','El capità és a la pujada del far. Alça el sabre quan vegis que ell prepara el cop.'],
    [14,5.6,5,'El pescador','Quan el far calla, el mar s’empassa les barques.'],
    [19.1,12.7,8,'L’estibador','Pots saltar per damunt de les caixes baixes del moll.'],
    [11,24.1,9,'La cartògrafa','Segueix el carrer empedrat cap al nord.'],
    [22.4,20.2,12,'La cuinera','Avui la sopa de peix va a compte de qui encengui el far.'],
    [7.2,26.3,13,'El boter','He amagat els barrils bons. Els altres ja els trobarà el capità.'],
    [22.8,41.5,14,'La faronera','El capità em va robar la clau. Recupera-la i obre la porta del far.']
  ].map(([x,z,variant,name,line])=>({x,z,variant,name,line,homeX:x,homeZ:z,state:'idle',phase:variant*.28}));
  let player, pirates, mode='title', missionKey, previous=0, elapsed=0, message='', messageTime=0;
  let audio, surfGain, rightButton=false;
  function reset() {
    player={x:16.5,z:7.3,y:0,vy:0,yaw:0,pitch:.018,hp:100,attack:0,queued:false,
      guard:false,phase:0,step:0,damage:0,weapon:'sword',swap:0,
      gunTime:0,reload:0,loaded:2,reserve:14,aim:0,moving:0,running:false,landing:0};
    pirates=starts.map(([x,z,variant,captain])=>({x,z,variant,captain,hp:captain?5:3,
      state:'idle',timer:0,phase:0,y:0,vy:0,hop:1.5+variant*.17}));
    for(const actor of villagers) {
      actor.x=actor.homeX; actor.z=actor.homeZ; actor.state='idle'; actor.phase=actor.variant*.28;
    }
    missionKey=null;
    message=''; messageTime=0;
  }
  reset();
  function startSurf() {
    if(surfGain) return;
    const buffer=audio.createBuffer(1,audio.sampleRate*5,audio.sampleRate);
    const samples=buffer.getChannelData(0);
    let wave=0;
    for(let i=0;i<samples.length;i++) {
      wave=wave*.86+(Math.random()*2-1)*.14;
      const t=i/samples.length*Math.PI*2;
      samples[i]=wave*(.3+.24*Math.sin(t)+.12*Math.cos(t*2));
    }
    const source=audio.createBufferSource(), filter=audio.createBiquadFilter();
    source.buffer=buffer;source.loop=true;
    filter.type='lowpass';filter.frequency.value=360;
    surfGain=audio.createGain();surfGain.gain.value=0;
    source.connect(filter);filter.connect(surfGain);surfGain.connect(audio.destination);source.start();
  }
  function sound(kind) {
    if(!audio || audio.state!=='running') return;
    const [frequency,end,duration,type]={
      swing:[280,58,.17,'triangle'],hit:[175,42,.14,'square'],parry:[1360,290,.22,'triangle'],
      hurt:[106,46,.26,'triangle'],jump:[126,238,.11,'triangle'],step:[78,38,.07,'triangle'],
      key:[510,995,.3,'sine'],bell:[430,640,.85,'sine'],
      report:[92,29,.31,'triangle'],click:[370,75,.08,'square'],rack:[520,175,.1,'triangle'],
      distant:[132,41,.18,'triangle']
    }[kind];
    const now=audio.currentTime, osc=audio.createOscillator(), gain=audio.createGain();
    osc.type=type; osc.frequency.setValueAtTime(frequency,now);
    osc.frequency.exponentialRampToValueAtTime(end,now+duration);
    gain.gain.setValueAtTime(kind==='step'?.025:.10,now);
    gain.gain.exponentialRampToValueAtTime(.001,now+duration);
    osc.connect(gain); gain.connect(audio.destination);
    if(kind==='report'||kind==='distant') {
      const noise=audio.createBuffer(1,Math.ceil(audio.sampleRate*.24),audio.sampleRate);
      const data=noise.getChannelData(0);
      for(let i=0;i<data.length;i++) data[i]=(Math.random()*2-1)*Math.exp(-6*i/data.length);
      const source=audio.createBufferSource(), volume=audio.createGain();
      source.buffer=noise;volume.gain.value=kind==='report'?.24:.08;
      source.connect(volume);volume.connect(audio.destination);source.start();
    }
    osc.start(); osc.stop(now+duration);
  }
  function say(text) {message=text;messageTime=3;}
  function ground(x,z) {
    return (x>=3&&x<=30.95&&z>=12&&z<=50.9)||(x>=12&&x<=20.95&&z>=2&&z<=12.1);
  }
  function obstruction(x,z,r,feet) {
    return solids.some(b=>feet<b.y+b.h-.022&&feet+1.6>b.y&&
      x+r>b.x&&x-r<b.x+b.w&&z+r>b.z&&z-r<b.z+b.d);
  }
  function floorAt(x,z,r,feet) {
    let height=0;
    for(const b of solids) {
      const top=b.y+b.h;
      if(top<=feet+.025&&top>height&&x+r>b.x&&x-r<b.x+b.w&&z+r>b.z&&z-r<b.z+b.d) height=top;
    }
    return height;
  }
  function move(actor,dx,dz,r,y) {
    if(ground(actor.x+dx,actor.z)&&!obstruction(actor.x+dx,actor.z,r,y)) actor.x+=dx;
    if(ground(actor.x,actor.z+dz)&&!obstruction(actor.x,actor.z+dz,r,y)) actor.z+=dz;
  }
  function clearPath(x,z,otherX,otherZ) {
    const steps=Math.ceil(Math.hypot(otherX-x,otherZ-z)*4);
    for(let i=1;i<steps;i++) {
      const t=i/steps;
      if(obstruction(x+(otherX-x)*t,z+(otherZ-z)*t,.06,1.04)) return false;
    }
    return true;
  }
  function aimAt(x,z) {
    return Math.cos(Math.atan2(x-player.x,z-player.z)-player.yaw);
  }
  function hit() {
    const target=pirates.filter(e=>e.hp>0&&Math.hypot(e.x-player.x,e.z-player.z)<2.22&&
      aimAt(e.x,e.z)>.64&&player.y<1.27&&clearPath(player.x,player.z,e.x,e.z))
      .sort((a,b)=>Math.hypot(a.x-player.x,a.z-player.z)-Math.hypot(b.x-player.x,b.z-player.z))[0];
    if(!target) return;
    sound('hit');
    wound(target,1,.34);
  }
  function wound(target,damage,knockback) {
    target.hp=Math.max(0,target.hp-damage);
    target.state=target.hp?'hurt':'down'; target.timer=target.hp?.28:0;
    target.phase=0;
    const angle=Math.atan2(target.x-player.x,target.z-player.z);
    move(target,Math.sin(angle)*knockback,Math.cos(angle)*knockback,.23,target.y);
    if(target.captain&&!target.hp) {
      missionKey={x:target.x,z:target.z,taken:false};
      say('El capità ha deixat caure la clau.');
    }
  }
  function attack() {
    if(mode!=='play'||player.attack>0||player.swap>0||player.guard) return;
    if(player.weapon==='shotgun') {fireShotgun();return;}
    player.attack=.49; player.queued=true;
    sound('swing');
  }
  const recoilDuration=.62, reloadDuration=1.48;
  function equip(weapon) {
    const p=player;
    if(p.weapon===weapon||p.attack>0) return;
    p.weapon=weapon;p.swap=.3;p.reload=0;p.guard=false;p.aim=0;
    sound('rack');
  }
  function reloadShotgun() {
    const p=player;
    if(p.weapon!=='shotgun'||p.reload>0||p.gunTime>0||p.swap>0||p.loaded===2||!p.reserve) return;
    p.reload=reloadDuration;
    sound('rack');
  }
  function fireShotgun() {
    const p=player;
    if(p.reload||p.gunTime) return;
    if(!p.loaded) {
      sound('click');
      say(p.reserve?'Prem R per recarregar.':'T’has quedat sense cartutxos. Prem 1 per treure el sabre.');
      return;
    }
    p.loaded--;
    p.gunTime=recoilDuration;
    sound('report');
    const aimWidth=.115-p.aim*.045;
    const candidates=pirates.map(enemy=>{
      const dx=enemy.x-p.x,dz=enemy.z-p.z,range=Math.hypot(dx,dz);
      const bearing=Math.atan2(Math.sin(Math.atan2(dx,dz)-p.yaw),Math.cos(Math.atan2(dx,dz)-p.yaw));
      const vertical=(enemy.y+1.05-p.y-1.61)/Math.max(range,.2);
      return {enemy,range,bearing,vertical};
    }).filter(({enemy,range,vertical})=>enemy.hp>0&&range<12&&
      Math.abs(vertical-Math.tan(p.pitch))<aimWidth+.9/Math.max(range,.2)&&
      clearPath(p.x,p.z,enemy.x,enemy.z)).sort((a,b)=>a.range-b.range);
    const hits=new Map();
    for(const offset of [-1,-.68,-.34,0,.34,.68,1]) {
      const impact=candidates.find(({range,bearing})=>Math.abs(bearing-offset*aimWidth)<.47/Math.max(range,.2));
      if(impact) hits.set(impact,(hits.get(impact)||0)+1);
    }
    for(const [{enemy,range},count] of hits) {
      const damage=count>=4&&range<5?3:count>=3?2:1;
      wound(enemy,damage,.38+damage*.12);
    }
  }
  function actionTarget() {
    if(missionKey&&!missionKey.taken&&Math.hypot(player.x-missionKey.x,player.z-missionKey.z)<1.85) return 'key';
    if(Math.hypot(player.x-16.95,player.z-49)<2.2) return 'lighthouse';
    if(nearVillager()) return 'talk';
    return '';
  }
  function nearVillager() {
    return villagers.find(v=>Math.hypot(player.x-v.x,player.z-v.z)<2.2);
  }
  function interact() {
    const target=actionTarget();
    if(target==='key') {missionKey.taken=true;sound('key');say('Ara obre la porta del far.');}
    if(target==='talk') {
      const villager=nearVillager();
      villager.state='talk'; villager.phase=0;
      say(villager.name+' · '+villager.line);
    }
    if(target==='lighthouse') {
      if(!missionKey?.taken) say('La porta és tancada. El capità té la clau.');
      else {sound('bell');show('win');}
    }
  }
  function show(next) {
    mode=next; keys.clear(); rightButton=false;
    if(next!=='play'&&surfGain) surfGain.gain.setTargetAtTime(0,audio.currentTime,.12);
    $('veil').removeAttribute('data-cover');
    $('veil').hidden=next==='play'; $('hud').hidden=next!=='play';
    if(next==='play') return;
    if(document.pointerLockElement===canvas) document.exitPointerLock();
    $('heading').textContent={pause:'Partida en pausa',win:'El far torna a brillar',lose:'Has caigut en duel'}[next];
    $('intro').textContent={pause:'La nit t’espera.',win:'Amb el far encès, els vaixells tornen a trobar el camí de Mêlée.',lose:'Torna al moll i prova de blocar els cops quan el rival alci l’espasa.'}[next];
    $('play').textContent=next==='pause'?'Continua':'Torna a jugar';
  }
  $('play').disabled=false;
  $('play').addEventListener('click',()=>{
    if(mode!=='pause') reset();
    $('help').textContent='';
    show('play');
    const Audio=window.AudioContext||window.webkitAudioContext;
    if(Audio) {
      audio??=new Audio();
      audio.resume().catch(()=>{});
      startSurf();
    }
    try {canvas.requestPointerLock?.()?.catch(()=>say('Pots girar amb les fletxes esquerra i dreta.'));} catch {
      say('Pots girar amb les fletxes esquerra i dreta.');
    }
  });
  document.addEventListener('pointerlockchange',()=>{
    if(mode==='play'&&document.pointerLockElement!==canvas) show('pause');
  });
  document.addEventListener('pointerlockerror',()=>{
    if(mode==='play') say('Pots girar amb les fletxes esquerra i dreta.');
  });
  document.addEventListener('mousemove',e=>{
    if(mode!=='play'||document.pointerLockElement!==canvas) return;
    player.yaw+=e.movementX*.0026;
    player.pitch=Math.max(-.8,Math.min(.8,player.pitch-e.movementY*.0026));
  });
  canvas.addEventListener('mousedown',e=>{
    if(mode!=='play') return;
    if(e.button===2) {rightButton=true;player.guard=player.weapon==='sword'&&player.attack===0;}
    if(e.button===0) attack();
  });
  document.addEventListener('mouseup',e=>{if(e.button===2) rightButton=false;});
  canvas.addEventListener('contextmenu',e=>e.preventDefault());
  window.addEventListener('blur',()=>{if(mode==='play') show('pause');});
  document.addEventListener('keydown',e=>{
    if(mode!=='play') return;
    if(['Space','ArrowUp','ArrowDown','ArrowLeft','ArrowRight'].includes(e.code)) e.preventDefault();
    keys.add(e.code);
    if(e.repeat) return;
    if(e.code==='Escape') show('pause');
    if(e.code==='KeyQ') player.guard=player.weapon==='sword'&&player.attack===0;
    if(e.code==='Digit1') equip('sword');
    if(e.code==='Digit2') equip('shotgun');
    if(e.code==='KeyR') reloadShotgun();
    if(e.code==='KeyF') attack();
    if(e.code==='KeyE') interact();
    if(e.code==='Space'&&player.vy===0) {player.vy=5.4;sound('jump');}
  });
  document.addEventListener('keyup',e=>keys.delete(e.code));

  function updatePirate(enemy,dt) {
    enemy.phase+=dt;
    if(enemy.y>0||enemy.vy>0) {
      enemy.vy-=12*dt;
      enemy.y=Math.max(0,enemy.y+enemy.vy*dt);
      if(enemy.y===0) enemy.vy=0;
    }
    if(!enemy.hp) return;
    enemy.hop-=dt;
    const dx=player.x-enemy.x,dz=player.z-enemy.z, distance=Math.hypot(dx,dz);
    const visible=distance<9&&clearPath(enemy.x,enemy.z,player.x,player.z);
    enemy.timer=Math.max(0,enemy.timer-dt);
    const gunner=gunners.has(enemy.variant);
    if(enemy.state==='aim') {
      if(enemy.timer>0) return;
      enemy.state='shoot';enemy.phase=0;enemy.timer=.73;
      sound('distant');
      if(visible&&distance<8.5&&player.y<.86&&!player.running) {
        player.hp=Math.max(0,player.hp-9);
        player.damage=.38;sound('hurt');
        if(!player.hp) show('lose');
      }
      return;
    }
    if(enemy.state==='wind') {
      if(enemy.timer>0) return;
      enemy.state='slash'; enemy.timer=.42; enemy.phase=0;
      if(distance>2.06||!visible||player.y>.97) return;
      if(player.guard&&aimAt(enemy.x,enemy.z)>.23) {
        sound('parry'); enemy.state='hurt'; enemy.timer=.42;
        return;
      }
      player.hp=Math.max(0,player.hp-(enemy.captain?22:15));
      player.damage=.48; sound('hurt');
      if(!player.hp) show('lose');
      return;
    }
    if(enemy.timer>0) return;
    if(gunner&&visible&&distance<7.5) {
      enemy.state='aim';enemy.timer=.65;enemy.phase=0;
    } else if(visible&&distance<1.66) {
      enemy.state='wind'; enemy.timer=enemy.captain?.42:.57; enemy.phase=0;
    } else if(visible) {
      if(distance>3.3&&distance<6.3&&enemy.hop<0) {
        enemy.vy=3.7;enemy.hop=3.9;enemy.phase=0;
      }
      enemy.state=enemy.vy||enemy.y?'jump':distance>3.4?'run':'walk';
      const speed=enemy.state==='run'?3.25:enemy.captain?2.45:1.85;
      move(enemy,dx/distance*speed*dt,dz/distance*speed*dt,.24,enemy.y);
    } else enemy.state='idle';
  }
  function update(dt) {
    const p=player, down=(...codes)=>codes.some(code=>keys.has(code));
    p.yaw+=(Number(down('ArrowRight'))-Number(down('ArrowLeft')))*1.9*dt;
    const forward=Number(down('KeyW','ArrowUp'))-Number(down('KeyS','ArrowDown'));
    const side=Number(down('KeyD'))-Number(down('KeyA'));
    const guarding=rightButton||down('KeyQ');
    p.guard=p.weapon==='sword'&&guarding&&p.attack===0;
    const aimTarget=p.weapon==='shotgun'&&guarding&&!p.reload?1:0;
    p.aim+=(aimTarget-p.aim)*Math.min(1,dt*12);
    const running=down('ShiftLeft','ShiftRight')&&!p.guard&&p.aim<.25;
    p.running=Boolean(running&&(forward||side));
    p.moving+=(Number(Boolean(forward||side))-p.moving)*Math.min(1,dt*12);
    p.swap=Math.max(0,p.swap-dt);
    p.gunTime=Math.max(0,p.gunTime-dt);
    p.landing=Math.max(0,p.landing-dt);
    if(p.reload>0) {
      p.reload=Math.max(0,p.reload-dt);
      if(p.reload===0) {
        const shells=Math.min(2-p.loaded,p.reserve);
        p.loaded+=shells;p.reserve-=shells;sound('rack');
      }
    }
    const speed=(p.guard||p.aim>.25?2.1:running?6.3:3.7)*dt/(Math.hypot(forward,side)||1);
    move(p,(Math.sin(p.yaw)*forward+Math.cos(p.yaw)*side)*speed,
      (Math.cos(p.yaw)*forward-Math.sin(p.yaw)*side)*speed,.24,p.y);
    const floor=floorAt(p.x,p.z,.23,p.y);
    if(p.vy||p.y>floor) {
      p.vy-=14*dt;
      p.y+=p.vy*dt;
      if(p.y<=floor&&p.vy<=0) {p.y=floor;p.vy=0;p.landing=.24;}
    }
    if(forward||side) {
      p.phase+=dt*(running?15:10);
      p.step-=dt;
      if(p.step<=0&&!p.vy) {sound('step');p.step=running?.26:.39;}
    } else p.phase*=Math.max(0,1-dt*8);
    p.attack=Math.max(0,p.attack-dt);
    if(p.queued&&p.attack<.32) {p.queued=false;hit();}
    p.damage=Math.max(0,p.damage-dt);
    messageTime=Math.max(0,messageTime-dt);
    for(const enemy of pirates) {
      if(mode!=='play') break;
      updatePirate(enemy,dt);
    }
    const target=actionTarget();
    if(surfGain) surfGain.gain.value=.026+.088*Math.max(0,1-p.z/29);
    const district=p.z<13?'EL MOLL':p.z<37?'LA VILA':'LA PUJADA DEL FAR';
    $('place').firstChild.textContent=district;
    $('goal').textContent=missionKey?.taken?'Encén el far':missionKey?'Recull la clau del capità':'Troba el capità a la pujada del far';
    $('health').textContent='♥ '+p.hp;
    const weaponLabel=p.weapon==='sword'?'1 · Sabre':p.reload?'Recarregant…':'2 · Retallada  '+p.loaded+' / '+p.reserve;
    if($('weapon').textContent!==weaponLabel) $('weapon').textContent=weaponLabel;
    $('aim').textContent=p.weapon==='shotgun'?'⊹':'·';
    $('hint').textContent=messageTime>0?message:
      ({key:'E · Recull la clau',lighthouse:'E · Obre el far',talk:'E · Parla amb '+(nearVillager()?.name.toLowerCase()||'')}[target]||'');
    $('flash').style.opacity=mode==='play'?p.damage*1.4:0;
  }

  function sprite(mesh,actor) {
    const [offset,frames,fps,loop]=animations[actor.state];
    const tick=Math.floor(actor.phase*fps);
    const index=offset+(loop?tick%frames:Math.min(tick,frames-1));
    const u=(index%columns)/columns,v=Math.floor(index/columns)/rows;
    const width=actor.captain?1.56:1.36,height=actor.captain?2.53:2.16;
    const dx=Math.cos(player.yaw)*width/2,dz=-Math.sin(player.yaw)*width/2;
    const x=actor.x,z=actor.z,y=(actor.y||0)-height*.095;
    const w=1/columns,h=1/rows;
    quad(mesh,[x-dx,y+height,z-dz],[x+dx,y+height,z+dz],[x+dx,y,z+dz],[x-dx,y,z-dz],
      actor.state==='hurt'?[1,.71,.65]:[1,1,1],[[u,v],[u+w,v],[u+w,v+h],[u,v+h]]);
  }
  const actorMeshes=sprites.map(art=>mesh(new Float32Array(48),art,0,2,true));
  function spark(mesh,x,y,z,size,color) {
    const a=Math.cos(player.yaw)*size,b=-Math.sin(player.yaw)*size;
    quad(mesh,[x-a,y,z-b],[x,y+size,z],[x+a,y,z+b],[x,y-size,z],rgb(color));
  }
  function drawShotgun(w,h) {
    const p=player;
    const recoil=1-p.gunTime/recoilDuration;
    const kick=p.gunTime?Math.exp(-recoil*5.4)*Math.sin(Math.min(1,recoil*8)*Math.PI*.5):0;
    const load=1-p.reload/reloadDuration;
    const open=p.reload?Math.min(1,load*6,(1-load)*7):0;
    const bobX=Math.sin(p.phase)*(p.running?9:4)*p.moving;
    const bobY=Math.cos(p.phase*2)*(p.running?5:2)*p.moving;
    const settle=p.landing*32;
    const scale=h/350;
    overlay.save();
    overlay.translate(w*(.735-p.aim*.235)+(bobX-kick*5)*scale,
      h*(.98-p.aim*.07)+(bobY+p.swap*180+p.y*4+settle+open*22+kick*13)*scale);
    overlay.scale(scale,scale);
    overlay.rotate(.22-p.aim*.22-kick*.48+open*.3+Math.sin(p.phase)*.065*Number(p.running));
    const draw=(color,points)=>polygon(overlay,color,points);
    function fill(color,x,y,width,height) {
      overlay.fillStyle=color;overlay.fillRect(x,y,width,height);
    }
    draw('#181525',[[-38,75],[-49,43],[-36,22],[-19,16],[-18,-45],[7,-52],[24,-23],[35,36],[42,69]]);
    draw('#60383a',[[-13,-38],[6,-45],[20,-22],[29,45],[24,65],[-6,62],[-17,29]]);
    draw('#a96649',[[-10,-35],[6,-39],[14,-19],[22,44],[13,55],[-3,43],[-10,20]]);
    draw('#6e403e',[[-6,-24],[2,-14],[10,9],[15,33],[13,48],[9,29],[3,12],[-2,2]]);
    draw('#352637',[[-45,43],[-31,26],[-12,26],[-1,49],[-8,71],[-37,71]]);
    draw('#725067',[[-42,42],[-31,29],[-16,29],[-12,52],[-21,70],[-36,65]]);
    fill('#aa7869',-38,40,17,3);
    draw('#6d403f',[[-23,35],[-25,13],[-21,4],[-12,1],[0,8],[3,25],[-4,44]]);
    draw('#c78b68',[[-21,30],[-22,15],[-17,7],[-11,5],[-2,10],[0,23],[-6,36]]);
    fill('#f0ae78',-19,12,14,3);fill('#a56550',-18,22,17,3);
    draw('#211f31',[[-15,-45],[-14,-19],[4,-13],[20,-24],[17,-45]]);
    draw('#647386',[[-11,-44],[-11,-23],[3,-19],[16,-27],[15,-43]]);
    draw('#ac9e86',[[-11,-43],[14,-43],[13,-35],[-10,-34]]);
    fill('#f2c48a',-8,-39,17,2); fill('#312b36',7,-32,3,3);
    overlay.save();
    overlay.translate(0,-43);
    overlay.rotate(open*.92);
    draw('#161928',[[-18,7],[-21,-91],[-13,-110],[9,-110],[18,-96],[18,5],[10,13],[-9,13]]);
    draw('#4b5266',[[-15,5],[-17,-94],[-12,-105],[8,-105],[14,-94],[14,4],[9,9],[-8,9]]);
    draw('#a1a3a8',[[-14,-95],[-10,-103],[-5,-102],[-5,2],[-10,7],[-12,2]]);
    draw('#777f90',[[0,-102],[7,-103],[11,-94],[12,3],[6,7],[2,0]]);
    draw('#343247',[[-4,-101],[1,-102],[3,-93],[4,0],[-2,6],[-5,3]]);
    fill('#b8b2a7',-11,-96,2,57);fill('#9ca6ad',7,-95,2,60);
    fill('#1b1b2a',-13,-105,9,5);fill('#202030',1,-105,9,5);
    fill('#dab9a1',-12,-105,6,1);fill('#dab9a1',2,-105,6,1);
    draw('#563733',[[-13,-41],[14,-43],[13,-13],[7,-7],[-9,-10],[-14,-17]]);
    draw('#aa694c',[[-11,-39],[11,-40],[10,-18],[5,-13],[-8,-15],[-11,-20]]);
    for(let i=0;i<5;i++) fill(i%2?'#7d4b40':'#bc7856',-10,-36+i*4,20,1);
    if(p.gunTime>.48) {
      const flash=1-recoil*3;
      overlay.save();
      overlay.translate(-2,-105);overlay.scale(flash,flash);
      draw('#f3964a',[[-5,8],[-16,-2],[-47,-7],[-19,-11],[-33,-35],[-8,-19],[-2,-54],[7,-22],[36,-39],[16,-13],[43,-6],[17,0],[20,13]]);
      draw('#fff0a1',[[-5,4],[-26,-7],[-11,-10],[-14,-24],[-4,-15],[1,-35],[7,-14],[23,-22],[12,-8],[27,-5],[10,2]]);
      draw('#fff8d0',[[-4,3],[-11,-5],[-4,-8],[0,-19],[6,-8],[13,-4],[6,1]]);
      overlay.restore();
    }
    if(p.gunTime>0&&p.gunTime<.55) {
      overlay.globalAlpha=(1-recoil)*.35;
      for(let i=0;i<6;i++) {
        const drift=(recoil*58+i*5);
        draw(i%2?'#beafaa':'#8c829b',[[-6-i*3-drift*.3,-111-drift],[7+i*3,-112-drift],
          [13+i*2,-104-drift],[-3-drift*.5,-101-drift]]);
      }
      overlay.globalAlpha=1;
    }
    overlay.restore();
    if(open>.2) {
      draw('#27202c',[[-14,-48],[-14,-34],[13,-34],[15,-48]]);
      for(const x of [-10,3]) {
        fill('#a97963',x,-45,8,8);fill('#2b2330',x+1,-44,6,6);
      }
      if(load<.45) for(let i=0;i<2-p.loaded;i++) {
        const t=Math.max(0,(load-.15)*4);
        overlay.save();overlay.translate(-8+i*12+t*39,-41-t*68+t*t*80);overlay.rotate(t*6);
        fill('#7e3b45',-3,-9,6,15);fill('#dca468',-3,3,6,4);overlay.restore();
      }
      if(load>.36&&load<.86) {
        const insert=(load-.36)/.5;
        const x=42-insert*35,y=17-insert*57;
        draw('#473146',[[x+44,y+45],[x+8,y+27],[x-9,y+8],[x-7,y-3],[x+6,y-6],[x+27,y+6]]);
        draw('#cf8f6a',[[x+8,y+16],[x-8,y+5],[x-11,y-4],[x-4,y-11],[x+9,y-5],[x+17,y+7]]);
        for(let i=0;i<Math.min(2-p.loaded,p.reserve);i++) {
          fill('#a94e4a',x-11+i*7,y-16,5,14);fill('#e0ab6a',x-11+i*7,y-5,5,3);
        }
      }
    }
    overlay.restore();
  }
  function drawSword() {
    const w=blade.width,h=blade.height;
    overlay.clearRect(0,0,w,h);
    if(mode!=='play') return;
    if(player.weapon==='shotgun') {drawShotgun(w,h);return;}
    const p=player, t=p.attack?1-p.attack/.49:0;
    const swing=Math.sin(t*Math.PI)*Math.min(1,t*5);
    overlay.save();
    overlay.translate(w*(p.guard?.58:.79)-swing*w*.33+Math.sin(p.phase)*2,
      h*.97+Math.cos(p.phase*2)*2+swing*h*.02);
    overlay.scale(h/340,h/340);
    overlay.rotate(p.guard?-1.02:.36-swing*1.85);
    polygon(overlay,'#242037',[[-30,55],[-36,16],[-24,-18],[0,-26],[19,-12],[25,19],[32,59]]);
    polygon(overlay,'#654052',[[-29,45],[-31,17],[-21,-12],[-1,-20],[18,-7],[19,16],[26,52]]);
    polygon(overlay,'#ae715f',[[-23,15],[-20,-14],[1,-23],[15,-9],[12,11],[-4,20]]);
    polygon(overlay,'#e0a480',[[-20,-5],[-16,-14],[-1,-19],[12,-8],[6,-1],[-10,3]]);
    polygon(overlay,'#26253d',[[-16,-27],[-18,-124],[-2,-172],[12,-136],[15,-28]]);
    polygon(overlay,'#87a4ba',[[-12,-30],[-13,-122],[-1,-162],[8,-134],[10,-30]]);
    polygon(overlay,'#e5e9dc',[[-6,-31],[-9,-121],[-1,-159],[3,-134],[2,-34]]);
    polygon(overlay,'#4d3145',[[-29,-32],[-18,-38],[20,-37],[29,-29],[23,-22],[-24,-23]]);
    polygon(overlay,'#dfaa66',[[-26,-32],[-17,-35],[19,-34],[24,-29],[21,-26],[-23,-27]]);
    overlay.restore();
  }
  function drawSky() {
    if(!skyTexture) return;
    const mesh=[], radius=84, segments=32;
    for(let i=0;i<segments;i++){
      const a=i*Math.PI*2/segments,b=(i+1)*Math.PI*2/segments;
      const ax=player.x+Math.sin(a)*radius,az=player.z+Math.cos(a)*radius;
      const bx=player.x+Math.sin(b)*radius,bz=player.z+Math.cos(b)*radius;
      const u=(i%8)/8,v=(i%8+1)/8;
      quad(mesh,[ax,1000,az],[bx,1000,bz],[bx,-1000,bz],[ax,-1000,az],[.91,.89,1],[[u,0],[v,0],[v,1],[u,1]]);
    }
    skyMesh.material.uniforms.art.value=skyTexture;
    updateMesh(skyMesh,mesh);
  }
  function render() {
    const width=Math.max(1,Math.min(920,Math.ceil(canvas.clientWidth*.73)));
    const height=Math.max(1,Math.round(width*canvas.clientHeight/Math.max(1,canvas.clientWidth)));
    if(canvas.width!==width||canvas.height!==height) {
      renderer.setSize(width,height,false);
      blade.width=width;blade.height=height;
    }
    const p=player;
    viewUniforms.eye.value.set(p.x,1.61+p.y+Math.sin(p.phase*2)*.025,p.z);
    viewUniforms.turn.value.set(Math.cos(p.yaw),Math.sin(p.yaw));
    viewUniforms.tilt.value.set(Math.cos(p.pitch),Math.sin(p.pitch));
    viewUniforms.aspect.value=Math.max(.1,width/height);
    viewUniforms.shotLight.value.set(p.x,p.z,p.gunTime>.49?(p.gunTime-.49)*5:0);
    drawSky();
    const actors=[],lights=[];
    for(const actor of [...pirates,...villagers]) {
      actors.length=0;
      sprite(actors,actor);
      updateMesh(actorMeshes[actor.variant],actors);
    }
    if(missionKey&&!missionKey.taken) {
      const y=.54+Math.sin(elapsed*4)*.13;
      spark(lights,missionKey.x,y,missionKey.z,.22,0xffda83);
      spark(lights,missionKey.x+.1,y-.17,missionKey.z,.09,0xffa957);
    }
    if(mode==='win') {
      spark(lights,17,7.12,49.47,.58,0xffda88);
      spark(lights,17,7.13,49.41,.23,0xfff0b0);
    }
    updateMesh(effectsMesh,lights);
    renderer.render(scene,camera);
    drawSword();
  }
  function frame(now) {
    const dt=Math.min(.035,(now-(previous||now))/1000);
    previous=now;elapsed+=dt;
    if(mode==='play') update(dt);
    for(const actor of villagers) {
      actor.phase+=dt;
      if(actor.state==='talk') {
        if(actor.phase>2.3) actor.state='idle';
      } else if(mode==='play') {
        const cycle=(elapsed*.36+actor.variant*.63)%5;
        const destination=actor.homeX+Math.sin(cycle*Math.PI/2)*.95;
        if(cycle<4&&Math.abs(destination-actor.x)>.06) {
          actor.state='walk';
          move(actor,Math.sign(destination-actor.x)*dt*.7,0,.2,0);
        } else actor.state='idle';
      }
    }
    render();
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
}
