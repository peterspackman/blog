"use strict";(self.webpackChunkblog=self.webpackChunkblog||[]).push([[6571],{4897:(e,n,a)=>{a.r(n),a.d(n,{default:()=>m});var t=a(6540),i=a(1410),l=a(9437),o=a(4922);var r=a(8869),s=a(6437),c=a(9651),u=a(4848);const d=()=>{const[e,n]=(0,t.useState)([{nx:1,ny:1}]),[a,i]=(0,t.useState)(!0),[d,h]=(0,t.useState)(1),[m,v]=(0,t.useState)("probability"),[p,x]=(0,t.useState)("blue-white-orange"),[f,g]=(0,t.useState)(!1),[b,y]=(0,t.useState)(!0),[A,j]=(0,t.useState)(0),S=(0,t.useRef)(null),C=(0,t.useRef)(null),w=(0,t.useRef)(null),N=(0,t.useRef)(0),_=(0,t.useRef)(null),T=(0,t.useRef)(null),L=(0,t.useRef)(null),M=(0,t.useRef)(null),P=(e,n)=>e*e+n*n,k=(e,n)=>{const a=P(e,n),t=Math.min(a/50,1);if(t<.5){const e=2*t;return`rgb(${Math.round(77+178*e)}, ${Math.round(128+127*e)}, 255)`}{const e=2*(t-.5);return`rgb(255, ${Math.round(255-153*e)}, ${Math.round(255-204*e)})`}};return(0,t.useEffect)((()=>{if(!S.current)return;const n=new l.JeP({canvas:S.current,antialias:!0});T.current=n;const a=new o.Z58;L.current=a;const t=new o.BKk({vertexShader:"\n  varying vec2 vUv;\n\n  void main() {\n    vUv = position.xy * 0.5 + 0.5; // Convert from [-1,1] to [0,1]\n    gl_Position = vec4(position, 1.0);\n  }\n",fragmentShader:"\n  uniform float uTime;\n  uniform int uActiveStatesCount;\n  uniform vec2 uActiveStates[10]; // Array of nx, ny pairs (max 10 states)\n  uniform int uDisplayMode; // 0: probability, 1: real, 2: imaginary\n  uniform int uColorMapType; // 0: blue-white-orange, 1: blue-white-red, 2: rainbow\n  uniform bool uShowGridLines;\n  \n  varying vec2 vUv;\n  \n  // Calculate wave function at a point\n  vec3 calcWaveFunction(vec2 position, float nx, float ny, float t) {\n    // Spatial part: (2/L) * sin(nx\u03c0x/L) * sin(ny\u03c0y/L)\n    // Using normalized units where L = 1\n    float psiSpace = 2.0 * sin(nx * 3.14159265 * position.x) * sin(ny * 3.14159265 * position.y);\n    \n    // Energy: (\u03c0\xb2\u210f\xb2)/(2mL\xb2) * (nx\xb2 + ny\xb2)\n    // Using normalized units where (\u03c0\xb2\u210f\xb2)/(2mL\xb2) = 1\n    float energy = nx * nx + ny * ny;\n    \n    // Time evolution: exp(-iEt/\u210f)\n    float phase = -energy * t;\n    \n    return vec3(\n      psiSpace * cos(phase),  // Real part\n      psiSpace * sin(phase),  // Imaginary part\n      psiSpace * psiSpace     // Probability density\n    );\n  }\n  \n  // Calculate superposition of states\n  vec3 calcSuperposition(vec2 position, float t) {\n    float realSum = 0.0;\n    float imagSum = 0.0;\n    \n    // Normalization factor\n    float norm = 1.0 / sqrt(float(uActiveStatesCount));\n    \n    for(int i = 0; i < 10; i++) {\n      if(i >= uActiveStatesCount) break;\n      \n      vec2 state = uActiveStates[i];\n      vec3 waveFunc = calcWaveFunction(position, state.x, state.y, t);\n      \n      realSum += waveFunc.x * norm;\n      imagSum += waveFunc.y * norm;\n    }\n    \n    return vec3(\n      realSum,\n      imagSum,\n      realSum * realSum + imagSum * imagSum  // Probability = |\u03c8|\xb2\n    );\n  }\n  \n  // Get color from the selected color map\n  vec3 getColor(float value) {\n    // Blue-white-orange\n    if(uColorMapType == 0) {\n      if(value < 0.25) {\n        return mix(vec3(0.0, 0.2, 0.6), vec3(0.4, 0.6, 1.0), value * 4.0);\n      } else if(value < 0.5) {\n        return mix(vec3(0.4, 0.6, 1.0), vec3(1.0, 1.0, 1.0), (value - 0.25) * 4.0);\n      } else if(value < 0.75) {\n        return mix(vec3(1.0, 1.0, 1.0), vec3(1.0, 0.7, 0.4), (value - 0.5) * 4.0);\n      } else {\n        return mix(vec3(1.0, 0.7, 0.4), vec3(0.7, 0.2, 0.0), (value - 0.75) * 4.0);\n      }\n    } \n    // Blue-white-red\n    else if(uColorMapType == 1) {\n      if(value < 0.25) {\n        return mix(vec3(0.0, 0.0, 0.7), vec3(0.4, 0.5, 1.0), value * 4.0);\n      } else if(value < 0.5) {\n        return mix(vec3(0.4, 0.5, 1.0), vec3(1.0, 1.0, 1.0), (value - 0.25) * 4.0);\n      } else if(value < 0.75) {\n        return mix(vec3(1.0, 1.0, 1.0), vec3(1.0, 0.4, 0.4), (value - 0.5) * 4.0);\n      } else {\n        return mix(vec3(1.0, 0.4, 0.4), vec3(0.6, 0.0, 0.0), (value - 0.75) * 4.0);\n      }\n    }\n    // Rainbow\n    else {\n      if(value < 0.125) {\n        return mix(vec3(0.3, 0.0, 0.5), vec3(0.0, 0.0, 1.0), value * 8.0);\n      } else if(value < 0.25) {\n        return mix(vec3(0.0, 0.0, 1.0), vec3(0.0, 0.7, 1.0), (value - 0.125) * 8.0);\n      } else if(value < 0.375) {\n        return mix(vec3(0.0, 0.7, 1.0), vec3(0.0, 0.8, 0.5), (value - 0.25) * 8.0);\n      } else if(value < 0.5) {\n        return mix(vec3(0.0, 0.8, 0.5), vec3(0.0, 0.9, 0.0), (value - 0.375) * 8.0);\n      } else if(value < 0.625) {\n        return mix(vec3(0.0, 0.9, 0.0), vec3(0.7, 0.9, 0.0), (value - 0.5) * 8.0);\n      } else if(value < 0.75) {\n        return mix(vec3(0.7, 0.9, 0.0), vec3(1.0, 0.7, 0.0), (value - 0.625) * 8.0);\n      } else if(value < 0.875) {\n        return mix(vec3(1.0, 0.7, 0.0), vec3(1.0, 0.5, 0.0), (value - 0.75) * 8.0);\n      } else {\n        return mix(vec3(1.0, 0.5, 0.0), vec3(1.0, 0.0, 0.0), (value - 0.875) * 8.0);\n      }\n    }\n  }\n  \n  // Draw grid lines\n  float drawGrid(vec2 position) {\n    float lineWidth = 0.005;\n    float gridSize = 0.1; // 10x10 grid\n    \n    // Check if the position is close to a grid line\n    vec2 gridPos = mod(position, gridSize);\n    float distToGridX = min(gridPos.x, gridSize - gridPos.x);\n    float distToGridY = min(gridPos.y, gridSize - gridPos.y);\n    \n    // Draw the grid line if close enough\n    if (distToGridX < lineWidth || distToGridY < lineWidth) {\n      return 1.0;\n    }\n    \n    return 0.0;\n  }\n  \n  void main() {\n    // Calculate the wave function\n    vec3 wave = calcSuperposition(vUv, uTime);\n    \n    // Determine color based on display mode\n    vec3 color;\n    if(uDisplayMode == 0) {\n      // Probability Density\n      color = getColor(wave.z);\n    } else if(uDisplayMode == 1) {\n      // Real Part\n      color = getColor(wave.x * 0.5 + 0.5); // Map [-1, 1] to [0, 1]\n    } else if(uDisplayMode == 2) {\n      // Imaginary Part\n      color = getColor(wave.y * 0.5 + 0.5); // Map [-1, 1] to [0, 1]\n    }\n    \n    // Apply grid lines if enabled\n    if(uShowGridLines) {\n      float grid = drawGrid(vUv);\n      color = mix(color, vec3(1.0, 1.0, 1.0), grid * 0.3);\n    }\n    \n    // Output final color\n    gl_FragColor = vec4(color, 1.0);\n  }\n",uniforms:{uTime:{value:0},uActiveStatesCount:{value:e.length},uActiveStates:{value:new Float32Array(20)},uDisplayMode:{value:0},uColorMapType:{value:0},uShowGridLines:{value:!1}}});M.current=t;const i=new o.bdM(2,2),r=new o.eaF(i,t);return a.add(r),()=>{a.remove(r),i.dispose(),t.dispose(),n.dispose()}}),[]),(0,t.useEffect)((()=>{if(!M.current)return;let n=0;"real"===m&&(n=1),"imaginary"===m&&(n=2);let a=0;"blue-white-red"===p&&(a=1),"rainbow"===p&&(a=2);const t=new Float32Array(20);e.forEach(((e,n)=>{n<10&&(t[2*n]=e.nx,t[2*n+1]=e.ny)})),M.current.uniforms.uActiveStatesCount.value=e.length,M.current.uniforms.uActiveStates.value=t,M.current.uniforms.uDisplayMode.value=n,M.current.uniforms.uColorMapType.value=a,M.current.uniforms.uShowGridLines.value=f}),[e,m,p,f]),(0,t.useEffect)((()=>{if(!w.current)return;const e=w.current,n=e.getContext("2d"),a=e.width,t=e.height,i={"blue-white-orange":[[0,50,150],[30,100,200],[100,160,255],[200,220,255],[255,255,255],[255,220,180],[255,170,100],[230,120,30],[180,60,0]],"blue-white-red":[[0,0,180],[50,70,220],[100,120,255],[170,190,255],[255,255,255],[255,170,170],[255,110,110],[220,50,50],[160,0,0]],rainbow:[[80,0,140],[0,0,255],[0,180,255],[0,210,140],[0,220,0],[180,220,0],[255,180,0],[255,120,0],[255,0,0]]},l=e=>{const n=i[p],a=e*(n.length-1),t=Math.floor(a),l=a-t;if(t>=n.length-1){const[e,a,t]=n[n.length-1];return`rgb(${e}, ${a}, ${t})`}const[o,r,s]=n[t],[c,u,d]=n[t+1];return`rgb(${Math.round(o+l*(c-o))}, ${Math.round(r+l*(u-r))}, ${Math.round(s+l*(d-s))})`};n.clearRect(0,0,a,t);for(let o=0;o<a;o++){const e=o/a;n.fillStyle=l(e),n.fillRect(o,0,1,t)}n.strokeStyle="#666",n.lineWidth=1,n.strokeRect(0,0,a,t),"real"!==m&&"imaginary"!==m||(n.strokeStyle="#fff",n.beginPath(),n.moveTo(a/2,0),n.lineTo(a/2,t),n.stroke())}),[p,m]),(0,t.useEffect)((()=>{if(!C.current)return;const n=C.current,a=n.getContext("2d"),t=n.width,i=n.height,l=t/5,o=.35*l;a.fillStyle="#ffffff",a.fillRect(0,0,t,i),a.strokeStyle="#444",a.lineWidth=1;for(let e=0;e<=5;e++){const n=e*l;a.beginPath(),a.moveTo(n,0),a.lineTo(n,i),a.stroke(),a.beginPath(),a.moveTo(0,n),a.lineTo(t,n),a.stroke()}a.fillStyle="#000",a.font="14px Arial",a.textAlign="center",a.textBaseline="middle";for(let e=1;e<=5;e++){const n=(e-.9)*l;a.fillText(`${e}`,n,15)}a.textAlign="right";for(let e=2;e<=5;e++){const n=(e-.75)*l;a.fillText(`${e}`,15,n)}for(let r=1;r<=5;r++)for(let n=1;n<=5;n++){const t=(r-.5)*l,i=(n-.5)*l,s=e.some((e=>e.nx===r&&e.ny===n)),c=k(r,n);a.beginPath(),a.arc(t,i,o,0,2*Math.PI),a.strokeStyle=s?c:"#ddd",a.lineWidth=s?4:3,a.fillStyle=s?c+"30":"#fff",a.fill(),a.stroke();const u=P(r,n);if(a.fillStyle=s?c:"#000",a.font=s?"bold 12px Arial":"12px Arial",a.textAlign="center",a.textBaseline="middle",a.fillText(`E=${u}`,t,i+.5*o),s&&b){const e=-u*N.current,n=t+o*Math.cos(e),l=i-o*Math.sin(e);a.beginPath(),a.moveTo(t,i),a.lineTo(n,l),a.strokeStyle=c,a.lineWidth=2,a.stroke();const r=.25*o,s=Math.atan2(l-i,n-t);a.beginPath(),a.moveTo(n,l),a.lineTo(n-r*Math.cos(s-Math.PI/6),l-r*Math.sin(s-Math.PI/6)),a.lineTo(n-r*Math.cos(s+Math.PI/6),l-r*Math.sin(s+Math.PI/6)),a.closePath(),a.fillStyle=c,a.fill()}}}),[e,b,N.current]),(0,t.useEffect)((()=>{if(!C.current)return;const a=C.current,t=t=>{const i=a.getBoundingClientRect(),l=a.width/i.width,o=a.height/i.height,r=(t.clientX-i.left)*l,s=(t.clientY-i.top)*o,c=a.width/5,u=Math.ceil(r/c),d=Math.ceil(s/c);u>=1&&u<=5&&d>=1&&d<=5&&((a,t)=>{const i=e.findIndex((e=>e.nx===a&&e.ny===t));i>=0?e.length>1&&n(e.filter(((e,n)=>n!==i))):e.length<10&&n([...e,{nx:a,ny:t}])})(u,d)};return a.addEventListener("click",t),()=>a.removeEventListener("click",t)}),[e]),(0,t.useEffect)((()=>{const e=()=>{a&&(N.current+=.005*d,j(N.current.toFixed(1)),M.current&&(M.current.uniforms.uTime.value=N.current),T.current&&L.current&&T.current.render(L.current,new o.i7d)),_.current=requestAnimationFrame(e)};return e(),()=>{_.current&&cancelAnimationFrame(_.current)}}),[a,d]),(0,u.jsxs)("div",{className:c.A.container,children:[(0,u.jsxs)("div",{className:c.A.visualizationRow,children:[(0,u.jsxs)("div",{className:c.A.mainVisualizationColumn,children:[(0,u.jsx)("div",{className:c.A.canvasContainer,children:(0,u.jsx)("canvas",{ref:S,width:512,height:512,className:c.A.canvas})}),(0,u.jsxs)("div",{className:c.A.colorScaleContainer,children:[(0,u.jsx)("canvas",{ref:w,width:512,height:40,className:c.A.colorScaleCanvas}),(0,u.jsx)("div",{style:{display:"flex",justifyContent:"space-between",width:"100%",marginTop:"8px"},children:"probability"===m?(0,u.jsxs)(u.Fragment,{children:[(0,u.jsx)("span",{className:c.A.colorScaleLabel,children:"0"}),(0,u.jsx)("span",{className:c.A.colorScaleLabel,children:"Probability Density"}),(0,u.jsx)("span",{className:c.A.colorScaleLabel,children:"Max"})]}):(0,u.jsxs)(u.Fragment,{children:[(0,u.jsx)("span",{className:c.A.colorScaleLabel,children:"Min"}),(0,u.jsx)("span",{className:c.A.colorScaleLabel,children:"0"}),(0,u.jsx)("span",{className:c.A.colorScaleLabel,children:"Max"})]})})]})]}),(0,u.jsxs)("div",{className:c.A.phasorColumn,children:[(0,u.jsxs)("div",{className:c.A.phasorWrapper,children:[(0,u.jsx)("div",{className:c.A.canvasContainer,children:(0,u.jsx)("canvas",{ref:C,width:400,height:400,className:c.A.canvas})}),(0,u.jsx)("p",{className:c.A.phasorHint,children:"Click on a phasor circle to toggle quantum states"})]}),(0,u.jsxs)("div",{className:c.A.infoPanel,children:[(0,u.jsx)("h3",{className:c.A.infoTitle,children:"Current Settings"}),(0,u.jsxs)("div",{className:c.A.infoGrid,children:[(0,u.jsxs)("div",{children:[(0,u.jsxs)("p",{className:c.A.infoValue,children:[(0,u.jsx)("span",{className:c.A.infoLabel,children:"Mode:"})," ","probability"===m?"Probability Density":"real"===m?"Real Part":"imaginary"===m?"Imaginary Part":"Probability Density"]}),(0,u.jsxs)("p",{className:c.A.infoValue,children:[(0,u.jsx)("span",{className:c.A.infoLabel,children:"Time:"})," ",A]})]}),(0,u.jsxs)("div",{children:[(0,u.jsxs)("p",{className:c.A.infoValue,children:[(0,u.jsx)("span",{className:c.A.infoLabel,children:"Active States:"})," ",e.map((e=>`(${e.nx},${e.ny})`)).join(", ")]}),(0,u.jsxs)("p",{className:c.A.infoValue,children:[(0,u.jsx)("span",{className:c.A.infoLabel,children:"Color Map:"})," ",p]})]})]})]})]})]}),(0,u.jsx)("div",{className:c.A.controlsSection,children:(0,u.jsxs)("div",{className:c.A.controlsRow,children:[(0,u.jsxs)("div",{className:c.A.controlGroup,children:[(0,u.jsx)("h3",{className:c.A.controlGroupTitle,children:"Animation"}),(0,u.jsxs)("div",{className:c.A.controlOptions,children:[(0,u.jsx)(r.A,{onClick:()=>i(!a),variant:a?"danger":"success",children:a?"Pause":"Play"}),(0,u.jsxs)("div",{className:c.A.rangeContainer,children:[(0,u.jsx)("span",{className:c.A.rangeLabel,children:"Speed:"}),(0,u.jsx)("input",{type:"range",min:"0.1",max:"3",step:"0.1",value:d,onChange:e=>h(parseFloat(e.target.value)),className:c.A.rangeInput}),(0,u.jsxs)("span",{className:c.A.rangeValue,children:[d.toFixed(1),"x"]})]})]})]}),(0,u.jsxs)("div",{className:c.A.controlGroup,children:[(0,u.jsx)("h3",{className:c.A.controlGroupTitle,children:"Display Mode"}),(0,u.jsxs)("div",{className:c.A.controlOptions,children:[(0,u.jsxs)("div",{className:c.A.controlOption,children:[(0,u.jsx)("input",{type:"radio",id:"probability",checked:"probability"===m,onChange:()=>v("probability")}),(0,u.jsx)("label",{htmlFor:"probability",className:c.A.controlOptionLabel,children:"Probability Density"})]}),(0,u.jsxs)("div",{className:c.A.controlOption,children:[(0,u.jsx)("input",{type:"radio",id:"real",checked:"real"===m,onChange:()=>v("real")}),(0,u.jsx)("label",{htmlFor:"real",className:c.A.controlOptionLabel,children:"Real Part"})]}),(0,u.jsxs)("div",{className:c.A.controlOption,children:[(0,u.jsx)("input",{type:"radio",id:"imaginary",checked:"imaginary"===m,onChange:()=>v("imaginary")}),(0,u.jsx)("label",{htmlFor:"imaginary",className:c.A.controlOptionLabel,children:"Imaginary Part"})]})]})]}),(0,u.jsxs)("div",{className:c.A.controlGroup,children:[(0,u.jsx)("h3",{className:c.A.controlGroupTitle,children:"Visualization Options"}),(0,u.jsxs)("div",{className:c.A.controlOptions,children:[(0,u.jsx)(r.A,{onClick:()=>{const e=["blue-white-orange","blue-white-red","rainbow"],n=(e.indexOf(p)+1)%e.length;x(e[n])},variant:"primary",children:"Cycle Color Map"}),(0,u.jsxs)("div",{className:c.A.controlOption,children:[(0,u.jsx)("input",{type:"checkbox",id:"gridLines",checked:f,onChange:e=>g(e.target.checked)}),(0,u.jsx)("label",{htmlFor:"gridLines",className:c.A.controlOptionLabel,children:"Grid Lines"})]}),(0,u.jsxs)("div",{className:c.A.controlOption,children:[(0,u.jsx)("input",{type:"checkbox",id:"phaseInfo",checked:b,onChange:e=>y(e.target.checked)}),(0,u.jsx)("label",{htmlFor:"phaseInfo",className:c.A.controlOptionLabel,children:"Show Phasors"})]})]})]})]})}),(0,u.jsxs)("div",{className:c.A.explanationContainer,children:[(0,u.jsx)("h3",{className:c.A.explanationTitle,children:"About 2D Quantum Particle in a Box"}),(0,u.jsx)("p",{className:c.A.explanationText,children:"This visualization shows a quantum particle confined to a two-dimensional square box with infinite potential walls. The system has eigenstates characterized by two quantum numbers (nx, ny), corresponding to the number of nodes in each dimension."}),(0,u.jsxs)("p",{className:c.A.explanationText,children:["The energy of each state is ",(0,u.jsx)(s.A,{math:"E = \\frac{\\pi^2 \\hbar^2}{2 m L^2} (nx^2 + ny^2)",inline:!0}),", meaning higher quantum numbers have higher energies. Each quantum state evolves in time with a phase factor ",(0,u.jsx)(s.A,{math:"e^{\\frac{-i E t}{\\hbar}}",inline:!0}),", with faster rotation for higher energy states."]}),(0,u.jsx)("h4",{children:"Key features to observe:"}),(0,u.jsxs)("ul",{className:c.A.explanationList,children:[(0,u.jsx)("li",{className:c.A.explanationListItem,children:"Probability densities show characteristic nodal patterns based on quantum numbers"}),(0,u.jsx)("li",{className:c.A.explanationListItem,children:"Superposition of states creates interference patterns that evolve in time"}),(0,u.jsx)("li",{className:c.A.explanationListItem,children:"States with different energies evolve at different rates, creating complex dynamics"}),(0,u.jsx)("li",{className:c.A.explanationListItem,children:"The phasor grid shows the phase evolution of each active quantum state"})]}),(0,u.jsxs)("div",{className:c.A.explanationNote,children:[(0,u.jsx)("strong",{children:"Tip:"})," Try activating multiple states with different quantum numbers to see interference effects and observe how the pattern evolves over time!"]}),e.length>0&&(0,u.jsxs)("div",{className:c.A.stateEnergiesContainer,children:[(0,u.jsx)("h4",{children:"Active States and Their Energies"}),(0,u.jsx)("ul",{className:c.A.stateEnergiesList,children:e.map((e=>(0,u.jsxs)("li",{className:c.A.stateEnergiesItem,children:["State (nx=",e.nx,", ny=",e.ny,"): E = ",P(e.nx,e.ny)]},`${e.nx}-${e.ny}`)))})]})]})]})};var h=a(6951);function m(){const[e,n]=(0,t.useState)("1D");return(0,u.jsx)(i.A,{title:"Quantum Mechanics Visualizations",description:"Interactive visualizations of quantum mechanics concepts",children:(0,u.jsx)("main",{className:h.A.mainContainer,children:(0,u.jsx)("div",{className:h.A.visualizationContainer,children:(0,u.jsxs)("div",{className:h.A.visualization,children:[(0,u.jsx)("h2",{children:"2D Particle in a Box"}),(0,u.jsx)(d,{className:h.A.centeredVisualization})]})})})})}},6437:(e,n,a)=>{a.d(n,{A:()=>o});var t=a(6540),i=a(2130),l=a(4848);const o=e=>{let{math:n,inline:a=!0}=e;const o=(0,t.useRef)(null);return(0,t.useEffect)((()=>{o.current&&i.Ay.render(n,o.current,{throwOnError:!1,displayMode:!a})}),[n,a]),(0,l.jsx)("span",{ref:o})}},6951:(e,n,a)=>{a.d(n,{A:()=>t});const t={mainContainer:"mainContainer_ToYM",header:"header_Crl1",toggleButtons:"toggleButtons_HfWQ",toggleButton:"toggleButton_XP4b",activeButton:"activeButton_U0kg",visualizationContainer:"visualizationContainer_EYJL",visualization:"visualization_ziEY",centeredVisualization:"centeredVisualization_l8sE",explanation:"explanation_RvX9"}},8869:(e,n,a)=>{a.d(n,{A:()=>o});a(6540);var t=a(4164),i=a(6289),l=a(4848);function o(e){let{size:n=null,outline:a=!1,variant:o="primary",block:r=!1,disabled:s=!1,className:c,style:u,link:d,label:h,onClick:m,children:v}=e;const p=n?{sm:"sm",small:"sm",lg:"lg",large:"lg",medium:null}[n]:"",x=p?`button--${p}`:"",f=a?"button--outline":"",g=o?`button--${o}`:"",b=r?"button--block":"",y=s?"disabled":"",A=v||h,j=e=>{s?e.preventDefault():m&&m()};return d?(0,l.jsx)(i.A,{to:s?null:d,children:(0,l.jsx)("button",{className:(0,t.A)("button",x,f,g,b,y,c),style:u,role:"button","aria-disabled":s,onClick:j,children:A})}):(0,l.jsx)("button",{className:(0,t.A)("button",x,f,g,b,y,c),style:u,disabled:s,onClick:j,children:A})}},9651:(e,n,a)=>{a.d(n,{A:()=>t});const t={container:"container_cqng",title:"title_noQj",flexContainer:"flexContainer_UJ2T",visualizationRow:"visualizationRow_gJmC",mainVisualizationColumn:"mainVisualizationColumn_Qvup",phasorColumn:"phasorColumn_UbB5",canvasContainer:"canvasContainer_PTLs",canvas:"canvas_ALcg",colorScaleContainer:"colorScaleContainer_hnx4",colorScaleCanvas:"colorScaleCanvas_T1HO",colorScaleLabel:"colorScaleLabel_uzw6",colorScaleWrapper:"colorScaleWrapper_gk7D",colorScaleTitle:"colorScaleTitle_Ed3y",colorScaleImage:"colorScaleImage_lBEX",colorScaleLabelTop:"colorScaleLabelTop_Jz_5",colorScaleLabelMiddle:"colorScaleLabelMiddle_ai5J",colorScaleLabelBottom:"colorScaleLabelBottom_y5MY",phasorContainer:"phasorContainer_yelD",phasorWrapper:"phasorWrapper_E2FV",phasorHint:"phasorHint_gnlA",phasorMessage:"phasorMessage_msJC",infoPanel:"infoPanel_swq1",infoGrid:"infoGrid_Kbft",infoTitle:"infoTitle_kOIn",infoValue:"infoValue_I8P3",infoLabel:"infoLabel_mybD",infoHint:"infoHint_l_MG",controlsSection:"controlsSection_LfUR",controlsContainer:"controlsContainer_stJ7",controlsRow:"controlsRow_ZegN",controlButton:"controlButton_jkuO",playButton:"playButton_vFZS",pauseButton:"pauseButton_eWBl",switchButton:"switchButton_FePy",rangeContainer:"rangeContainer_bvsR",rangeLabel:"rangeLabel_YC1v",rangeLabelText:"rangeLabelText_m7QQ",rangeInput:"rangeInput_lHnO",rangeValue:"rangeValue_Hdsn",controlGroup:"controlGroup_Jd3q",controlGroupTitle:"controlGroupTitle_I6Ap",controlOptions:"controlOptions_PbfK",controlOption:"controlOption_eLtK",controlOptionLabel:"controlOptionLabel_BOyV",explanationContainer:"explanationContainer_vxJw",explanationTitle:"explanationTitle_ydVD",explanationText:"explanationText_QCmg",explanationList:"explanationList_iDqn",explanationListItem:"explanationListItem_nc_j",explanationNote:"explanationNote_VnKw",stateEnergiesContainer:"stateEnergiesContainer_Woi7",stateEnergiesList:"stateEnergiesList_Jiip",stateEnergiesItem:"stateEnergiesItem_tyEW",legendContainer:"legendContainer_JsOt",legendTitle:"legendTitle_k3Pp",legendItems:"legendItems_D5nA",legendItem:"legendItem_n_ct",active:"active_l7VW",inactive:"inactive_Zzmn",legendColorSwatch:"legendColorSwatch_HQwq",legendText:"legendText_TIdV",main:"main_QZpM"}}}]);