'use strict';
const $ = id => document.getElementById(id);
const canvas = $('view');
const gl = canvas.getContext('webgl', {alpha:false, antialias:false});
if (!gl) {
  $('help').textContent = 'Cal un navegador amb WebGL activat.';
  $('play').disabled = true;
} else {
  startGame();
}

function startGame() {
  const vertex = `
    attribute vec3 position, tint;
    attribute vec2 uv;
    uniform vec3 eye;
    uniform vec2 turn, tilt;
    uniform float aspect;
    varying vec3 color;
    varying vec2 tex;
    varying float distanceToEye;
    void main(){
      vec3 d = position-eye;
      float x = d.x*turn.x-d.z*turn.y;
      float z = d.x*turn.y+d.z*turn.x;
      float y = d.y*tilt.x-z*tilt.y;
      z = z*tilt.x+d.y*tilt.y;
      gl_Position = vec4(x*1.34/aspect,y*1.34,z*1.001-.14,z);
      color=tint; tex=uv; distanceToEye=z;
    }`;
  const fragment = `
    precision mediump float;
    uniform sampler2D art;
    varying vec3 color;
    varying vec2 tex;
    varying float distanceToEye;
    void main(){
      vec4 pixel=texture2D(art,tex);
      if(pixel.a<.45)discard;
      float fog=smoothstep(12.,58.,distanceToEye)*(1.-step(59.,distanceToEye));
      gl_FragColor=vec4(mix(color*pixel.rgb,vec3(.22,.24,.37),fog),1.);
    }`;
  function shader(type, source) {
    const s = gl.createShader(type);
    gl.shaderSource(s, source);
    gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw Error(gl.getShaderInfoLog(s));
    return s;
  }
  const program = gl.createProgram();
  gl.attachShader(program, shader(gl.VERTEX_SHADER, vertex));
  gl.attachShader(program, shader(gl.FRAGMENT_SHADER, fragment));
  gl.linkProgram(program);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) throw Error(gl.getProgramInfoLog(program));
  gl.useProgram(program);
  const uniforms = Object.fromEntries(['eye','turn','tilt','aspect'].map(name => [name, gl.getUniformLocation(program,name)]));
  const worldBuffer = gl.createBuffer(), liveBuffer = gl.createBuffer();
  function bind(buffer) {
    gl.bindBuffer(gl.ARRAY_BUFFER,buffer);
    for (const [name,size,offset] of [['position',3,0],['tint',3,12],['uv',2,24]]) {
      const index = gl.getAttribLocation(program,name);
      gl.enableVertexAttribArray(index);
      gl.vertexAttribPointer(index,size,gl.FLOAT,false,32,offset);
    }
  }
  function texture(source) {
    const t=gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D,t);
    gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,gl.RGBA,gl.UNSIGNED_BYTE,source);
    gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);
    return t;
  }
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
  for(const [x,z] of [[11,12],[21,15],[10,22],[22,22],[9,34],[23,35],[11,44],[22,44],[16,49]]) lamp(x,z);
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
  const worldVertexCount=world.length/8;
  bind(worldBuffer);
  gl.bufferData(gl.ARRAY_BUFFER,new Float32Array(world),gl.STATIC_DRAW);
  world.length=0;

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
  const spriteSize=64;
  const states={idle:0,walk:4,wind:10,slash:14,hurt:18,down:21,talk:24};
  const columns=15, framesPerActor=28;
  const rows=Math.ceil(palettes.length*framesPerActor/columns);
  const atlas=makeCanvas(columns*spriteSize,rows*spriteSize);
  const ink=atlas.getContext('2d');
  function polygon(ctx,color,points) {
    ctx.fillStyle=color;
    ctx.beginPath();
    for(const [i,[x,y]] of points.entries()) i?ctx.lineTo(x,y):ctx.moveTo(x,y);
    ctx.closePath(); ctx.fill();
  }
  function pirate(colors,frame,variant) {
    const [coat,trim,skin,light,pants,metal]=colors;
    const outline='#232036', linen='#e2c3a5', leather='#3e2a42';
    const bob=frame<4?frame%2:frame<10?Math.round(Math.sin(frame*2)*1.7):0;
    ink.translate(32,58);
    ink.scale([.94,1.08,.83,1.1,1.16,.86,1,.98,1.12,.83,1.14,.88,1,.91,.92][variant],
      [1,.94,1.04,.98,1.02,.86,1.07,1.05,.92,.95,1,.99,1.03,.86,.9][variant]);
    ink.translate(-32,-58);
    const stride=frame>=4&&frame<10?Math.round(Math.sin((frame-4)*Math.PI/3)*5):0;
    const lunge=frame>=14&&frame<18?Math.max(0,7-Math.abs(15-frame)*3):0;
    const recoil=frame>=18&&frame<21?22-frame:0;
    const fall=frame>=21&&frame<24?Math.min(1,(frame-20)/3):0;
    ink.translate(32,58);
    ink.rotate(-fall*1.47);
    ink.translate(-32,-58);
    const rect=(x,y,w,h,c)=>{ink.fillStyle=c;ink.fillRect(x,y,w,h);};
    function shape(color,points) {polygon(ink,color,points);}
    for(const [x,y] of [[24,0],[35,stride]]) {
      rect(x-1,40,9,16+y,outline);
      rect(x,41,7,12+y,pants);
      rect(x-2,52+y,10,5,outline);
      rect(x-1,52+y,8,3,leather);
      rect(x,46+y,6,2,trim);
    }
    ink.translate(recoil-lunge*.45,bob);
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
    const armed=[0,1,2,4,6,7,10,11].includes(variant);
    const wind=frame>=10&&frame<14?(frame-9)*2:0;
    const gesture=frame>=24?[0,3,7,4][frame-24]:0;
    if(gesture>0) rect(32,21,3,2,outline);
    const armX=19-lunge*1.7-gesture*.55, armY=34-wind-lunge-gesture;
    shape(outline,[[23,24],[26,29],[armX+3,armY+4],[armX-3,armY+3],[armX-3,armY-2]]);
    rect(Math.round(armX)-2,armY,5,4,skin);
    shape(trim,[[41,25],[44,26],[46,35],[45,39],[41,38],[40,29]]);
    if(armed){
      const x=Math.round(armX), y=Math.round(armY);
      const tip=[x-5-lunge*1.5,y-18+wind*1.6+lunge*1.4];
      shape(outline,[[x+2,y+4],[x-3,y+2],[tip[0]-2,tip[1]],[tip[0]+1,tip[1]-3],[x+1,y-3]]);
      shape('#bad0db',[[x-2,y-1],[tip[0],tip[1]-2],[tip[0]+2,tip[1]+2],[x+1,y-2]]);
      rect(x-4,y-2,8,2,metal);
    }
  }
  for(let variant=0;variant<palettes.length;variant++) for(let frame=0;frame<framesPerActor;frame++) {
    const index=variant*framesPerActor+frame;
    ink.save();
    ink.translate(index%columns*spriteSize,Math.floor(index/columns)*spriteSize);
    pirate(palettes[variant],frame,variant);
    ink.restore();
  }
  const sprites=texture(atlas);

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
  let audio, rightButton=false;
  function reset() {
    player={x:16.5,z:7.3,y:0,vy:0,yaw:0,pitch:.018,hp:100,attack:0,queued:false,
      guard:false,phase:0,step:0,damage:0};
    pirates=starts.map(([x,z,variant,captain])=>({x,z,variant,captain,hp:captain?5:3,
      state:'idle',timer:0,phase:0}));
    for(const actor of villagers) {
      actor.x=actor.homeX; actor.z=actor.homeZ; actor.state='idle'; actor.phase=actor.variant*.28;
    }
    missionKey=null;
    message=''; messageTime=0;
  }
  reset();
  function sound(kind) {
    if(!audio || audio.state!=='running') return;
    const [frequency,end,duration,type]={
      swing:[280,58,.17,'triangle'],hit:[175,42,.14,'square'],parry:[1360,290,.22,'triangle'],
      hurt:[106,46,.26,'triangle'],jump:[126,238,.11,'triangle'],step:[78,38,.07,'triangle'],
      key:[510,995,.3,'sine'],bell:[430,640,.85,'sine']
    }[kind];
    const now=audio.currentTime, osc=audio.createOscillator(), gain=audio.createGain();
    osc.type=type; osc.frequency.setValueAtTime(frequency,now);
    osc.frequency.exponentialRampToValueAtTime(end,now+duration);
    gain.gain.setValueAtTime(kind==='step'?.025:.10,now);
    gain.gain.exponentialRampToValueAtTime(.001,now+duration);
    osc.connect(gain); gain.connect(audio.destination);
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
    target.hp--;
    target.state=target.hp?'hurt':'down'; target.timer=target.hp?.28:0;
    target.phase=0;
    const angle=Math.atan2(target.x-player.x,target.z-player.z);
    move(target,Math.sin(angle)*.34,Math.cos(angle)*.34,.23,0);
    if(target.captain&&!target.hp) {
      missionKey={x:target.x,z:target.z,taken:false};
      say('El capità ha deixat caure la clau.');
    }
  }
  function attack() {
    if(mode!=='play'||player.attack>0||player.guard) return;
    player.attack=.49; player.queued=true;
    sound('swing');
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
    $('veil').removeAttribute('data-cover');
    $('veil').hidden=next==='play'; $('hud').hidden=next!=='play';
    if(next==='play') return;
    if(document.pointerLockElement===canvas) document.exitPointerLock();
    $('heading').textContent={pause:'Partida en pausa',win:'El far torna a brillar',lose:'Has caigut en duel'}[next];
    $('intro').textContent={pause:'La nit t’espera.',win:'Amb el far encès, els vaixells tornen a trobar el camí de Mêlée.',lose:'Torna al moll i prova de blocar els cops quan el rival alci l’espasa.'}[next];
    $('play').textContent=next==='pause'?'Continua':'Torna a jugar';
  }
  $('play').addEventListener('click',()=>{
    if(mode!=='pause') reset();
    $('help').textContent='';
    show('play');
    const Audio=window.AudioContext||window.webkitAudioContext;
    if(Audio) {
      audio??=new Audio();
      audio.resume().catch(()=>{});
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
    if(e.button===2) {rightButton=true;player.guard=player.attack===0;}
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
    if(e.code==='KeyQ') player.guard=player.attack===0;
    if(e.code==='KeyF') attack();
    if(e.code==='KeyE') interact();
    if(e.code==='Space'&&player.vy===0) {player.vy=5.4;sound('jump');}
  });
  document.addEventListener('keyup',e=>keys.delete(e.code));

  function updatePirate(enemy,dt) {
    enemy.phase+=dt;
    if(!enemy.hp) return;
    const dx=player.x-enemy.x,dz=player.z-enemy.z, distance=Math.hypot(dx,dz);
    const visible=distance<9&&clearPath(enemy.x,enemy.z,player.x,player.z);
    enemy.timer=Math.max(0,enemy.timer-dt);
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
    if(visible&&distance<1.66) {
      enemy.state='wind'; enemy.timer=enemy.captain?.42:.57; enemy.phase=0;
    } else if(visible) {
      enemy.state='walk';
      const speed=enemy.captain?2.45:1.8;
      move(enemy,dx/distance*speed*dt,dz/distance*speed*dt,.24,0);
    } else enemy.state='idle';
  }
  function update(dt) {
    const p=player, down=(...codes)=>codes.some(code=>keys.has(code));
    p.yaw+=(Number(down('ArrowRight'))-Number(down('ArrowLeft')))*1.9*dt;
    const forward=Number(down('KeyW','ArrowUp'))-Number(down('KeyS','ArrowDown'));
    const side=Number(down('KeyD'))-Number(down('KeyA'));
    const running=down('ShiftLeft','ShiftRight');
    p.guard=(rightButton||down('KeyQ'))&&p.attack===0;
    const speed=(p.guard?2.1:running?6.3:3.7)*dt/(Math.hypot(forward,side)||1);
    move(p,(Math.sin(p.yaw)*forward+Math.cos(p.yaw)*side)*speed,
      (Math.cos(p.yaw)*forward-Math.sin(p.yaw)*side)*speed,.24,p.y);
    const floor=floorAt(p.x,p.z,.23,p.y);
    if(p.vy||p.y>floor) {
      p.vy-=14*dt;
      p.y+=p.vy*dt;
      if(p.y<=floor&&p.vy<=0) {p.y=floor;p.vy=0;}
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
    const district=p.z<13?'EL MOLL':p.z<37?'LA VILA':'LA PUJADA DEL FAR';
    $('place').firstChild.textContent=district;
    $('goal').textContent=missionKey?.taken?'Encén el far':missionKey?'Recull la clau del capità':'Troba el capità a la pujada del far';
    $('health').textContent='♥ '+p.hp;
    $('hint').textContent=messageTime>0?message:
      ({key:'E · Recull la clau',lighthouse:'E · Obre el far',talk:'E · Parla amb '+(nearVillager()?.name.toLowerCase()||'')}[target]||'');
    $('flash').style.opacity=mode==='play'?p.damage*1.4:0;
  }

  function sprite(mesh,actor) {
    const durations={idle:[4,4],talk:[4,10],walk:[6,12],wind:[4,9],slash:[4,15],hurt:[3,13],down:[3,10]};
    const [frames,fps]=durations[actor.state];
    const tick=Math.floor(actor.phase*fps);
    const index=actor.variant*framesPerActor+states[actor.state]+
      (actor.state==='idle'||actor.state==='walk'||actor.state==='talk'?tick%frames:Math.min(tick,frames-1));
    const u=(index%columns)/columns,v=Math.floor(index/columns)/rows;
    const width=actor.captain?1.56:1.36,height=actor.captain?2.53:2.16;
    const dx=Math.cos(player.yaw)*width/2,dz=-Math.sin(player.yaw)*width/2;
    const x=actor.x,z=actor.z,y=-height*.095;
    const w=1/columns,h=1/rows;
    quad(mesh,[x-dx,y+height,z-dz],[x+dx,y+height,z+dz],[x+dx,y,z+dz],[x-dx,y,z-dz],
      actor.state==='hurt'?[1,.71,.65]:[1,1,1],[[u,v],[u+w,v],[u+w,v+h],[u,v+h]]);
  }
  function drawLive(mesh,art) {
    if(!mesh.length) return;
    bind(liveBuffer);
    gl.bufferData(gl.ARRAY_BUFFER,new Float32Array(mesh),gl.DYNAMIC_DRAW);
    gl.bindTexture(gl.TEXTURE_2D,art);
    gl.drawArrays(gl.TRIANGLES,0,mesh.length/8);
  }
  function spark(mesh,x,y,z,size,color) {
    const a=Math.cos(player.yaw)*size,b=-Math.sin(player.yaw)*size;
    quad(mesh,[x-a,y,z-b],[x,y+size,z],[x+a,y,z+b],[x,y-size,z],rgb(color));
  }
  function drawSword() {
    const w=blade.width,h=blade.height;
    overlay.clearRect(0,0,w,h);
    if(mode!=='play') return;
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
  function render() {
    const width=Math.max(1,Math.min(920,Math.ceil(canvas.clientWidth*.73)));
    const height=Math.max(1,Math.round(width*canvas.clientHeight/Math.max(1,canvas.clientWidth)));
    if(canvas.width!==width||canvas.height!==height) {
      canvas.width=blade.width=width;
      canvas.height=blade.height=height;
      gl.viewport(0,0,width,height);
    }
    const p=player;
    gl.clearColor(.078,.091,.17,1);
    gl.clear(gl.COLOR_BUFFER_BIT|gl.DEPTH_BUFFER_BIT);
    gl.enable(gl.DEPTH_TEST);
    gl.uniform3f(uniforms.eye,p.x,1.61+p.y+Math.sin(p.phase*2)*.025,p.z);
    gl.uniform2f(uniforms.turn,Math.cos(p.yaw),Math.sin(p.yaw));
    gl.uniform2f(uniforms.tilt,Math.cos(p.pitch),Math.sin(p.pitch));
    gl.uniform1f(uniforms.aspect,Math.max(.1,width/Math.max(1,height)));
    gl.bindTexture(gl.TEXTURE_2D,white);
    bind(worldBuffer);
    gl.drawArrays(gl.TRIANGLES,0,worldVertexCount);
    const actors=[],lights=[];
    for(const actor of [...pirates,...villagers]) sprite(actors,actor);
    drawLive(actors,sprites);
    if(missionKey&&!missionKey.taken) {
      const y=.54+Math.sin(elapsed*4)*.13;
      spark(lights,missionKey.x,y,missionKey.z,.22,0xffda83);
      spark(lights,missionKey.x+.1,y-.17,missionKey.z,.09,0xffa957);
    }
    if(mode==='win') {
      spark(lights,17,7.12,49.47,.58,0xffda88);
      spark(lights,17,7.13,49.41,.23,0xfff0b0);
    }
    drawLive(lights,white);
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
