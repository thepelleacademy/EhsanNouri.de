// ============================================================
//  Projects: language-independent data
//  Texts (title, summary, work) live in src/locales/*.json -> projects.items.<id>
//  Photos & videos: drop files into  media/projects/<id>/  (see README)
// ============================================================
//  cat:    mechanical | electronics | software | research
//  status: completed | in_progress | prototype
//  links:  [{ label: 'GitHub', url: 'https://...' }]
//  embeds: [{ type: 'youtube', id: 'VIDEO_ID' }]   (optional, for videos hosted elsewhere)

export const PROJECTS = [
  { id: 'satellite-container', cat: 'mechanical', status: 'completed', year: "2018\u20132021", tags: ["MIL-STD", "ANSYS FEA", "CAD", "Integration"], links: [], embeds: [] },
  { id: 'wire-rope-isolator', cat: 'mechanical', status: 'completed', year: "2018\u20132021", tags: ["MIL-STD-810", "Shock", "Vibration"], links: [], embeds: [] },
  { id: 'helicopter-rig', cat: 'mechanical', status: 'completed', year: "2018\u20132021", tags: ["2-DOF", "Actuation", "Instrumentation"], links: [], embeds: [] },
  { id: 'propeller-rig', cat: 'mechanical', status: 'completed', year: "2018\u20132021", tags: ["Aerodynamics", "Thrust"], links: [], embeds: [] },
  { id: 'hybrid-solar-wind', cat: 'mechanical', status: 'prototype', year: "2018\u20132021", tags: ["Renewable energy", "Prototype"], links: [], embeds: [] },
  { id: 'needle-nozzle', cat: 'research', status: 'completed', year: "2022\u20132023", tags: ["FDM", "Needle insertion", "Tensile testing"], links: [], embeds: [] },
  { id: 'mycusini', cat: 'research', status: 'completed', year: "2023", tags: ["Extrusion", "Firmware", "Thermal"], links: [], embeds: [] },
  { id: 'accelerometer-logger', cat: 'electronics', status: 'completed', year: null, tags: ["MEMS", "Altium Designer", "Firmware"], links: [], embeds: [] },
  { id: 'temp-humidity-logger', cat: 'electronics', status: 'completed', year: null, tags: ["SHT-10", "Bluetooth", "Altium Designer"], links: [], embeds: [] },
  { id: 'motion-tracker', cat: 'electronics', status: 'in_progress', year: null, tags: ["ESP32-C3", "MPU6050", "Android"], links: [], embeds: [] },
  { id: 'pdf-annotator', cat: 'software', status: 'in_progress', year: null, tags: ["Kotlin", "Jetpack Compose", "Android"], links: [], embeds: [] },
  { id: 'vr-scooter', cat: 'software', status: 'in_progress', year: null, tags: ["Unity", "C#", "Python", "VR"], links: [], embeds: [] },
  { id: 'handwriting-cnc', cat: 'mechanical', status: 'in_progress', year: null, tags: ["G-code", "CNC", "Python"], links: [], embeds: [] },
];
