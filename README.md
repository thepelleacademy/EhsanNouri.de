# EhsanNouri.de

Personal portfolio: neon 3D (Three.js) landing site, responsive, in Persian (RTL), English and German.
The language is chosen from the visitor's country (IP lookup), then the browser language; the visitor can switch manually.

## Develop
```bash
npm install
npm run dev      # http://localhost:5173
npm run build    # output in dist/
```

## Where to edit
| What | File |
|---|---|
| Texts per language (profile, education, experience, skills, contact, UI labels) | `src/locales/{fa,en,de}.json` |
| Projects: status, category, year, tags, images, link | `src/locales/*.json` → `projects.items` (same index in all three files) |
| Contact, photo, phone, language/country mapping, palette, 3D viewer parameters | `src/config.js` |
| Look & layout (all values are named tokens at the top of the file) | `src/styles.css` |
| Hero 3D wireframe part | `src/scene.js` |

Project status values: `completed`, `in_progress`, `prototype`.
Project photos: put files in `public/projects/` and set `"images": ["./projects/name.jpg"]` in the JSON.
Certificate PDFs/images: put them in `public/certs/` and set `"link"` in the JSON.

## Deployment (CI/CD)
Every push to `main` runs `.github/workflows/deploy.yml` (install, build, deploy to GitHub Pages).
One-time setup: GitHub repo -> Settings -> Pages -> Source: **GitHub Actions**.

### Custom domain (later)
Add a file `public/CNAME` containing `ehsannouri.de`, set the DNS records at your registrar
(A records for GitHub Pages / CNAME for `www`), and enable "Enforce HTTPS" in Pages settings.
