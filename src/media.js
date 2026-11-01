// ============================================================
//  Media discovery: files are picked up automatically at build time
//
//  media/projects/<project-id>/   photos (jpg/png/webp/avif) and videos (mp4/webm)
//                                 shown in file-name order; a file named cover.* is the card image
//  media/certificates/<cert-id>.jpg|png|webp   scan shown on the ring
//  media/certificates/<cert-id>.pdf            original, opened in a new tab
// ============================================================

const FILES = import.meta.glob(
  '/media/**/*.{jpg,JPG,jpeg,JPEG,png,PNG,webp,WEBP,avif,AVIF,gif,GIF,mp4,MP4,webm,WEBM,m4v,M4V,mov,MOV,pdf,PDF}',
  { eager: true, query: '?url', import: 'default' }
);

const IMAGE = /\.(jpe?g|png|webp|avif|gif)$/i;
const VIDEO = /\.(mp4|webm|m4v|mov)$/i;
const PDF = /\.pdf$/i;

const byName = (a, b) => a.name.localeCompare(b.name, undefined, { numeric: true });

const projectMedia = {};
const certMedia = {};

for (const [path, url] of Object.entries(FILES)) {
  const parts = path.split('/'); // ['', 'media', 'projects', id, file]
  const file = parts[parts.length - 1];
  const name = file.replace(/\.[^.]+$/, '');

  if (parts[2] === 'projects' && parts.length === 5) {
    const id = parts[3];
    const type = IMAGE.test(file) ? 'image' : VIDEO.test(file) ? 'video' : null;
    if (!type) continue;
    (projectMedia[id] ||= []).push({ type, src: url, name });
  } else if (parts[2] === 'certificates' && parts.length === 4) {
    const entry = (certMedia[name] ||= {});
    if (IMAGE.test(file)) entry.image = url;
    else if (PDF.test(file)) entry.pdf = url;
  }
}
Object.values(projectMedia).forEach((list) => list.sort(byName));

/** All photos and videos of a project, plus any embeds from src/data/projects.js. */
export function mediaFor(project) {
  const files = projectMedia[project.id] || [];
  const embeds = (project.embeds || []).map((e) => ({ type: e.type, id: e.id, name: e.id }));
  return [...files, ...embeds];
}

/** Card image of a project: cover.* if present, otherwise its first photo. */
export function coverFor(project) {
  const files = projectMedia[project.id] || [];
  const img = files.find((f) => f.type === 'image' && /^cover$/i.test(f.name)) || files.find((f) => f.type === 'image');
  return img ? img.src : '';
}

export const certFiles = (id) => certMedia[id] || {};
