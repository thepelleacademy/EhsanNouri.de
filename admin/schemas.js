// ============================================================
//  What each section of the admin panel edits.
//  Fields use the spec described at the top of forms.js.
// ============================================================
import { pick, LANGS } from './forms.js';
import { PICKABLE_ICONS } from '../src/icons.js';
import { THEMES } from '../src/config.js';

const F = {
  site: 'content/site.json',
  nav: 'content/nav.json',
  home: 'content/home.json',
  about: 'content/about.json',
  career: 'content/career.json',
  projects: 'content/projects.json',
  certificates: 'content/certificates.json',
  contact: 'content/contact.json',
  pages: 'content/pages.json',
};
export const FILES = F;

export const uid = (prefix) => `${prefix}-${Math.random().toString(36).slice(2, 8)}`;
const ML = () => ({ fa: '', en: '', de: '' });
const MLL = () => ({ fa: [], en: [], de: [] });
const SLUG_HELP = 'فقط حروف کوچک انگلیسی، عدد و خط تیره (مثل <code>my-project</code>). بعد از اولین ذخیره قفل می‌شود.';

// ---------- option lists ----------
const SECTION_LABEL = {
  overview: 'نمای کلی (صفحه اول)',
  about: 'درباره من',
  career: 'سوابق',
  projects: 'پروژه‌ها',
  certificates: 'گواهینامه‌ها',
  contact: 'تماس',
};
const SECTION_OPTS = Object.entries(SECTION_LABEL).map(([value, label]) => ({ value, label }));
const NAV_TYPES = [
  { value: 'section', label: 'بخش سایت' },
  { value: 'page', label: 'صفحه دلخواه' },
  { value: 'project', label: 'یک پروژه' },
  { value: 'certificate', label: 'یک گواهینامه' },
  { value: 'url', label: 'لینک بیرونی' },
];
const STATUS_OPTS = [
  { value: 'completed', label: 'تکمیل‌شده' },
  { value: 'in_progress', label: 'در حال انجام' },
  { value: 'prototype', label: 'نمونه اولیه' },
];
const ICON_OPTS = PICKABLE_ICONS.map((x) => ({ value: x, label: x }));
const LANG_OPTS = LANGS.map((l) => ({ value: l, label: { fa: 'فارسی', en: 'English', de: 'Deutsch' }[l] }));

const d = (ctx, file) => ctx.data[file] || {};
const catOpts = (ctx) => (d(ctx, F.projects).categories || []).map((c) => ({ value: c.id, label: `${pick(c.label)} (${c.id})` }));
const groupOpts = (ctx) => (d(ctx, F.certificates).groups || []).map((g) => ({ value: g.id, label: `${pick(g.label)} (${g.id})` }));
const issuerOpts = (ctx) => (d(ctx, F.certificates).issuers || []).map((g) => ({ value: g.id, label: `${pick(g.name)} (${g.id})` }));
const pageOpts = (ctx) => (d(ctx, F.pages).items || []).map((p) => ({ value: p.id, label: `${pick(p.title)} (${p.id})` }));
const projectOpts = (ctx) => (d(ctx, F.projects).items || []).map((p) => ({ value: p.id, label: pick(p.title) || p.id }));
const certOpts = (ctx) => (d(ctx, F.certificates).items || []).map((p) => ({ value: p.id, label: pick(p.title) || p.id }));

const firstOf = (opts) => (opts[0] ? opts[0].value : '');
const TARGET_DEFAULT = {
  section: () => 'about',
  page: (ctx) => firstOf(pageOpts(ctx)),
  project: (ctx) => firstOf(projectOpts(ctx)),
  certificate: (ctx) => firstOf(certOpts(ctx)),
  url: () => '',
};

const youtubeId = (s) => {
  const m = /(?:youtu\.be\/|v=|embed\/|shorts\/)([\w-]{6,})/.exec(String(s || ''));
  return m ? m[1] : String(s || '').trim();
};

