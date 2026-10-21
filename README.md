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
| Texts, experience, education, projects, certificates (per language) | `src/locales/{fa,en,de}.json` |
| Contact e-mail, LinkedIn/GitHub, language/country mapping, colours, all 3D parameters | `src/config.js` |
| Look & layout | `src/styles.css` |
| 3D scene | `src/scene.js` |

Certificate images/PDFs: put them in `public/certs/` and set `"link": "./certs/name.pdf"` in the JSON files.

## Deployment (CI/CD)
Every push to `main` runs `.github/workflows/deploy.yml` (install, build, deploy to GitHub Pages).
One-time setup: GitHub repo -> Settings -> Pages -> Source: **GitHub Actions**.

### Custom domain (later)
Add a file `public/CNAME` containing `ehsannouri.de`, set the DNS records at your registrar
(A records for GitHub Pages / CNAME for `www`), and enable "Enforce HTTPS" in Pages settings.
