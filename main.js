import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls';
import { gsap } from 'gsap';
import { inject } from '@vercel/analytics';

// Initialize Vercel Analytics
inject();

// Scene setup
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(window.devicePixelRatio);
document.body.appendChild(renderer.domElement);

// Camera position
camera.position.z = 30;

// Controls
const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.dampingFactor = 0.05;
controls.maxDistance = 50;
controls.minDistance = 10;

// Particles
const particlesGeometry = new THREE.BufferGeometry();
const particlesCount = 2000;
const posArray = new Float32Array(particlesCount * 3);
const colors = new Float32Array(particlesCount * 3);
const velocities = new Float32Array(particlesCount * 3);

for(let i = 0; i < particlesCount * 3; i += 3) {
    // Position
    const angle = Math.random() * Math.PI * 2;
    const radius = 10 + Math.random() * 5;
    const height = (Math.random() - 0.5) * 20;
    
    posArray[i] = Math.cos(angle) * radius;
    posArray[i + 1] = height;
    posArray[i + 2] = Math.sin(angle) * radius;
    
    // Color
    colors[i] = Math.random();
    colors[i + 1] = Math.random();
    colors[i + 2] = 1;

    // Velocity - first 200 particles will move faster
    if (i < 600) { // 200 * 3 since each particle uses 3 values
        velocities[i] = (Math.random() - 0.5) * 0.1;
        velocities[i + 1] = (Math.random() - 0.5) * 0.1;
        velocities[i + 2] = (Math.random() - 0.5) * 0.1;
    } else {
        velocities[i] = 0;
        velocities[i + 1] = 0;
        velocities[i + 2] = 0;
    }
}

particlesGeometry.setAttribute('position', new THREE.BufferAttribute(posArray, 3));
particlesGeometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));

// Material
const particlesMaterial = new THREE.PointsMaterial({
    size: 0.1,
    vertexColors: true,
    blending: THREE.AdditiveBlending,
    transparent: true
});

// Points
const particlesMesh = new THREE.Points(particlesGeometry, particlesMaterial);
scene.add(particlesMesh);

// Core
const coreGroup = new THREE.Group();