// ---------- menu ----------
function navFields(isChild) {
  return [
    { key: 'label', label: 'عنوان در منو', type: 'text', ml: true },
    {
      key: 'type',
      label: 'به کجا برود؟',
      type: 'select',
      options: NAV_TYPES,
      rerender: true,
      onChange: (ctx, { parent, newValue }) => {
        parent.target = TARGET_DEFAULT[newValue]?.(ctx) ?? '';
        delete parent.filter;
        if (newValue === 'url') parent.href = parent.href || 'https://';
      },
    },
    { key: 'target', label: 'بخش', type: 'select', options: SECTION_OPTS, when: (p) => p.type === 'section', rerender: true, onChange: (ctx, { parent }) => delete parent.filter },
    {
      key: 'filter',
      label: 'فقط این دسته نمایش داده شود',
      type: 'select',
      options: (ctx, p) => [{ value: '', label: '— همه —' }, ...(p.target === 'projects' ? catOpts(ctx) : groupOpts(ctx))],
      when: (p) => p.type === 'section' && (p.target === 'projects' || p.target === 'certificates'),
      help: 'برای زیرمنوهایی مثل «پروژه‌ها › مکانیک».',
    },
    { key: 'target', label: 'صفحه', type: 'select', options: pageOpts, when: (p) => p.type === 'page', help: 'صفحه‌ها را در بخش «صفحه‌ها» بسازید.' },
    { key: 'target', label: 'پروژه', type: 'select', options: projectOpts, when: (p) => p.type === 'project' },
    { key: 'target', label: 'گواهینامه', type: 'select', options: certOpts, when: (p) => p.type === 'certificate' },
    { key: 'href', label: 'آدرس (URL)', type: 'text', dir: 'ltr', when: (p) => p.type === 'url', placeholder: 'https://' },
    { key: 'newTab', label: 'در زبانه جدید باز شود', type: 'bool', when: (p) => p.type === 'url' },
    ...(isChild ? [] : [{ key: 'icon', label: 'آیکون', type: 'select', options: ICON_OPTS }]),
    { key: 'visible', label: 'نمایش در منو', type: 'bool' },
    ...(isChild
      ? []
      : [
          { key: 'dock', label: 'در نوار پایین موبایل', type: 'bool' },
          { key: 'tile', label: 'کاشی در صفحه اول', type: 'bool', rerender: true },
          {
            key: 'tileText',
            label: 'متن کاشی صفحه اول',
            type: 'text',
            ml: true,
            when: (p) => p.tile !== false && !(p.type === 'section' && p.target === 'overview'),
            help: '<code>{n}</code> با تعداد پروژه‌ها یا گواهینامه‌ها جایگزین می‌شود.',
          },
          {
            key: 'children',
            label: 'زیرمنو',
            type: 'array',
            addLabel: 'افزودن زیرمنو',
            item: {
              title: (it) => `${pick(it.label) || '—'}  ·  ${navTargetText(it)}`,
              create: (ctx) => ({ id: uid('nav'), type: 'page', target: TARGET_DEFAULT.page(ctx), label: ML(), visible: true }),
              fields: navFields(true),
            },
          },
        ]),
  ];
}
function navTargetText(it) {
  if (it.type === 'section') return `${SECTION_LABEL[it.target] || it.target}${it.filter ? ` › ${it.filter}` : ''}`;
  if (it.type === 'url') return it.href || 'URL';
  return `${(NAV_TYPES.find((x) => x.value === it.type) || {}).label || it.type}: ${it.target || '—'}`;
}

// ---------- media widgets are rendered by media.js through ctx.media ----------
const projectMedia = { key: '_media', label: 'عکس‌ها و ویدیوها', type: 'custom', render: (v, path, ctx, parent) => ctx.media.projectWidget(parent) };
const certMedia = { key: '_media', label: 'اسکن و PDF گواهینامه', type: 'custom', render: (v, path, ctx, parent) => ctx.media.certWidget(parent) };

const idField = (kind, onRename) => ({
  key: 'id',
  label: 'شناسه (ID)',
  type: 'text',
  dir: 'ltr',
  help: SLUG_HELP,
  readonly: (p, ctx) => !ctx.isNew(p),
  onChange: onRename,
});

