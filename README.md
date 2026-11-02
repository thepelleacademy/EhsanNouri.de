# EhsanNouri.de

Personal portfolio of Ehsan Nouri. One-screen layout with a 3D wireframe hero, a 3D ring of certificates,
three languages (Persian RTL, English, German) and six themes (three neon on black, three light).
All texts and data are edited in the admin panel at **ehsannouri.de/admin**; saving there commits to this
repository and GitHub Actions deploys the site.

```
content/        all texts and data (JSON, edited in /admin)
media/          project photos/videos and certificate scans (uploaded in /admin)
public/         photo (img/), CV (files/), favicon, robots.txt
src/            the site (Vite + three.js)
admin/          the admin panel (/admin)
```

## Admin panel (`/admin`)

### First login on a device
1. Create a **fine-grained token** on GitHub: <https://github.com/settings/personal-access-tokens/new>
   - Resource owner: `thepelleacademy`
   - Repository access: *Only select repositories* → `EhsanNouri.de`
   - Permissions → Repository: **Contents: Read and write**, **Actions: Read-only**
   - Expiration: e.g. one year
2. Open `ehsannouri.de/admin`, paste the token and choose a panel password (≥ 10 characters).

The token is stored only in that browser, encrypted with the password (PBKDF2-SHA-256, 600 000 iterations →
AES-GCM-256). Afterwards the password alone unlocks the panel on that device. The panel locks itself after
30 minutes without activity. "قطع اتصال این دستگاه" removes the token from the browser.
If the token expires, create a new one and connect again.

### What can be edited
| Section | File |
|---|---|
| Menu and sub menus (order, names, hide, links to sections, filters, pages, projects, URLs; mobile tab bar; overview tiles) | `content/nav.json` |
| Home: name, role, intro, chips, buttons | `content/home.json` |
| About: text, facts, skill groups | `content/about.json` |
| Career: work and education | `content/career.json` |
| Projects, categories, photos/videos, YouTube, links | `content/projects.json`, `media/projects/<id>/` |
| Certificates, groups, issuers, scans/PDFs | `content/certificates.json`, `media/certificates/<id>.jpg/.pdf` |
| Custom pages (Markdown), e.g. Publications | `content/pages.json` → `#/page/<id>` |
| Contact, footer, imprint and privacy text | `content/contact.json` |
| Settings: e-mail, phone, links, photo, CV, imprint address, languages, default theme | `content/site.json` |
| Interface strings (buttons, small messages) | `content/ui/{fa,en,de}.json` |

Every multilingual value is `{ "fa": "…", "en": "…", "de": "…" }`; an empty language falls back to English.

### Save and deploy
"ذخیره و انتشار" creates **one commit** with all text changes and uploads (Git Data API). The push to `main`
starts `.github/workflows/deploy.yml`; the panel shows the build status. The site is updated about 1–2
minutes later. If someone changed the same file on GitHub in the meantime, the panel asks before overwriting.

Unsaved text changes are kept in the browser (restored after a reload). "پیش‌نمایش" opens the site with
those changes (`/?preview`, only in that browser; it reloads itself when you edit). Uploaded files stay in the
page until saved.

### Settings of the panel
`admin/config.js`: repository, branch, password length, PBKDF2 work factor, auto-lock time, upload limit
(50 MB per file), deploy polling. Form layout tokens are at the top of `admin/admin.css`.
What each section edits is declared in `admin/schemas.js`.

## Develop
```bash
npm install
npm run dev      # http://localhost:5173  and  http://localhost:5173/admin/
npm run build    # output in dist/ (site + dist/admin/)
```

## Photos and videos
Uploaded in the panel, or by hand:
```
media/projects/<project-id>/
  cover.jpg        # image on the project card (otherwise the first photo)
  01-assembly.jpg  # shown in file-name order
  02-test.mp4
media/certificates/<cert-id>.jpg   # scan shown on the ring
media/certificates/<cert-id>.pdf   # original, "Open PDF"
```
- Photos: jpg, png, webp, avif, under ~2500 px wide. Videos: mp4 (H.264), small files; long videos go to YouTube.
  `ffmpeg -i in.mov -vf "scale=1600:-2" -c:v libx264 -crf 26 -preset veryfast -c:a aac -b:a 128k -movflags +faststart out.mp4`

## Addresses
`#/projects`, `#/projects?cat=<category>`, `#/projects/<id>`, `#/certificates`, `#/certificates?group=<group>`,
`#/certificates/<id>`, `#/career`, `#/about`, `#/contact`, `#/page/<id>`, `#/legal`. `?lang=fa|en|de` forces a language.

## Language
Order: `?lang=` → the visitor's earlier choice → country from Cloudflare (`/cdn-cgi/trace`, same domain,
no third-party service) → browser language → default. Country table and default: Settings in the panel.

## Technical settings
`src/config.js` (3D hero, certificate ring, menu sizes) and the colour tokens at the top of `src/styles.css`.

## Deployment
Every push to `main` runs `.github/workflows/deploy.yml`: build, then rsync of `dist/` to the server over SSH.
Secrets: `SSH_HOST`, `SSH_PORT`, `SSH_USER`, `SSH_PRIVATE_KEY`, `SSH_KNOWN_HOSTS`, `DEPLOY_PATH`.
`/admin/` is a static folder in `dist/`; the web server needs no extra configuration.