// Inner core (energy ball with spikes)
const innerCoreGeometry = new THREE.IcosahedronGeometry(2, 5); 
const innerCoreMaterial = new THREE.ShaderMaterial({
    uniforms: {
        time: { value: 0 },
        color: { value: new THREE.Color(0xff00ff) }
    },
    vertexShader: `
        uniform float time;
        
        varying vec3 vNormal;
        varying vec2 vUv;
        
        //	Simplex 3D Noise 
        //	by Ian McEwan, Ashima Arts
        vec4 permute(vec4 x){return mod(((x*34.0)+1.0)*x, 289.0);}
        vec4 taylorInvSqrt(vec4 r){return 1.79284291400159 - 0.85373472095314 * r;}
        
        float snoise(vec3 v){ 
            const vec2  C = vec2(1.0/6.0, 1.0/3.0) ;
            const vec4  D = vec4(0.0, 0.5, 1.0, 2.0);
            
            // First corner
            vec3 i  = floor(v + dot(v, C.yyy) );
            vec3 x0 =   v - i + dot(i, C.xxx) ;
            
            // Other corners
            vec3 g = step(x0.yzx, x0.xyz);
            vec3 l = 1.0 - g;
            vec3 i1 = min( g.xyz, l.zxy );
            vec3 i2 = max( g.xyz, l.zxy );
            
            vec3 x1 = x0 - i1 + 1.0 * C.xxx;
            vec3 x2 = x0 - i2 + 2.0 * C.xxx;
            vec3 x3 = x0 - 1. + 3.0 * C.xxx;
            
            // Permutations
            i = mod(i, 289.0 ); 
            vec4 p = permute( permute( permute( 
                        i.z + vec4(0.0, i1.z, i2.z, 1.0 ))
                    + i.y + vec4(0.0, i1.y, i2.y, 1.0 )) 
                    + i.x + vec4(0.0, i1.x, i2.x, 1.0 ));
                    
            // Gradients
            float n_ = 1.0/7.0; // N=7
            vec3  ns = n_ * D.wyz - D.xzx;
            
            vec4 j = p - 49.0 * floor(p * ns.z *ns.z);  //  mod(p,N*N)
            
            vec4 x_ = floor(j * ns.z);
            vec4 y_ = floor(j - 7.0 * x_ );    // mod(j,N)
            
            vec4 x = x_ *ns.x + ns.yyyy;
            vec4 y = y_ *ns.x + ns.yyyy;
            vec4 h = 1.0 - abs(x) - abs(y);
            
            vec4 b0 = vec4( x.xy, y.xy );
            vec4 b1 = vec4( x.zw, y.zw );
            
            vec4 s0 = floor(b0)*2.0 + 1.0;
            vec4 s1 = floor(b1)*2.0 + 1.0;
            vec4 sh = -step(h, vec4(0.0));
            
            vec4 a0 = b0.xzyw + s0.xzyw*sh.xxyy ;
            vec4 a1 = b1.xzyw + s1.xzyw*sh.zzww ;
            
            vec3 p0 = vec3(a0.xy,h.x);
            vec3 p1 = vec3(a0.zw,h.y);
            vec3 p2 = vec3(a1.xy,h.z);
            vec3 p3 = vec3(a1.zw,h.w);
            
            //Normalise gradients
            vec4 norm = taylorInvSqrt(vec4(dot(p0,p0), dot(p1,p1), dot(p2, p2), dot(p3,p3)));
            p0 *= norm.x;
            p1 *= norm.y;
            p2 *= norm.z;
            p3 *= norm.w;
            
            // Mix final noise value
            vec4 m = max(0.6 - vec4(dot(x0,x0), dot(x1,x1), dot(x2,x2), dot(x3,x3)), 0.0);
            m = m * m;
            return 42.0 * dot( m*m, vec4( dot(p0,x0), dot(p1,x1), 
                                        dot(p2,x2), dot(p3,x3) ) );
        }
        
        void main() {
            vNormal = normal;
            vUv = uv;
            
            // Create constant base spikes with animation overlay
            float baseNoise = snoise(vec3(position.x * 8.0, position.y * 8.0, position.z * 8.0)); // Static base spikes
            float animNoise = snoise(vec3(position.x * 3.0, position.y * 3.0, position.z * 3.0 + time * 2.0)); 
            
            // Maintain minimum spike height while still allowing animation
            float spikeIntensity = 0.7 + pow(sin(time * 8.0) * 0.5 + 0.5, 1.5) * 0.3; 
            
            // Multiple frequency waves with constant base
            float baseWave1 = pow(sin(position.x * 25.0), 3.0) * 0.1;
            float baseWave2 = pow(sin(position.y * 25.0), 3.0) * 0.1;
            float baseWave3 = pow(sin(position.z * 25.0), 3.0) * 0.1;
            
            // Animated wave overlay
            float wave1 = pow(sin(position.x * 15.0 + time * 5.0), 3.0) * 0.05;
            float wave2 = pow(sin(position.y * 12.0 + time * 4.0), 3.0) * 0.05;
            float wave3 = pow(sin(position.z * 18.0 + time * 6.0), 3.0) * 0.05;
            
            // High frequency detail for constant sharp points
            float detail1 = pow(sin(position.x * 40.0), 5.0) * 0.03;
            float detail2 = pow(sin(position.y * 35.0), 5.0) * 0.03;
            float detail3 = pow(sin(position.z * 45.0), 5.0) * 0.03;
            
            // Animated high frequency detail
            float animDetail1 = pow(sin(position.x * 30.0 + time * 7.0), 5.0) * 0.02;
            float animDetail2 = pow(sin(position.y * 25.0 + time * 6.0), 5.0) * 0.02;
            float animDetail3 = pow(sin(position.z * 35.0 + time * 8.0), 5.0) * 0.02;
            
            // Combine static and animated components
            float staticSpikes = pow((baseNoise + baseWave1 + baseWave2 + baseWave3 + detail1 + detail2 + detail3), 3.0) * 0.6;
            float animatedSpikes = pow((animNoise + wave1 + wave2 + wave3 + animDetail1 + animDetail2 + animDetail3), 3.0) * 0.4;
            
            // Final position with constant spikes plus animation
            vec3 spikedPosition = position + normal * (staticSpikes + animatedSpikes * spikeIntensity) * 0.8;
            
            gl_Position = projectionMatrix * modelViewMatrix * vec4(spikedPosition, 1.0);
        }
    `,
    fragmentShader: `
        uniform float time;
        uniform vec3 color;
        
        varying vec3 vNormal;
        varying vec2 vUv;
        
        void main() {
            // Create constant glow with animated pulse overlay
            float basePulse = 0.7;  // Constant base glow
            float animPulse = pow(sin(time * 8.0) * 0.5 + 0.5, 2.0) * 0.3;
            float edge = pow(1.0 - dot(vNormal, vec3(0.0, 0.0, 1.0)), 1.2);
            
            vec3 finalColor = mix(color, vec3(1.0), edge * (basePulse + animPulse));
            float alpha = 0.95 + edge * 0.05;
            
            gl_FragColor = vec4(finalColor, alpha);
        }
    `,
    transparent: true,
    side: THREE.DoubleSide
});