// ============================================================
//  Sections
// ============================================================
export const SECTIONS = [
  { id: 'dashboard', title: 'داشبورد', icon: 'overview', desc: 'وضعیت سایت، تغییرات ذخیره‌نشده و آخرین انتشار.' },
  {
    id: 'nav',
    title: 'منو و زیرمنو',
    icon: 'menu',
    file: F.nav,
    desc: 'ترتیب، نام و مقصد آیتم‌های منوی بالا، زیرمنوها، نوار پایین موبایل و کاشی‌های صفحه اول.',
    fields: [
      {
        key: 'items',
        label: 'آیتم‌های منو',
        type: 'array',
        addLabel: 'افزودن آیتم منو',
        help: 'ترتیب این فهرست = ترتیب منو و کاشی‌ها. با ▲▼ جابه‌جا کنید.',
        item: {
          title: (it) => `${pick(it.label) || '—'}  ·  ${navTargetText(it)}`,
          create: (ctx) => ({ id: uid('nav'), type: 'page', target: TARGET_DEFAULT.page(ctx), label: ML(), icon: 'doc', visible: true, dock: false, tile: false, tileText: ML(), children: [] }),
          fields: navFields(false),
        },
      },
    ],
  },
  {
    id: 'home',
    title: 'صفحه اول',
    icon: 'overview',
    file: F.home,
    desc: 'نام، عنوان شغلی، معرفی کوتاه و دکمه‌های صفحه اول.',
    fields: [
      { key: 'name', label: 'نام', type: 'text', ml: true },
      { key: 'role', label: 'عنوان شغلی', type: 'text', ml: true },
      { key: 'lede', label: 'معرفی کوتاه', type: 'textarea', ml: true },
      { key: 'chips', label: 'برچسب‌ها (هر خط یک برچسب)', type: 'lines', ml: true, rows: 3 },
      { key: 'ctaProjects', label: 'دکمه پروژه‌ها (خالی = مخفی)', type: 'text', ml: true },
      { key: 'ctaContact', label: 'دکمه تماس (خالی = مخفی)', type: 'text', ml: true },
      { key: 'viewCaption', label: 'زیرنویس مدل سه‌بعدی', type: 'text', ml: true },
      { key: 'viewerHint', label: 'راهنمای چرخاندن مدل', type: 'text', ml: true },
    ],
  },
  {
    id: 'about',
    title: 'درباره من',
    icon: 'about',
    file: F.about,
    desc: 'متن معرفی، اطلاعات کوتاه و گروه‌های مهارت. عکس پروفایل در «تنظیمات» است.',
    fields: [
      { key: 'title', label: 'عنوان بخش', type: 'text', ml: true },
      { key: 'paragraphs', label: 'متن معرفی (بین پاراگراف‌ها یک خط خالی)', type: 'paras', ml: true },
      {
        key: 'facts',
        label: 'اطلاعات کوتاه',
        type: 'array',
        item: { title: (it) => `${pick(it.k)}: ${pick(it.v)}`, create: () => ({ k: ML(), v: ML() }), fields: [{ key: 'k', label: 'عنوان', type: 'text', ml: true }, { key: 'v', label: 'مقدار', type: 'text', ml: true }] },
      },
      { key: 'skillsTitle', label: 'عنوان مهارت‌ها', type: 'text', ml: true },
      {
        key: 'skills',
        label: 'گروه‌های مهارت',
        type: 'array',
        item: {
          title: (it) => pick(it.name),
          create: () => ({ name: ML(), items: MLL() }),
          fields: [
            { key: 'name', label: 'نام گروه', type: 'text', ml: true },
            { key: 'items', label: 'مهارت‌ها (هر خط یکی)', type: 'lines', ml: true, rows: 5 },
          ],
        },
      },
    ],
  },
  {
    id: 'career',
    title: 'سوابق کاری و تحصیلی',
    icon: 'career',
    file: F.career,
    desc: 'سوابق کاری و تحصیلی؛ بالاترین مورد = جدیدترین. اولین سابقه کاری روی کاشی صفحه اول دیده می‌شود.',
    fields: [
      { key: 'title', label: 'عنوان بخش', type: 'text', ml: true },
      { key: 'workTitle', label: 'عنوان سوابق کاری', type: 'text', ml: true },
      { key: 'eduTitle', label: 'عنوان تحصیلات', type: 'text', ml: true },
      {
        key: 'experience',
        label: 'سوابق کاری',
        type: 'array',
        addLabel: 'افزودن سابقه کاری',
        item: {
          title: (it) => `${pick(it.role)} · ${pick(it.org)}  (${(it.period || []).join(' – ')})`,
          create: () => ({ period: ['', 'now'], role: ML(), org: ML(), bullets: MLL() }),
          fields: [
            { key: 'period', label: 'بازه زمانی', type: 'period' },
            { key: 'role', label: 'سمت', type: 'text', ml: true },
            { key: 'org', label: 'سازمان / شرکت', type: 'text', ml: true },
            { key: 'bullets', label: 'شرح کارها (هر خط یک مورد)', type: 'lines', ml: true, rows: 6 },
          ],
        },
      },
      {
        key: 'education',
        label: 'تحصیلات',
        type: 'array',
        addLabel: 'افزودن مدرک',
        item: {
          title: (it) => `${pick(it.degree)} · ${pick(it.school)}`,
          create: () => ({ period: ['', 'now'], status: 'in_progress', degree: ML(), school: ML(), note: MLL() }),
          fields: [
            { key: 'period', label: 'بازه زمانی', type: 'period' },
            { key: 'status', label: 'وضعیت', type: 'select', options: STATUS_OPTS },
            { key: 'degree', label: 'مدرک و رشته', type: 'text', ml: true },
            { key: 'school', label: 'دانشگاه', type: 'text', ml: true },
            { key: 'note', label: 'توضیحات (هر خط یک مورد)', type: 'lines', ml: true },
          ],
        },
      },
    ],
  },
  {
    id: 'projects',
    title: 'پروژه‌ها',
    icon: 'projects',
    file: F.projects,
    desc: 'پروژه‌ها، دسته‌بندی‌ها و عکس/ویدیوی هر پروژه.',
    fields: [
      { key: 'title', label: 'عنوان بخش', type: 'text', ml: true },
      { key: 'subtitle', label: 'زیرعنوان', type: 'text', ml: true },
      { key: 'allLabel', label: 'برچسب فیلتر «همه»', type: 'text', ml: true },
      {
        key: 'categories',
        label: 'دسته‌بندی‌ها (فیلترها)',
        type: 'array',
        addLabel: 'افزودن دسته',
        item: {
          title: (it) => `${pick(it.label)} (${it.id})`,
          create: () => ({ id: uid('cat'), label: ML() }),
          fields: [
            { key: 'id', label: 'شناسه', type: 'text', dir: 'ltr', help: 'حروف کوچک انگلیسی. پروژه‌ها با این شناسه به دسته وصل‌اند.' },
            { key: 'label', label: 'نام', type: 'text', ml: true },
          ],
        },
      },
      {
        key: 'items',
        label: 'پروژه‌ها',
        type: 'array',
        addLabel: 'افزودن پروژه',
        item: {
          title: (it) => `${pick(it.title) || it.id}`,
          isNew: (it, ctx) => ctx.isNew(it),
          create: (ctx) => ({
            id: uid('project'),
            visible: true,
            cat: firstOf(catOpts(ctx)),
            status: 'in_progress',
            year: String(new Date().getFullYear()),
            tags: [],
            title: ML(),
            summary: ML(),
            work: MLL(),
            links: [],
            embeds: [],
          }),
          fields: [
            idField('projects', (ctx, { oldValue, newValue }) => ctx.media.renameProject(oldValue, newValue)),
            { key: 'visible', label: 'نمایش در سایت', type: 'bool' },
            { key: 'cat', label: 'دسته', type: 'select', options: catOpts },
            { key: 'status', label: 'وضعیت', type: 'select', options: STATUS_OPTS },
            { key: 'year', label: 'سال', type: 'text', dir: 'ltr', placeholder: '2024–2026' },
            { key: 'tags', label: 'برچسب‌ها (با کاما جدا کنید)', type: 'tags', dir: 'ltr', wide: true },
            { key: 'title', label: 'عنوان', type: 'text', ml: true },
            { key: 'summary', label: 'خلاصه', type: 'textarea', ml: true, rows: 2 },
            { key: 'work', label: 'کارهای انجام‌شده (هر خط یک مورد)', type: 'lines', ml: true, rows: 5 },
            projectMedia,
            {
              key: 'links',
              label: 'لینک‌ها (گیت‌هاب، مقاله، …)',
              type: 'array',
              noDuplicate: true,
              item: {
                title: (it) => `${pick(it.label) || 'Link'} · ${it.url || ''}`,
                create: () => ({ label: { fa: 'گیت‌هاب', en: 'GitHub', de: 'GitHub' }, url: 'https://' }),
                fields: [
                  { key: 'label', label: 'متن دکمه', type: 'text', ml: true },
                  { key: 'url', label: 'آدرس', type: 'text', dir: 'ltr', wide: true },
                ],
              },
            },
            {
              key: 'embeds',
              label: 'ویدیوهای یوتیوب',
              type: 'array',
              noDuplicate: true,
              help: 'ویدیوهای بزرگ را در یوتیوب بگذارید و لینکش را اینجا وارد کنید.',
              item: {
                title: (it) => `YouTube · ${it.id || ''}`,
                create: () => ({ type: 'youtube', id: '' }),
                fields: [
                  {
                    key: 'id',
                    label: 'لینک یا شناسه ویدیو',
                    type: 'text',
                    dir: 'ltr',
                    wide: true,
                    onChange: (ctx, { parent, newValue }) => (parent.id = youtubeId(newValue)),
                  },
                ],
              },
            },
          ],
        },
      },
    ],
  },
  {
    id: 'certificates',
    title: 'گواهینامه‌ها',
    icon: 'certificates',
    file: F.certificates,
    desc: 'گواهینامه‌ها، گروه‌ها، صادرکننده‌ها و اسکن/PDF هر گواهینامه.',
    fields: [
      { key: 'title', label: 'عنوان بخش', type: 'text', ml: true },
      { key: 'subtitle', label: 'زیرعنوان', type: 'text', ml: true },
      { key: 'allLabel', label: 'برچسب فیلتر «همه»', type: 'text', ml: true },
      {
        key: 'items',
        label: 'گواهینامه‌ها',
        type: 'array',
        addLabel: 'افزودن گواهینامه',
        item: {
          title: (it) => `${pick(it.title) || it.code || it.id} · ${it.year || ''}`,
          isNew: (it, ctx) => ctx.isNew(it),
          create: (ctx) => ({
            id: uid('cert'),
            visible: true,
            group: firstOf(groupOpts(ctx)),
            issuer: firstOf(issuerOpts(ctx)),
            year: String(new Date().getFullYear()),
            code: '',
            verify: '',
            title: ML(),
            detail: ML(),
          }),
          fields: [
            idField('certificates', (ctx, { oldValue, newValue }) => ctx.media.renameCert(oldValue, newValue)),
            { key: 'visible', label: 'نمایش در سایت', type: 'bool' },
            { key: 'group', label: 'گروه', type: 'select', options: groupOpts },
            { key: 'issuer', label: 'صادرکننده', type: 'select', options: issuerOpts },
            { key: 'year', label: 'سال', type: 'text', dir: 'ltr' },
            { key: 'code', label: 'کد کوتاه (روی کارت)', type: 'text', dir: 'ltr' },
            { key: 'verify', label: 'لینک بررسی آنلاین (اختیاری)', type: 'text', dir: 'ltr', wide: true },
            { key: 'title', label: 'عنوان', type: 'text', ml: true },
            { key: 'detail', label: 'توضیح', type: 'text', ml: true },
            certMedia,
          ],
        },
      },
      {
        key: 'groups',
        label: 'گروه‌ها (فیلترها)',
        type: 'array',
        addLabel: 'افزودن گروه',
        item: {
          title: (it) => `${pick(it.label)} (${it.id})`,
          create: () => ({ id: uid('group'), label: ML() }),
          fields: [
            { key: 'id', label: 'شناسه', type: 'text', dir: 'ltr' },
            { key: 'label', label: 'نام', type: 'text', ml: true },
          ],
        },
      },
      {
        key: 'issuers',
        label: 'صادرکننده‌ها',
        type: 'array',
        addLabel: 'افزودن صادرکننده',
        item: {
          title: (it) => `${pick(it.name)} (${it.id})`,
          create: () => ({ id: uid('issuer'), name: ML() }),
          fields: [
            { key: 'id', label: 'شناسه', type: 'text', dir: 'ltr' },
            { key: 'name', label: 'نام', type: 'text', ml: true },
          ],
        },
      },
    ],
  },
  {
    id: 'pages',
    title: 'صفحه‌ها',
    icon: 'doc',
    file: F.pages,
    desc: 'صفحه‌های دلخواه (مثل مقالات، علایق، خدمات). آدرس هر صفحه: <code>#/page/شناسه</code>',
    fields: [
      {
        key: 'items',
        label: 'صفحه‌ها',
        type: 'array',
        addLabel: 'افزودن صفحه',
        item: {
          title: (it) => `${pick(it.title) || it.id}`,
          isNew: (it, ctx) => ctx.isNew(it),
          create: () => ({ id: uid('page'), visible: true, icon: 'doc', title: ML(), summary: ML(), body: ML() }),
          fields: [
            idField('pages'),
            { key: 'visible', label: 'نمایش در سایت', type: 'bool' },
            { key: 'icon', label: 'آیکون', type: 'select', options: ICON_OPTS },
            { key: '_nav', label: '', type: 'custom', render: (v, path, ctx, parent) => ctx.pageNavButton(parent) },
            { key: 'title', label: 'عنوان', type: 'text', ml: true },
            { key: 'summary', label: 'خلاصه (زیر عنوان و روی کاشی)', type: 'text', ml: true },
            {
              key: 'body',
              label: 'متن صفحه',
              type: 'md',
              ml: true,
              help: 'قالب‌بندی: <code>## تیتر</code> · <code>- مورد فهرست</code> · <code>**پررنگ**</code> · <code>[متن](https://لینک)</code> · <code>![توضیح](آدرس عکس)</code>',
            },
          ],
        },
      },
    ],
  },
  {
    id: 'contact',
    title: 'تماس و اطلاعات حقوقی',
    icon: 'contact',
    file: F.contact,
    desc: 'متن بخش تماس، پانویس و متن حریم خصوصی. ایمیل، تلفن و آدرس در «تنظیمات» است.',
    fields: [
      { key: 'title', label: 'عنوان', type: 'text', ml: true },
      { key: 'text', label: 'متن', type: 'textarea', ml: true },
      { key: 'location', label: 'محل', type: 'text', ml: true },
      { key: 'linkedin', label: 'متن دکمه لینکدین', type: 'text', ml: true },
      { key: 'github', label: 'متن دکمه گیت‌هاب', type: 'text', ml: true },
      { key: 'footer', label: 'متن پانویس', type: 'text', ml: true },
      {
        key: 'legal',
        label: 'Impressum و حریم خصوصی',
        type: 'object',
        fields: [
          { key: 'title', label: 'عنوان', type: 'text', ml: true },
          { key: 'imprintTitle', label: 'عنوان Impressum', type: 'text', ml: true },
          { key: 'imprintLaw', label: 'مبنای قانونی', type: 'text', ml: true },
          { key: 'privacyTitle', label: 'عنوان حریم خصوصی', type: 'text', ml: true },
          { key: 'privacy', label: 'متن حریم خصوصی (بین پاراگراف‌ها یک خط خالی)', type: 'paras', ml: true, rows: 9 },
        ],
      },
    ],
  },
  {
    id: 'site',
    title: 'تنظیمات',
    icon: 'gear',
    file: F.site,
    desc: 'اطلاعات تماس، عکس، رزومه، Impressum، زبان‌ها و تم پیش‌فرض.',
    fields: [
      { key: 'name', label: 'نام (لاتین)', type: 'text', dir: 'ltr' },
      { key: 'domain', label: 'دامنه', type: 'text', dir: 'ltr' },
      { key: 'email', label: 'ایمیل', type: 'text', dir: 'ltr' },
      { key: 'phone', label: 'تلفن (خالی = مخفی)', type: 'text', dir: 'ltr', help: 'شماره روی سایت عمومی دیده می‌شود.' },
      { key: 'linkedin', label: 'لینکدین', type: 'text', dir: 'ltr' },
      { key: 'github', label: 'گیت‌هاب', type: 'text', dir: 'ltr' },
      { key: 'photo', label: 'عکس پروفایل', type: 'custom', render: (v, path, ctx) => ctx.media.publicFileWidget(v, path, 'image') },
      {
        key: 'cv',
        label: 'رزومه (PDF)',
        type: 'object',
        fields: [
          { key: 'enabled', label: 'دکمه دانلود رزومه نمایش داده شود', type: 'bool' },
          { key: 'file', label: 'فایل رزومه', type: 'custom', render: (v, path, ctx) => ctx.media.publicFileWidget(v, path, 'pdf') },
          { key: 'label', label: 'متن دکمه', type: 'text', ml: true },
        ],
      },
      {
        key: 'meta',
        label: 'عنوان و توضیح سایت (گوگل و تب مرورگر)',
        type: 'object',
        fields: [
          { key: 'title', label: 'عنوان', type: 'text', ml: true },
          { key: 'description', label: 'توضیح', type: 'textarea', ml: true, rows: 2 },
        ],
      },
      {
        key: 'imprint',
        label: 'Impressum (الزامی در آلمان)',
        type: 'object',
        fields: [
          { key: 'name', label: 'نام', type: 'text', dir: 'ltr' },
          { key: 'street', label: 'خیابان و پلاک', type: 'text', dir: 'ltr' },
          { key: 'city', label: 'کد پستی و شهر', type: 'text', dir: 'ltr' },
          { key: 'country', label: 'کشور', type: 'text', dir: 'ltr' },
          { key: 'email', label: 'ایمیل', type: 'text', dir: 'ltr' },
        ],
      },
      {
        key: 'languages',
        label: 'زبان',
        type: 'object',
        fields: [
          { key: 'default', label: 'زبان پیش‌فرض', type: 'select', options: LANG_OPTS },
          { key: 'geoDetection', label: 'انتخاب زبان بر اساس کشور بازدیدکننده', type: 'bool' },
          { key: 'countryToLang', label: 'کشور → زبان (هر خط: کد کشور = زبان)', type: 'kv', help: 'مثلاً <code>AT = de</code>. کشورهای دیگر زبان پیش‌فرض را می‌بینند.' },
        ],
      },
      {
        key: 'themes',
        label: 'تم رنگی پیش‌فرض',
        type: 'object',
        fields: [
          { key: 'defaultDark', label: 'تم تیره', type: 'select', options: THEMES.filter((x) => x.mode === 'dark').map((x) => x.id) },
          { key: 'defaultLight', label: 'تم روشن', type: 'select', options: THEMES.filter((x) => x.mode === 'light').map((x) => x.id) },
        ],
      },
    ],
  },
  { id: 'ui', title: 'متن‌های رابط کاربری', icon: 'globe', desc: 'متن دکمه‌ها و پیام‌های کوچک سایت در سه زبان.' },
  { id: 'raw', title: 'ویرایش مستقیم JSON', icon: 'tool', desc: 'برای کاربر حرفه‌ای: ویرایش مستقیم فایل‌های محتوا.' },
];
