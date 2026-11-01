// ============================================================
//  Certificates: language-independent data
//  Texts (title, detail) live in src/locales/*.json -> certificates.items.<id>
//  Scan / photo of the certificate:  media/certificates/<id>.jpg|png|webp
//  Original PDF (optional):          media/certificates/<id>.pdf
// ============================================================
//  group:  solidworks | cae | software   (used by the filter chips)
//  issuer: key into certificates.issuers in the locale files
//  verify: optional URL where the certificate can be verified online

export const CERTIFICATES = [
  { id: 'cswa', group: 'solidworks', issuer: 'dassault', year: '2026', code: 'CSWA', verify: '' },
  { id: 'cswa-am', group: 'solidworks', issuer: 'dassault', year: '2026', code: 'CSWA-AM', verify: '' },
  { id: 'cswa-xdesign', group: 'solidworks', issuer: 'dassault', year: '2026', code: 'CSWA-xDesign', verify: '' },
  { id: 'cswa-xshape', group: 'solidworks', issuer: 'dassault', year: '2026', code: 'CSWA-xShape', verify: '' },
  { id: 'cswa-xmold', group: 'solidworks', issuer: 'dassault', year: '2026', code: 'CSWA-xMold', verify: '' },
  { id: 'cswa-e', group: 'solidworks', issuer: 'dassault', year: '2026', code: 'CSWA-E', verify: '' },
  { id: 'cswa-sd', group: 'solidworks', issuer: 'dassault', year: '2026', code: 'CSWA-SD', verify: '' },
  { id: 'catia-v5', group: 'cae', issuer: 'parspajouhan', year: '2020', code: 'CATIA V5', verify: '' },
  { id: 'ansys', group: 'cae', issuer: 'sharif', year: '2019', code: 'ANSYS', verify: '' },
  { id: 'abaqus', group: 'cae', issuer: 'sharif', year: '2019', code: 'ABAQUS', verify: '' },
  { id: 'python', group: 'software', issuer: 'sematec', year: '2024', code: 'PYTHON', verify: '' },
];