const innerCore = new THREE.Mesh(innerCoreGeometry, innerCoreMaterial);
coreGroup.add(innerCore);

// Middle layer (energy field)
const middleCoreGeometry = new THREE.SphereGeometry(2.5, 32, 32);
const middleCoreMaterial = new THREE.ShaderMaterial({
    uniforms: {
        time: { value: 0 }
    },
    vertexShader: `
        varying vec2 vUv;
        void main() {
            vUv = uv;
            gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
    `,
    fragmentShader: `
        uniform float time;
        varying vec2 vUv;
        void main() {
            vec2 uv = vUv;
            float t = time * 2.0;
            
            // Create energy field pattern
            float pattern = sin(uv.x * 20.0 + t) * sin(uv.y * 20.0 + t) * 0.5 + 0.5;
            pattern *= sin(length(uv - 0.5) * 10.0 + t) * 0.5 + 0.5;
            
            // Dynamic color mixing
            vec3 color1 = vec3(1.0, 0.0, 1.0); // Magenta
            vec3 color2 = vec3(0.0, 1.0, 1.0); // Cyan
            vec3 color3 = vec3(0.5, 0.0, 1.0); // Purple
            
            float t1 = sin(time) * 0.5 + 0.5;
            float t2 = sin(time * 1.5) * 0.5 + 0.5;
            
            vec3 color = mix(
                mix(color1, color2, t1),
                color3,
                t2 * pattern
            );
            
            gl_FragColor = vec4(color, 0.3);
        }
    `,
    transparent: true,
    side: THREE.DoubleSide
});
const middleCore = new THREE.Mesh(middleCoreGeometry, middleCoreMaterial);
coreGroup.add(middleCore);

// Outer shell
const outerCoreGeometry = new THREE.SphereGeometry(3, 32, 32);
const outerCoreMaterial = new THREE.MeshPhongMaterial({
    color: 0x7700ff, // Changed to purple
    transparent: true,
    opacity: 0.2,
    shininess: 100,
    specular: 0x00ffff // Keeping cyan specular highlights
});
const outerCore = new THREE.Mesh(outerCoreGeometry, outerCoreMaterial);
coreGroup.add(outerCore);

// Energy rings
const ringGeometry = new THREE.TorusGeometry(3.2, 0.1, 16, 100);
const ringMaterial1 = new THREE.MeshBasicMaterial({
    color: 0xff00ff, // Magenta ring
    transparent: true,
    opacity: 0.3
});
const ringMaterial2 = new THREE.MeshBasicMaterial({
    color: 0x00ffff, // Cyan ring
    transparent: true,
    opacity: 0.3
});
const ringMaterial3 = new THREE.MeshBasicMaterial({
    color: 0x7700ff, // Purple ring
    transparent: true,
    opacity: 0.3
});

const ring1 = new THREE.Mesh(ringGeometry, ringMaterial1);
const ring2 = new THREE.Mesh(ringGeometry, ringMaterial2);
const ring3 = new THREE.Mesh(ringGeometry, ringMaterial3);

ring1.rotation.x = Math.PI / 2;
ring2.rotation.y = Math.PI / 2;
ring3.rotation.z = Math.PI / 3; // Angled differently for more visual interest

