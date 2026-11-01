# EhsanNouri.de

Personal portfolio of Ehsan Nouri. One-screen layout: an overview with tiles, and a panel for each section
(About, Career, Projects, Certificates, Contact). Three languages (Persian RTL, English, German), six themes
(three neon on black, three light engineering themes), a 3D wireframe hero and a 3D ring of certificates.

## Develop
```bash
npm install
npm run dev      # http://localhost:5173
npm run build    # output in dist/
```

## Add photos and videos to a project
Drop the files into the project's folder and push. Nothing else to edit.
```
media/projects/<project-id>/
  cover.jpg        # optional: image shown on the project card (otherwise the first photo)
  01-assembly.jpg  # shown in file-name order
  02-test.mp4
```
- Photos: jpg, png, webp, avif. Keep them under ~2500 px wide.
- Videos: mp4 (H.264) plays everywhere; keep each file small (GitHub rejects files over 100 MB).
  Shrink a video:
  `ffmpeg -i in.mov -vf "scale=1600:-2" -c:v libx264 -crf 26 -preset veryfast -c:a aac -b:a 128k -movflags +faststart out.mp4`
- Videos on YouTube: add `embeds: [{ type: 'youtube', id: 'VIDEO_ID' }]` to the project in `src/data/projects.js`.
- Project ids are the folder names (see `src/data/projects.js`).

## Add certificate scans
```
media/certificates/<cert-id>.jpg   # scan or photo, shown on the ring and in the viewer
media/certificates/<cert-id>.pdf   # optional original, opened with "Open PDF"
```
Certificate ids: `cswa`, `cswa-am`, `cswa-xdesign`, `cswa-xshape`, `cswa-xmold`, `cswa-e`, `cswa-sd`,
`catia-v5`, `ansys`, `abaqus`, `python`. Until a scan exists, a generated certificate face is shown.

New certificate: add a line to `src/data/certificates.js` and its texts to
`src/locales/{fa,en,de}.json` → `certificates.items.<id>`.

## Where to edit
| What | File |
|---|---|
| Texts in each language | `src/locales/{fa,en,de}.json` |
| Project data (category, status, year, tags, links, YouTube) | `src/data/projects.js` |
| Certificate data (group, issuer, year, verify link) | `src/data/certificates.js` |
| Contact, photo, imprint address, languages, 3D and ring settings | `src/config.js` |
| Theme colours and layout sizes (named tokens at the top) | `src/styles.css` |

## Addresses
`#/projects`, `#/projects/<id>`, `#/certificates`, `#/certificates/<id>`, `#/career`, `#/about`, `#/contact`, `#/legal`.
`?lang=fa|en|de` forces a language.

## Language
Order: `?lang=` → the visitor's earlier choice → country from Cloudflare (`/cdn-cgi/trace`, same domain,
no third-party service) → browser language → English.

## Deployment
Every push to `main` runs `.github/workflows/deploy.yml`: build, then rsync of `dist/` to the server over SSH.
Secrets: `SSH_HOST`, `SSH_PORT`, `SSH_USER`, `SSH_PRIVATE_KEY`, `SSH_KNOWN_HOSTS`, `DEPLOY_PATH`.
