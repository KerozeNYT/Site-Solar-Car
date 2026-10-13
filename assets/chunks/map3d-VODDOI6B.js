import{a as Ct}from"/Site-Solar-Car/assets/chunks/chunk-BSYWBAXG.js";import{$ as le,$a as At,Ba as St,Da as bt,I as vt,Ia as Ee,J as ke,M as gt,Ma as _t,N as wt,Na as je,Oa as ce,P as u,Qa as Tt,S as B,U as yt,Y as P,Z as xt,Za as Ne,_ as Et,_a as Mt,b as ft,ba as Fe,ca as xe,db as zt,e as pt,fa as O,fb as Rt,g as mt,h as Y,jb as de,ma as F,mb as Lt,ob as ue,p as ht,pb as fe,rb as Ht}from"/Site-Solar-Car/assets/chunks/chunk-F2AE2DKA.js";var Ut=new le,Se=new u,X=class extends Rt{constructor(){super(),this.isLineSegmentsGeometry=!0,this.type="LineSegmentsGeometry";let e=[-1,2,0,1,2,0,-1,1,0,1,1,0,-1,0,0,1,0,0,-1,-1,0,1,-1,0],o=[-1,2,1,2,-1,1,1,1,-1,-1,1,-1,-1,-2,1,-2],i=[0,2,1,2,3,1,2,4,3,4,5,3,4,6,5,6,7,5];this.setIndex(i),this.setAttribute("position",new Fe(e,3)),this.setAttribute("uv",new Fe(o,2))}applyMatrix4(e){let o=this.attributes.instanceStart,i=this.attributes.instanceEnd;return o!==void 0&&(o.applyMatrix4(e),i.applyMatrix4(e),o.needsUpdate=!0),this.boundingBox!==null&&this.computeBoundingBox(),this.boundingSphere!==null&&this.computeBoundingSphere(),this}setPositions(e){let o;e instanceof Float32Array?o=e:Array.isArray(e)&&(o=new Float32Array(e));let i=new de(o,6,1);return this.setAttribute("instanceStart",new O(i,3,0)),this.setAttribute("instanceEnd",new O(i,3,3)),this.instanceCount=this.attributes.instanceStart.count,this.computeBoundingBox(),this.computeBoundingSphere(),this}setColors(e){let o;e instanceof Float32Array?o=e:Array.isArray(e)&&(o=new Float32Array(e));let i=new de(o,6,1);return this.setAttribute("instanceColorStart",new O(i,3,0)),this.setAttribute("instanceColorEnd",new O(i,3,3)),this}fromWireframeGeometry(e){return this.setPositions(e.attributes.position.array),this}fromEdgesGeometry(e){return this.setPositions(e.attributes.position.array),this}fromMesh(e){return this.fromWireframeGeometry(new _t(e.geometry)),this}fromLineSegments(e){let o=e.geometry;return this.setPositions(o.attributes.position.array),this}computeBoundingBox(){this.boundingBox===null&&(this.boundingBox=new le);let e=this.attributes.instanceStart,o=this.attributes.instanceEnd;e!==void 0&&o!==void 0&&(this.boundingBox.setFromBufferAttribute(e),Ut.setFromBufferAttribute(o),this.boundingBox.union(Ut))}computeBoundingSphere(){this.boundingSphere===null&&(this.boundingSphere=new xe),this.boundingBox===null&&this.computeBoundingBox();let e=this.attributes.instanceStart,o=this.attributes.instanceEnd;if(e!==void 0&&o!==void 0){let i=this.boundingSphere.center;this.boundingBox.getCenter(i);let n=0;for(let c=0,p=e.count;c<p;c++)Se.fromBufferAttribute(e,c),n=Math.max(n,i.distanceToSquared(Se)),Se.fromBufferAttribute(o,c),n=Math.max(n,i.distanceToSquared(Se));this.boundingSphere.radius=Math.sqrt(n),isNaN(this.boundingSphere.radius)&&console.error("THREE.LineSegmentsGeometry.computeBoundingSphere(): Computed radius is NaN. The instanced position data is likely to have NaN values.",this)}}toJSON(){}};ue.line={worldUnits:{value:1},linewidth:{value:1},resolution:{value:new wt},dashOffset:{value:0},dashScale:{value:1},dashSize:{value:1},gapSize:{value:1}};fe.line={uniforms:je.merge([ue.common,ue.fog,ue.line]),vertexShader:`
		#include <common>
		#include <color_pars_vertex>
		#include <fog_pars_vertex>
		#include <logdepthbuf_pars_vertex>
		#include <clipping_planes_pars_vertex>

		uniform float linewidth;
		uniform vec2 resolution;

		attribute vec3 instanceStart;
		attribute vec3 instanceEnd;

		attribute vec3 instanceColorStart;
		attribute vec3 instanceColorEnd;

		#ifdef WORLD_UNITS

			varying vec4 worldPos;
			varying vec3 worldStart;
			varying vec3 worldEnd;

			#ifdef USE_DASH

				varying vec2 vUv;

			#endif

		#else

			varying vec2 vUv;

		#endif

		#ifdef USE_DASH

			uniform float dashScale;
			attribute float instanceDistanceStart;
			attribute float instanceDistanceEnd;
			varying float vLineDistance;

		#endif

		float trimSegmentAlpha( const in vec4 start, const in vec4 end ) {

			// compute the interpolation factor needed to trim the segment so it terminates
			// between the camera plane and the near plane

			// conservative estimate of the near plane
			float a = projectionMatrix[ 2 ][ 2 ]; // 3nd entry in 3th column
			float b = projectionMatrix[ 3 ][ 2 ]; // 3nd entry in 4th column

			// we need different nearEstimate formula for reversed and default depth buffer
			// a is positive with a reversed depth buffer so it can be used for controlling the code flow
			float nearEstimate = ( a > 0.0 ) ? ( - b / ( a + 1.0 ) ) : ( - 0.5 * b / a );

			return ( nearEstimate - start.z ) / ( end.z - start.z );

		}

		void main() {

			#ifdef USE_COLOR

				vColor.xyz = ( position.y < 0.5 ) ? instanceColorStart : instanceColorEnd;

			#endif

			float aspect = resolution.x / resolution.y;

			// camera space
			vec4 start = modelViewMatrix * vec4( instanceStart, 1.0 );
			vec4 end = modelViewMatrix * vec4( instanceEnd, 1.0 );

			#ifdef USE_DASH

				float lineDistanceStart = dashScale * instanceDistanceStart;
				float lineDistanceEnd = dashScale * instanceDistanceEnd;

			#endif

			#ifdef WORLD_UNITS

				worldStart = start.xyz;
				worldEnd = end.xyz;

			#else

				vUv = uv;

			#endif

			// special case for perspective projection, and segments that terminate either in, or behind, the camera plane
			// clearly the gpu firmware has a way of addressing this issue when projecting into ndc space
			// but we need to perform ndc-space calculations in the shader, so we must address this issue directly
			// perhaps there is a more elegant solution -- WestLangley

			bool perspective = ( projectionMatrix[ 2 ][ 3 ] == - 1.0 ); // 4th entry in the 3rd column

			if ( perspective ) {

				if ( start.z < 0.0 && end.z >= 0.0 ) {

					float alpha = trimSegmentAlpha( start, end );
					end.xyz = mix( start.xyz, end.xyz, alpha );

					#ifdef USE_DASH

						lineDistanceEnd = mix( lineDistanceStart, lineDistanceEnd, alpha );

					#endif

				} else if ( end.z < 0.0 && start.z >= 0.0 ) {

					float alpha = trimSegmentAlpha( end, start );
					start.xyz = mix( end.xyz, start.xyz, alpha );

					#ifdef USE_DASH

						lineDistanceStart = mix( lineDistanceEnd, lineDistanceStart, alpha );

					#endif

				}

			}

			#ifdef USE_DASH

				vLineDistance = ( position.y < 0.5 ) ? lineDistanceStart : lineDistanceEnd;
				vUv = uv;

			#endif

			// clip space
			vec4 clipStart = projectionMatrix * start;
			vec4 clipEnd = projectionMatrix * end;

			// ndc space
			vec3 ndcStart = clipStart.xyz / clipStart.w;
			vec3 ndcEnd = clipEnd.xyz / clipEnd.w;

			// direction
			vec2 dir = ndcEnd.xy - ndcStart.xy;

			// account for clip-space aspect ratio
			dir.x *= aspect;
			dir = normalize( dir );

			#ifdef WORLD_UNITS

				vec3 worldDir = normalize( end.xyz - start.xyz );
				vec3 tmpFwd = normalize( mix( start.xyz, end.xyz, 0.5 ) );
				vec3 worldUp = normalize( cross( worldDir, tmpFwd ) );
				vec3 worldFwd = cross( worldDir, worldUp );
				worldPos = position.y < 0.5 ? start: end;

				// height offset
				float hw = linewidth * 0.5;
				worldPos.xyz += position.x < 0.0 ? hw * worldUp : - hw * worldUp;

				// don't extend the line if we're rendering dashes because we
				// won't be rendering the endcaps
				#ifndef USE_DASH

					// cap extension
					worldPos.xyz += position.y < 0.5 ? - hw * worldDir : hw * worldDir;

					// add width to the box
					worldPos.xyz += worldFwd * hw;

					// endcaps
					if ( position.y > 1.0 || position.y < 0.0 ) {

						worldPos.xyz -= worldFwd * 2.0 * hw;

					}

				#endif

				// project the worldpos
				vec4 clip = projectionMatrix * worldPos;

				// shift the depth of the projected points so the line
				// segments overlap neatly
				vec3 clipPose = ( position.y < 0.5 ) ? ndcStart : ndcEnd;
				clip.z = clipPose.z * clip.w;

			#else

				vec2 offset = vec2( dir.y, - dir.x );
				// undo aspect ratio adjustment
				dir.x /= aspect;
				offset.x /= aspect;

				// sign flip
				if ( position.x < 0.0 ) offset *= - 1.0;

				// endcaps
				if ( position.y < 0.0 ) {

					offset += - dir;

				} else if ( position.y > 1.0 ) {

					offset += dir;

				}

				// adjust for linewidth
				offset *= linewidth;

				// adjust for clip-space to screen-space conversion // maybe resolution should be based on viewport ...
				offset /= resolution.y;

				// select end
				vec4 clip = ( position.y < 0.5 ) ? clipStart : clipEnd;

				// back to clip space
				offset *= clip.w;

				clip.xy += offset;

			#endif

			gl_Position = clip;

			vec4 mvPosition = ( position.y < 0.5 ) ? start : end; // this is an approximation

			#include <logdepthbuf_vertex>
			#include <clipping_planes_vertex>
			#include <fog_vertex>

		}
		`,fragmentShader:`
		uniform vec3 diffuse;
		uniform float opacity;
		uniform float linewidth;

		#ifdef USE_DASH

			uniform float dashOffset;
			uniform float dashSize;
			uniform float gapSize;

		#endif

		varying float vLineDistance;

		#ifdef WORLD_UNITS

			varying vec4 worldPos;
			varying vec3 worldStart;
			varying vec3 worldEnd;

			#ifdef USE_DASH

				varying vec2 vUv;

			#endif

		#else

			varying vec2 vUv;

		#endif

		#include <common>
		#include <color_pars_fragment>
		#include <fog_pars_fragment>
		#include <logdepthbuf_pars_fragment>
		#include <clipping_planes_pars_fragment>

		vec2 closestLineToLine(vec3 p1, vec3 p2, vec3 p3, vec3 p4) {

			float mua;
			float mub;

			vec3 p13 = p1 - p3;
			vec3 p43 = p4 - p3;

			vec3 p21 = p2 - p1;

			float d1343 = dot( p13, p43 );
			float d4321 = dot( p43, p21 );
			float d1321 = dot( p13, p21 );
			float d4343 = dot( p43, p43 );
			float d2121 = dot( p21, p21 );

			float denom = d2121 * d4343 - d4321 * d4321;

			float numer = d1343 * d4321 - d1321 * d4343;

			mua = numer / denom;
			mua = clamp( mua, 0.0, 1.0 );
			mub = ( d1343 + d4321 * ( mua ) ) / d4343;
			mub = clamp( mub, 0.0, 1.0 );

			return vec2( mua, mub );

		}

		void main() {

			float alpha = opacity;
			vec4 diffuseColor = vec4( diffuse, alpha );

			#include <clipping_planes_fragment>

			#ifdef USE_DASH

				if ( vUv.y < - 1.0 || vUv.y > 1.0 ) discard; // discard endcaps

				if ( mod( vLineDistance + dashOffset, dashSize + gapSize ) > dashSize ) discard; // todo - FIX

			#endif

			#ifdef WORLD_UNITS

				// Find the closest points on the view ray and the line segment
				vec3 rayEnd = normalize( worldPos.xyz ) * 1e5;
				vec3 lineDir = worldEnd - worldStart;
				vec2 params = closestLineToLine( worldStart, worldEnd, vec3( 0.0, 0.0, 0.0 ), rayEnd );

				vec3 p1 = worldStart + lineDir * params.x;
				vec3 p2 = rayEnd * params.y;
				vec3 delta = p1 - p2;
				float len = length( delta );
				float norm = len / linewidth;

				#ifndef USE_DASH

					#ifdef USE_ALPHA_TO_COVERAGE

						float dnorm = fwidth( norm );
						alpha = 1.0 - smoothstep( 0.5 - dnorm, 0.5 + dnorm, norm );

					#else

						if ( norm > 0.5 ) {

							discard;

						}

					#endif

				#endif

			#else

				#ifdef USE_ALPHA_TO_COVERAGE

					// artifacts appear on some hardware if a derivative is taken within a conditional
					float a = vUv.x;
					float b = ( vUv.y > 0.0 ) ? vUv.y - 1.0 : vUv.y + 1.0;
					float len2 = a * a + b * b;
					float dlen = fwidth( len2 );

					if ( abs( vUv.y ) > 1.0 ) {

						alpha = 1.0 - smoothstep( 1.0 - dlen, 1.0 + dlen, len2 );

					}

				#else

					if ( abs( vUv.y ) > 1.0 ) {

						float a = vUv.x;
						float b = ( vUv.y > 0.0 ) ? vUv.y - 1.0 : vUv.y + 1.0;
						float len2 = a * a + b * b;

						if ( len2 > 1.0 ) discard;

					}

				#endif

			#endif

			#include <logdepthbuf_fragment>
			#include <color_fragment>

			gl_FragColor = vec4( diffuseColor.rgb, alpha );

			#include <tonemapping_fragment>
			#include <colorspace_fragment>
			#include <fog_fragment>
			#include <premultiplied_alpha_fragment>

		}
		`};var I=class extends ce{constructor(e){super({type:"LineMaterial",uniforms:je.clone(fe.line.uniforms),vertexShader:fe.line.vertexShader,fragmentShader:fe.line.fragmentShader,clipping:!0}),this.isLineMaterial=!0,this.setValues(e)}get color(){return this.uniforms.diffuse.value}set color(e){this.uniforms.diffuse.value=e}get worldUnits(){return"WORLD_UNITS"in this.defines}set worldUnits(e){e===!0!==this.worldUnits&&(this.needsUpdate=!0),e===!0?this.defines.WORLD_UNITS="":delete this.defines.WORLD_UNITS}get linewidth(){return this.uniforms.linewidth.value}set linewidth(e){this.uniforms.linewidth&&(this.uniforms.linewidth.value=e)}get dashed(){return"USE_DASH"in this.defines}set dashed(e){e===!0!==this.dashed&&(this.needsUpdate=!0),e===!0?this.defines.USE_DASH="":delete this.defines.USE_DASH}get dashScale(){return this.uniforms.dashScale.value}set dashScale(e){this.uniforms.dashScale.value=e}get dashSize(){return this.uniforms.dashSize.value}set dashSize(e){this.uniforms.dashSize.value=e}get dashOffset(){return this.uniforms.dashOffset.value}set dashOffset(e){this.uniforms.dashOffset.value=e}get gapSize(){return this.uniforms.gapSize.value}set gapSize(e){this.uniforms.gapSize.value=e}get opacity(){return this.uniforms.opacity.value}set opacity(e){this.uniforms&&(this.uniforms.opacity.value=e)}get resolution(){return this.uniforms.resolution.value}set resolution(e){this.uniforms.resolution.value.copy(e)}get alphaToCoverage(){return"USE_ALPHA_TO_COVERAGE"in this.defines}set alphaToCoverage(e){this.defines&&(e===!0!==this.alphaToCoverage&&(this.needsUpdate=!0),e===!0?this.defines.USE_ALPHA_TO_COVERAGE="":delete this.defines.USE_ALPHA_TO_COVERAGE)}};var Ge=new B,Dt=new u,Bt=new u,v=new B,g=new B,H=new B,qe=new u,$e=new yt,w=new Lt,Pt=new u,be=new le,_e=new xe,C=new B,U,j;function Ot(a,e,o){return C.set(0,0,-e,1).applyMatrix4(a.projectionMatrix),C.multiplyScalar(1/C.w),C.x=j/o.width,C.y=j/o.height,C.applyMatrix4(a.projectionMatrixInverse),C.multiplyScalar(1/C.w),Math.abs(Math.max(C.x,C.y))}function $t(a,e){let o=a.matrixWorld,i=a.geometry,n=i.attributes.instanceStart,c=i.attributes.instanceEnd,p=Math.min(i.instanceCount,n.count);for(let l=0,y=p;l<y;l++){w.start.fromBufferAttribute(n,l),w.end.fromBufferAttribute(c,l),w.applyMatrix4(o);let S=new u,b=new u;U.distanceSqToSegment(w.start,w.end,b,S),b.distanceTo(S)<j*.5&&e.push({point:b,pointOnLine:S,distance:U.origin.distanceTo(b),object:a,face:null,faceIndex:l,uv:null,uv1:null})}}function Yt(a,e,o){let i=e.projectionMatrix,c=a.material.resolution,p=a.matrixWorld,l=a.geometry,y=l.attributes.instanceStart,S=l.attributes.instanceEnd,b=Math.min(l.instanceCount,y.count),x=-e.near;U.at(1,H),H.w=1,H.applyMatrix4(e.matrixWorldInverse),H.applyMatrix4(i),H.multiplyScalar(1/H.w),H.x*=c.x/2,H.y*=c.y/2,H.z=0,qe.copy(H),$e.multiplyMatrices(e.matrixWorldInverse,p);for(let M=0,Z=b;M<Z;M++){if(v.fromBufferAttribute(y,M),g.fromBufferAttribute(S,M),v.w=1,g.w=1,v.applyMatrix4($e),g.applyMatrix4($e),v.z>x&&g.z>x)continue;if(v.z>x){let _=v.z-g.z,E=(v.z-x)/_;v.lerp(g,E)}else if(g.z>x){let _=g.z-v.z,E=(g.z-x)/_;g.lerp(v,E)}v.applyMatrix4(i),g.applyMatrix4(i),v.multiplyScalar(1/v.w),g.multiplyScalar(1/g.w),v.x*=c.x/2,v.y*=c.y/2,g.x*=c.x/2,g.y*=c.y/2,w.start.copy(v),w.start.z=0,w.end.copy(g),w.end.z=0;let J=w.closestPointToPointParameter(qe,!0);w.at(J,Pt);let Q=gt.lerp(v.z,g.z,J),ee=Q>=-1&&Q<=1,pe=qe.distanceTo(Pt)<j*.5;if(ee&&pe){w.start.fromBufferAttribute(y,M),w.end.fromBufferAttribute(S,M),w.start.applyMatrix4(p),w.end.applyMatrix4(p);let _=new u,E=new u;U.distanceSqToSegment(w.start,w.end,E,_),o.push({point:E,pointOnLine:_,distance:U.origin.distanceTo(E),object:a,face:null,faceIndex:M,uv:null,uv1:null})}}}var Te=class extends F{constructor(e=new X,o=new I({color:Math.random()*16777215})){super(e,o),this.isLineSegments2=!0,this.type="LineSegments2"}computeLineDistances(){let e=this.geometry,o=e.attributes.instanceStart,i=e.attributes.instanceEnd,n=new Float32Array(2*o.count);for(let p=0,l=0,y=o.count;p<y;p++,l+=2)Dt.fromBufferAttribute(o,p),Bt.fromBufferAttribute(i,p),n[l]=l===0?0:n[l-1],n[l+1]=n[l]+Dt.distanceTo(Bt);let c=new de(n,2,1);return e.setAttribute("instanceDistanceStart",new O(c,1,0)),e.setAttribute("instanceDistanceEnd",new O(c,1,1)),this}raycast(e,o){let i=this.material.worldUnits,n=e.camera;if(n===null&&!i&&console.error('LineSegments2: "Raycaster.camera" needs to be set in order to raycast against LineSegments2 while worldUnits is set to false.'),i===!1&&(this.material.resolution.x===0||this.material.resolution.y===0))return;let c=e.params.Line2!==void 0&&e.params.Line2.threshold||0;U=e.ray;let p=this.matrixWorld,l=this.geometry,y=this.material;j=y.linewidth+c,l.boundingSphere===null&&l.computeBoundingSphere(),_e.copy(l.boundingSphere).applyMatrix4(p);let S;if(i)S=j*.5;else{let x=Math.max(n.near,_e.distanceToPoint(U.origin));S=Ot(n,x,y.resolution)}if(_e.radius+=S,U.intersectsSphere(_e)===!1)return;l.boundingBox===null&&l.computeBoundingBox(),be.copy(l.boundingBox).applyMatrix4(p);let b;if(i)b=j*.5;else{let x=Math.max(n.near,be.distanceToPoint(U.origin));b=Ot(n,x,y.resolution)}be.expandByScalar(b),U.intersectsBox(be)!==!1&&(i?$t(this,o):Yt(this,n,o))}onBeforeRender(e){let o=this.material.uniforms;o&&o.resolution&&(e.getViewport(Ge),this.material.uniforms.resolution.value.set(Ge.z,Ge.w))}};var K=class extends X{constructor(){super(),this.isLineGeometry=!0,this.type="LineGeometry"}setPositions(e){let o=e.length-3,i=new Float32Array(2*o);for(let n=0;n<o;n+=3)i[2*n]=e[n],i[2*n+1]=e[n+1],i[2*n+2]=e[n+2],i[2*n+3]=e[n+3],i[2*n+4]=e[n+4],i[2*n+5]=e[n+5];return super.setPositions(i),this}setColors(e){let o=e.length-3,i=new Float32Array(2*o);for(let n=0;n<o;n+=3)i[2*n]=e[n],i[2*n+1]=e[n+1],i[2*n+2]=e[n+2],i[2*n+3]=e[n+3],i[2*n+4]=e[n+4],i[2*n+5]=e[n+5];return super.setColors(i),this}setFromPoints(e){let o=e.length-1,i=new Float32Array(6*o);for(let n=0;n<o;n++)i[6*n]=e[n].x,i[6*n+1]=e[n].y,i[6*n+2]=e[n].z||0,i[6*n+3]=e[n+1].x,i[6*n+4]=e[n+1].y,i[6*n+5]=e[n+1].z||0;return super.setPositions(i),this}fromLine(e){let o=e.geometry;return this.setPositions(o.attributes.position.array),this}};var Me=class extends Te{constructor(e=new K,o=new I({color:Math.random()*16777215})){super(e,o),this.isLine2=!0,this.type="Line2"}};var Ae="/Site-Solar-Car/map/",Xt=3.2,It=16,ze=new P(15778394),Wt=new P(10462118);function Kt(a){return new Promise((e,o)=>{let i=new Image;i.decoding="async",i.onload=()=>{let n=document.createElement("canvas");n.width=i.width,n.height=i.height;let c=n.getContext("2d",{willReadFrequently:!0});c.drawImage(i,0,0),e(c.getImageData(0,0,i.width,i.height))},i.onerror=o,i.src=a})}var Vt=a=>a<.5?4*a*a*a:1-Math.pow(-2*a+2,3)/2;async function wn(a){let e=matchMedia("(prefers-reduced-motion: reduce)").matches,o=matchMedia("(max-width: 760px)").matches||(navigator.hardwareConcurrency||4)<=4,i=(navigator.hardwareConcurrency||4)<=4||navigator.connection?.saveData,[n,c,p,l]=await Promise.all([fetch(Ae+"map.json").then(t=>t.json()),Kt(Ae+"dem.png"),new Ne().loadAsync(Ae+(i?"sat-1024.webp":"sat.webp")),new Ne().loadAsync(Ae+"mask.png")]);p.colorSpace=ke,p.anisotropy=8,l.colorSpace=vt;let[y,S,b,x]=n.extent,[M,Z]=n.dem,Re=(y+S)/2,J=(b+x)/2,Q=(t,r)=>{let s=(r*M+t)*4;return(c.data[s]*256+c.data[s+1])/100},ee=1/0;for(let t=0;t<Z;t++)for(let r=0;r<M;r++)ee=Math.min(ee,Q(r,t));let pe=t=>(t-ee)*Xt,_=(t,r,s,f=0)=>new u(t,pe(s)+f,-r),E=document.createElement("canvas");E.className="visit__map-canvas",E.setAttribute("aria-hidden","true");let te=document.createElement("div");te.className="map3d",a.append(E,te);let A;try{A=new Ht({canvas:E,antialias:!o,alpha:!0,powerPreference:"high-performance"})}catch(t){throw E.remove(),te.remove(),t}A.outputColorSpace=ke,A.toneMapping=ht,A.toneMappingExposure=1.08,A.setClearColor(0,0);let z=new Et;z.fog=new xt(Wt,9e3,3e4);let T=new At(38,1,20,8e4),Ye=new zt(16769712,2.6);Ye.position.set(-.75,.42,.52).multiplyScalar(1e4),z.add(Ye,new Mt(12900095,4865836,.85));let me=o?2:1,Le=Math.floor((M-1)/me)+1,Xe=Math.floor((Z-1)/me)+1,ne=new Ee(S-y,x-b,Le-1,Xe-1);ne.rotateX(-Math.PI/2),ne.translate(Re,0,-J);let kt=ne.attributes.position;for(let t=0;t<Xe;t++)for(let r=0;r<Le;r++)kt.setY(t*Le+r,pe(Q(Math.min(r*me,M-1),Math.min(t*me,Z-1))));ne.computeVertexNormals();let ie={value:0},Ke=new Tt({map:p,roughness:.93,metalness:0,transparent:!0});Ke.onBeforeCompile=t=>{Object.assign(t.uniforms,{uMask:{value:l},uTime:ie,uHaze:{value:Wt},uExt:{value:new B(y,S,-x,-b)}}),t.vertexShader=t.vertexShader.replace("#include <common>",`#include <common>
varying vec3 vW;`).replace("#include <project_vertex>",`#include <project_vertex>
vW = (modelMatrix * vec4(transformed, 1.0)).xyz;`),t.fragmentShader=t.fragmentShader.replace("#include <common>",`#include <common>
uniform sampler2D uMask; uniform float uTime; uniform vec3 uHaze; uniform vec4 uExt; varying vec3 vW;`).replace("#include <map_fragment>",`#include <map_fragment>
        vec3 msk = texture2D(uMask, vMapUv).rgb;
        // the Loire and the Cher: deeper, cooler water
        diffuseColor.rgb = mix(diffuseColor.rgb, diffuseColor.rgb * vec3(0.55, 0.72, 0.92), msk.r * 0.75);
        // the commune of Vouvray: a warm golden veil
        diffuseColor.rgb = mix(diffuseColor.rgb, diffuseColor.rgb * vec3(1.18, 1.07, 0.82) + vec3(0.03, 0.02, 0.0), msk.g * 0.55);`).replace("#include <roughnessmap_fragment>",`#include <roughnessmap_fragment>
roughnessFactor = mix(roughnessFactor, 0.16, msk.r);`).replace("#include <opaque_fragment>",`// glints on the water, faded out with distance before they turn into dotted lines
        float ph = dot(vW.xz, vec2(0.071, 0.043));
        float sp = sin(ph + uTime * 1.6) * sin(dot(vW.xz, vec2(-0.052, 0.067)) - uTime * 1.2);
        float near = clamp(1.0 - fwidth(ph) * 1.5, 0.0, 1.0);
        outgoingLight += vec3(1.0, 0.9, 0.7) * pow(max(sp, 0.0), 18.0) * msk.r * 0.5 * near;
        // the map dissolves into the haze at its borders
        float edge = min(min(vW.x - uExt.x, uExt.y - vW.x), min(vW.z - uExt.z, uExt.w - vW.z));
        float keep = smoothstep(0.0, 1400.0, edge);
        outgoingLight = mix(uHaze * 0.9, outgoingLight, keep);
        diffuseColor.a *= keep;
        #include <opaque_fragment>`)};let Ft=new F(ne,Ke);z.add(Ft);let Ze=[];function oe(t,{color:r=ze,width:s=3,opacity:f=1,dashed:h=!1,dash:L=0,gap:$=0,blending:qt=mt}={}){let dt=new K;dt.setPositions(t.flatMap(Ve=>[Ve.x,Ve.y,Ve.z]));let ut=new I({color:r,linewidth:s,transparent:!0,opacity:f,depthWrite:!1,dashed:h,dashSize:L,gapSize:$,blending:qt}),ye=new Me(dt,ut);return h&&ye.computeLineDistances(),ye.renderOrder=2,z.add(ye),Ze.push(ut),ye}let Je=n.vouvray.map(([t,r,s])=>_(t,r,s,It));oe(Je,{color:ze,width:9,opacity:.18,blending:Y}),oe(Je,{color:new P(16770728),width:2,opacity:.85});let D=n.route.pts.map(([t,r,s])=>_(t,r,s,It+4)),He=0;for(let t=1;t<D.length;t++)He+=D[t].distanceTo(D[t-1]);oe(D,{color:new P(16758062),width:14,opacity:.22,blending:Y}),oe(D,{color:new P(16765803),width:4.5,opacity:1});let jt=oe(D,{color:new P(16777215),width:6,opacity:.95,dashed:!0,dash:520,gap:He*1.4,blending:Y}),Ce=n.workshop,he=_(Ce.x,Ce.y,Ce.h),Qe=new F(new St(26,26,1300,32,1,!0),new ce({uniforms:{uColor:{value:ze}},vertexShader:"varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }",fragmentShader:"uniform vec3 uColor; varying vec2 vUv; void main(){ float a = pow(1.0 - vUv.y, 1.7) * 0.6; gl_FragColor = vec4(uColor * a, a); }",transparent:!0,depthWrite:!1,blending:Y,side:pt}));Qe.position.copy(he).add(new u(0,650,0)),z.add(Qe);let et=new ce({uniforms:{uTime:ie,uColor:{value:ze}},vertexShader:"varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }",fragmentShader:`uniform float uTime; uniform vec3 uColor; varying vec2 vUv;
      void main(){
        float r = length(vUv - 0.5) * 2.0;
        float k = fract(uTime * 0.45);
        float ring = smoothstep(0.06, 0.0, abs(r - k)) * (1.0 - k);
        float core = smoothstep(0.22, 0.0, r) * 0.7;
        float a = (ring + core) * step(r, 1.0);
        gl_FragColor = vec4(uColor * a, a);
      }`,transparent:!0,depthWrite:!1,blending:Y}),ve=new F(new Ee(900,900),et);ve.rotation.x=-Math.PI/2,ve.position.copy(he).add(new u(0,6,0)),ve.renderOrder=3,z.add(ve);let ge=new F(new Ee(420,420),et.clone());ge.material.uniforms={uTime:ie,uColor:{value:new P(16777215)}},ge.rotation.x=-Math.PI/2,ge.position.copy(D[0]).add(new u(0,-8,0)),z.add(ge);let Ue=document.createElement("div");Ue.className="map3d__labels",te.append(Ue);let tt={pin:0,home:1,city:2,start:3,water:4,road:5,poi:6,town:7},De=[],N=(t,r,s,f="")=>{let h=document.createElement("div");h.className=`map3d__label map3d__label--${r} ${f}`,h.innerHTML=t,Ue.append(h),De.push({e:h,kind:r,at:s,w:0,h:0})},W=t=>String(t).replace(/[&<>"]/g,r=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"})[r]);for(let t of n.labels)t.kind==="home"?N(`${W(t.name)}`,"home",_(t.x,t.y,t.h,40)):t.kind==="road"?N(`<span>${W(t.name)}</span>`,"road",_(t.x,t.y,t.h,30)):t.kind==="poi"?N(`<svg viewBox="0 0 24 24" width="14" height="14" aria-hidden="true"><path fill="currentColor" d="M21 16v-2l-8-5V3.5a1.5 1.5 0 0 0-3 0V9l-8 5v2l8-2.5V19l-2 1.5V22l3.5-1 3.5 1v-1.5L13 19v-5.5Z"/></svg>${W(t.name)}`,"poi",_(t.x,t.y,t.h,30)):N(W(t.name),t.kind,_(t.x,t.y,t.h,30));N('<span class="map3d__dot"></span>D\xE9part : centre de Tours',"start",D[0].clone().add(new u(0,30,0)));let nt=a.dataset.name||"SOLAR CAR 37";N(`<span class="map3d__pin-card"><img src="/Site-Solar-Car/img/brand/embleme-64.webp" alt="" width="28" height="28"><span><strong>${W(nt)}</strong><small>${W(a.dataset.address||"")}</small></span></span><span class="map3d__pin-tip"></span>`,"pin",he.clone().add(new u(0,60,0))),De.sort((t,r)=>tt[t.kind]-tt[r.kind]);let it=String(n.route.km).replace(".",","),Be=document.createElement("p");Be.className="map3d__chip",Be.innerHTML=`<span class="map3d__chip-line" aria-hidden="true"></span><span><strong>\u2248 ${it} km</strong> depuis le centre de Tours</span>`;let re=document.createElement("div");re.className="map3d__bar",re.innerHTML=`
    <button type="button" data-view="overview">Vue d\u2019ensemble</button>
    <button type="button" data-view="route">\u25B6 Le trajet depuis Tours</button>
    <button type="button" data-view="workshop">L\u2019atelier</button>`;let Pe=document.createElement("details");Pe.className="map3d__credit",Pe.innerHTML=`<summary>Sources</summary><p>${W(n.credits)}</p>`;let V=document.createElement("p");V.className="map3d__hint",V.textContent=matchMedia("(pointer: coarse)").matches?"Deux doigts pour tourner et zoomer":"Glisser pour tourner \xB7 Ctrl + molette pour zoomer",te.append(Be,re,Pe,V),a.setAttribute("role","img"),a.setAttribute("aria-label",`Carte 3D : l\u2019atelier ${nt} \xE0 Vouvray, \xE0 environ ${it} km du centre de Tours par la route, au nord de la Loire.`);let d=new Ct(T,E);d.enableDamping=!0,d.dampingFactor=.07,d.enablePan=!1,d.minDistance=700,d.maxDistance=17e3,d.minPolarAngle=.15,d.maxPolarAngle=1.25,d.rotateSpeed=.55,d.zoomSpeed=.8,d.autoRotateSpeed=.35,d.touches={ONE:null,TWO:ft.DOLLY_ROTATE},E.style.touchAction="pan-y",a.addEventListener("wheel",t=>{t.ctrlKey||t.metaKey||(t.stopPropagation(),V.classList.add("is-on"),clearTimeout(V._t),V._t=setTimeout(()=>V.classList.remove("is-on"),1400))},{capture:!0});let Nt=he.clone(),ot=()=>Math.pow(Math.max(1,1.35/T.aspect),.75),Gt={overview:()=>{let t=new u(Re+300,0,-J-600);return{target:t,pos:new u(-2900,10500,10400).multiplyScalar(ot()).add(t)}},workshop:()=>{let t=Nt.clone().add(new u(-500,0,700));return{target:t,pos:new u(-2800,2600,4300).multiplyScalar(ot()).add(t)}}},m=null,R=null;function G(t,r=2.6,s=.18){R=null;let f=Gt[t]();if(e||r===0){d.target.copy(f.target),T.position.copy(f.pos),m=null;return}m={t:0,duration:r,arc:s,p0:T.position.clone(),t0:d.target.clone(),p1:f.pos,t1:f.target}}let rt=new bt(D.map(t=>t.clone()),!1,"centripetal");function Oe(){if(e)return G("workshop",0);m=null,d.autoRotate=!1,R={t:0,duration:12}}re.addEventListener("click",t=>{let r=t.target.closest("[data-view]");r&&(d.autoRotate=!1,r.dataset.view==="route"?Oe():G(r.dataset.view),re.querySelectorAll("button").forEach(s=>s.classList.toggle("is-active",s===r)),se())}),d.addEventListener("start",()=>{m=null,R=null,d.autoRotate=!1}),d.addEventListener("change",se);let ae=new u,k=0,q=0;function at(){let t=a.getBoundingClientRect();k=Math.max(1,Math.round(t.width)),q=Math.max(1,Math.round(t.height)),A.setPixelRatio(Math.min(devicePixelRatio||1,o?1.5:2)),A.setSize(k,q,!1),T.aspect=k/q,T.updateProjectionMatrix();for(let r of Ze)r.resolution.set(k,q);se()}function st(){let t=[];for(let r of De){ae.copy(r.at).project(T);let s=(ae.x*.5+.5)*k,f=(-ae.y*.5+.5)*q,h=ae.z<1&&s>-40&&s<k+40&&f>-20&&f<q+20;if(h&&(r.w||(r.w=r.e.offsetWidth,r.h=r.e.offsetHeight),r.kind!=="pin"&&(s-r.w/2<6||s+r.w/2>k-6||f-r.h<6)&&(h=!1)),h){let L={x0:s-r.w/2-4,x1:s+r.w/2+4,y0:f-r.h-4,y1:f+4};r.kind!=="pin"&&t.some($=>$.x0<L.x1&&$.x1>L.x0&&$.y0<L.y1&&$.y1>L.y0)?h=!1:t.push(L)}r.e.classList.toggle("is-hidden",!h),h&&(r.e.style.transform=`translate3d(${s.toFixed(1)}px, ${f.toFixed(1)}px, 0) translate(-50%, -100%)`)}}let we=!0,Ie=!1,We=performance.now();function se(){Ie||!we||(Ie=!0,We=performance.now(),requestAnimationFrame(lt))}function lt(t){let r=Math.min(.05,(t-We)/1e3);if(We=t,e||(ie.value+=r),m){m.t=Math.min(1,m.t+r/m.duration);let s=Vt(m.t);T.position.lerpVectors(m.p0,m.p1,s),T.position.y+=Math.sin(Math.PI*s)*m.p0.distanceTo(m.p1)*m.arc,d.target.lerpVectors(m.t0,m.t1,s),m.t>=1&&(m=null,e||(d.autoRotate=!0))}else if(R){R.t=Math.min(1,R.t+r/R.duration);let s=Vt(R.t)*.94,f=rt.getPointAt(s),h=rt.getPointAt(Math.min(1,s+.07)),L=ae.subVectors(h,f).setY(0).normalize();T.position.set(f.x-L.x*1500,f.y+1050,f.z-L.z*1500),d.target.copy(h),R.t>=1&&(R=null,G("workshop",2.2,.05))}e||(jt.material.dashOffset=-(ie.value*1700%(He*1.4+520))),d.update(r),st(),A.render(z,T),we&&!document.hidden?requestAnimationFrame(lt):Ie=!1}new ResizeObserver(at).observe(a),new IntersectionObserver(([t])=>{we=t.isIntersecting,we&&se()},{threshold:.05}).observe(a),document.addEventListener("visibilitychange",()=>!document.hidden&&se()),G("overview",0),at(),A.render(z,T),a.classList.add("is-live");let ct=new IntersectionObserver(([t])=>{t.isIntersecting&&(ct.disconnect(),setTimeout(()=>e?G("workshop",0):Oe(),900))},{threshold:.45});ct.observe(a),window.__map3d={flyTo:G,flyRoute:Oe,render:()=>(st(),A.render(z,T)),controls:d,camera:T}}export{wn as initMap};