coreGroup.add(ring1);
coreGroup.add(ring2);
coreGroup.add(ring3);

scene.add(coreGroup);

// Add point light in the core
const coreLight = new THREE.PointLight(0xff00ff, 2, 10); // Changed to magenta
const coreLightCyan = new THREE.PointLight(0x00ffff, 1.5, 8); // Added cyan light
coreGroup.add(coreLight);
coreGroup.add(coreLightCyan);

// Lines between particles
const linesMaterial = new THREE.LineBasicMaterial({
    color: 0x00ffff,
    transparent: true,
    opacity: 0.1
});

function createLines() {
    const positions = particlesGeometry.attributes.position.array;
    const linesGeometry = new THREE.BufferGeometry();
    const linePositions = [];

    for(let i = 0; i < positions.length; i += 3) {
        const x1 = positions[i];
        const y1 = positions[i + 1];
        const z1 = positions[i + 2];

        for(let j = i + 3; j < positions.length; j += 3) {
            const x2 = positions[j];
            const y2 = positions[j + 1];
            const z2 = positions[j + 2];

            const distance = Math.sqrt(
                Math.pow(x2 - x1, 2) +
                Math.pow(y2 - y1, 2) +
                Math.pow(z2 - z1, 2)
            );

            if(distance < 3) {
                linePositions.push(x1, y1, z1);
                linePositions.push(x2, y2, z2);
            }
        }
    }

    linesGeometry.setAttribute('position', new THREE.Float32BufferAttribute(linePositions, 3));
    return new THREE.LineSegments(linesGeometry, linesMaterial);
}

const lines = createLines();
scene.add(lines);

// Animation
let time = 0;
function animate() {
    requestAnimationFrame(animate);
    
    time += 0.001;
    
    // Update particle positions
    const positions = particlesGeometry.attributes.position.array;
    for(let i = 0; i < positions.length; i += 3) {
        if (i < 600) { // Only move the first 200 particles
            positions[i] += velocities[i];
            positions[i + 1] += velocities[i + 1];
            positions[i + 2] += velocities[i + 2];

            // Keep particles within bounds
            const distance = Math.sqrt(
                positions[i] * positions[i] + 
                positions[i + 1] * positions[i + 1] + 
                positions[i + 2] * positions[i + 2]
            );

            if (distance > 15) {
                const scale = 15 / distance;
                positions[i] *= scale;
                positions[i + 1] *= scale;
                positions[i + 2] *= scale;
                
                // Reverse velocity when hitting boundary
                velocities[i] *= -1;
                velocities[i + 1] *= -1;
                velocities[i + 2] *= -1;
            }
        }
    }
    particlesGeometry.attributes.position.needsUpdate = true;
    
    // Rotate particles
    particlesMesh.rotation.y = time * 0.1;
    
    // Animate core
    // Pulse inner core
    innerCoreMaterial.uniforms.time.value = time;
    const hue = (Math.sin(time) + 1) * 0.5;
    const color = new THREE.Color().setHSL(hue, 1, 0.5);
    innerCoreMaterial.uniforms.color.value = color;
    
    // Rotate middle layer
    middleCore.rotation.y = time;
    middleCore.rotation.z = time * 0.5;
    middleCoreMaterial.uniforms.time.value = time;
    
    // Pulse outer shell
    outerCore.scale.x = 1 + Math.sin(time * 2) * 0.05;
    outerCore.scale.y = 1 + Math.sin(time * 2) * 0.05;
    outerCore.scale.z = 1 + Math.sin(time * 2) * 0.05;
    
    // Rotate rings
    ring1.rotation.z = time;
    ring2.rotation.x = time;
    ring3.rotation.y = time * 0.7; // Slightly slower rotation for variety
    
    // Pulse light intensity with color changes
    coreLight.intensity = 2 + Math.sin(time * 4) * 0.5;
    coreLightCyan.intensity = 1.5 + Math.cos(time * 4) * 0.5; // Alternate with main light
    
    // Update controls
    controls.update();
    
    renderer.render(scene, camera);
}

// Handle window resize
window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
});

// Start animation
animate();
