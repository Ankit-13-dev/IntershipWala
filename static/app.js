/* InternshipWala - UI logic */
(function () {
  const $ = (id) => document.getElementById(id);
  const state = { profile: null, status: null, sent: [], areas: [], honorific: 'Sir', draftTo: '', draftName: '' };
  const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

  async function api(url, opts) {
    const r = await fetch(url, opts);
    let data = {};
    try { data = await r.json(); } catch (e) {}
    if (!r.ok || data.ok === false) throw new Error(data.error || 'Something went wrong.');
    return data;
  }
  const post = (url, obj) => api(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(obj) });

  let toastTimer;
  function toast(msg, bad) {
    const t = $('toast');
    t.textContent = msg; t.className = 'toast' + (bad ? ' bad' : ''); t.hidden = false;
    clearTimeout(toastTimer); toastTimer = setTimeout(() => (t.hidden = true), bad ? 6000 : 3500);
  }

  /* ---------- theme ---------- */
  $('themeBtn').onclick = () => {
    const next = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark';
    document.documentElement.dataset.theme = next;
    try { localStorage.setItem('iw-theme', next); } catch (e) {}
  };

  /* ---------- tabs ---------- */
  function showTab(name) {
    document.querySelectorAll('.tab').forEach((b) => b.classList.toggle('active', b.dataset.tab === name));
    document.querySelectorAll('.panel').forEach((p) => p.classList.toggle('active', p.id === 'tab-' + name));
    if (location.hash !== '#' + name) history.replaceState(null, '', '#' + name);
    if (name === 'sent') loadSent();
    window.scrollTo({ top: 0 });
  }
  document.querySelectorAll('.tab').forEach((b) => (b.onclick = () => showTab(b.dataset.tab)));

  /* ---------- banners ---------- */
  function profileIncomplete() {
    const p = state.profile;
    return !(p.name && p.college && p.degree);
  }
  function renderBanner() {
    const b = $('banner'); b.innerHTML = '';
    const add = (cls, html) => { const d = document.createElement('div'); d.className = 'notice ' + cls; d.innerHTML = html; b.appendChild(d); return d; };
    if (profileIncomplete()) {
      const d = add('info', '<div><b>First, complete your profile.</b> Add your college, degree and (optionally) upload your resume. <a id="goProfile">Open profile →</a></div>');
      d.querySelector('#goProfile').onclick = () => showTab('profile');
    }
    if (!state.status.configured) {
      add('warn', '<div><b>Email sending isn\'t set up yet.</b> You can still write and copy emails. To send from here, add your Gmail address and an App Password to the <code>.env</code> file, then restart (steps in the README).</div>');
    } else if (state.status.dry_run) {
      add('warn', '<div><b>Test mode (DRY_RUN).</b> Emails are logged but not actually sent.</div>');
    }
  }

  /* ---------- compose: chips ---------- */
  function renderChips() {
    const box = $('chips');
    box.querySelectorAll('.chip').forEach((c) => c.remove());
    state.areas.forEach((a, i) => {
      const c = document.createElement('span'); c.className = 'chip'; c.textContent = a;
      const x = document.createElement('button'); x.type = 'button'; x.textContent = '×'; x.setAttribute('aria-label', 'Remove ' + a);
      x.onclick = () => { state.areas.splice(i, 1); renderChips(); };
      c.appendChild(x); box.insertBefore(c, $('areaInput'));
    });
  }
  function commitArea() {
    const inp = $('areaInput');
    Draft.splitList(inp.value).forEach((a) => { if (!state.areas.some((x) => x.toLowerCase() === a.toLowerCase())) state.areas.push(a); });
    inp.value = ''; renderChips();
  }
  $('areaInput').addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ',') { e.preventDefault(); commitArea(); }
    else if (e.key === 'Backspace' && !e.target.value && state.areas.length) { state.areas.pop(); renderChips(); }
  });
  $('areaInput').addEventListener('blur', commitArea);
  $('chips').addEventListener('click', () => $('areaInput').focus());

  document.querySelectorAll('#honor button').forEach((b) => (b.onclick = () => {
    state.honorific = b.dataset.v;
    document.querySelectorAll('#honor button').forEach((x) => x.classList.toggle('on', x === b));
  }));

  /* ---------- compose: generate ---------- */
  function hasResume() { return !!(state.profile && state.profile.resume_name); }
  function refreshAttachRow() {
    const on = hasResume();
    $('attach').disabled = !on;
    if (!on) $('attach').checked = false;
    $('attachRow').classList.toggle('off', !on);
    $('attachTxt').textContent = on ? 'Attach my resume (' + state.profile.resume_name + ')' : 'Attach my resume (upload one in My profile)';
  }
  $('attach').addEventListener('change', () => {}); // value is read at generate / review time

  $('genBtn').onclick = () => {
    commitArea();
    const name = $('pName').value.trim(), email = $('pEmail').value.trim();
    if (profileIncomplete()) { toast('Please complete your profile first.', true); showTab('profile'); return; }
    if (!name) { toast("Enter the professor's name.", true); $('pName').focus(); return; }
    if (!EMAIL_RE.test(email)) { toast("That email address doesn't look right.", true); $('pEmail').focus(); return; }
    if (!state.areas.length) { toast('Add at least one research area.', true); $('areaInput').focus(); return; }

    const res = Draft.buildEmail(
      { name, email, honorific: state.honorific, areas: state.areas, paper: $('pPaper').value },
      state.profile, $('attach').checked && hasResume());
    $('subject').value = res.subject; $('body').value = res.body;
    state.draftTo = email; state.draftName = name;
    $('emptyState').hidden = true; $('editor').hidden = false;

    const m = $('matched'); m.innerHTML = '';
    if (res.matched.length) {
      const l = document.createElement('span'); l.textContent = res.exact ? 'Matched projects:' : 'No close match, featuring:'; m.appendChild(l);
      res.matched.forEach((t) => { const s = document.createElement('span'); s.className = 'tag'; s.textContent = t; m.appendChild(s); });
    }
    if (res.experience) {
      const l = document.createElement('span'); l.textContent = 'Experience:'; m.appendChild(l);
      const s = document.createElement('span'); s.className = 'tag'; s.textContent = res.experience; m.appendChild(s);
    }
    if (!res.exact) toast('None of your projects match closely. Consider editing the middle paragraph.');
  };

  $('copyBtn').onclick = async () => {
    try { await navigator.clipboard.writeText($('subject').value + '\n\n' + $('body').value); toast('Copied to clipboard.'); }
    catch (e) { toast('Could not copy. Select the text manually.', true); }
  };

  /* ---------- confirm & send ---------- */
  async function openConfirm() {
    const to = $('pEmail').value.trim();
    if (!EMAIL_RE.test(to)) { toast("That email address doesn't look right.", true); return; }
    if (!$('subject').value.trim() || !$('body').value.trim()) { toast('Subject and message cannot be empty.', true); return; }
    if (!state.status.configured) { toast('Sending is not set up yet. See the banner at the top.', true); return; }
    state.draftTo = to;
    await loadSent(true);
    const prev = state.sent.find((s) => s.to.toLowerCase() === to.toLowerCase() && !s.dry_run);
    const w = $('mWarn');
    if (prev) { w.hidden = false; w.textContent = 'Heads up: you already emailed this address on ' + new Date(prev.when).toLocaleDateString() + '. Send again only if that is intentional.'; }
    else w.hidden = true;
    $('mFrom').textContent = state.status.from || 'your account';
    $('mTo').textContent = to;
    $('mSub').textContent = $('subject').value.trim();
    $('mAtt').textContent = $('attach').checked && hasResume() ? state.profile.resume_name : 'None';
    $('mBody').textContent = $('body').value;
    $('mSend').disabled = false; $('mSend').textContent = 'Yes, send it';
    $('modal').hidden = false; $('mSend').focus();
  }
  const closeConfirm = () => ($('modal').hidden = true);
  $('reviewBtn').onclick = openConfirm;
  $('mCancel').onclick = closeConfirm;
  $('modal').addEventListener('click', (e) => { if (e.target === $('modal')) closeConfirm(); });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && !$('modal').hidden && !$('mSend').disabled) closeConfirm(); });

  $('mSend').onclick = async () => {
    const btn = $('mSend');
    btn.disabled = true; btn.innerHTML = '<span class="spin"></span>Sending…';
    try {
      const r = await post('/api/send', {
        to: $('mTo').textContent, name: state.draftName,
        subject: $('subject').value, body: $('body').value, attach_resume: $('attach').checked && hasResume(),
      });
      closeConfirm();
      toast(r.dry_run ? 'Test mode: logged, not actually sent.' : 'Email sent to ' + $('mTo').textContent + ' ✓');
      $('pName').value = ''; $('pEmail').value = ''; $('pPaper').value = ''; state.areas = []; renderChips();
      $('editor').hidden = true; $('emptyState').hidden = false; $('matched').innerHTML = '';
      loadSent();
    } catch (e) {
      btn.disabled = false; btn.textContent = 'Yes, send it';
      toast(e.message, true);
    }
  };

  /* ---------- sent ---------- */
  async function loadSent(quiet) {
    try { state.sent = await api('/api/sent'); } catch (e) { state.sent = []; }
    $('sentCount').textContent = state.sent.filter((s) => !s.dry_run).length || state.sent.length;
    if (quiet) return;
    const card = $('sentCard'); card.innerHTML = '';
    if (!state.sent.length) { card.innerHTML = '<div class="empty"><h3>No emails sent yet</h3><div>Your sent emails will show up here.</div></div>'; return; }
    const t = document.createElement('table');
    t.innerHTML = '<thead><tr><th>Date</th><th>Professor</th><th>Subject</th></tr></thead>';
    const tb = document.createElement('tbody');
    state.sent.forEach((s) => {
      const tr = document.createElement('tr');
      const c1 = document.createElement('td'); c1.textContent = new Date(s.when).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' });
      const c2 = document.createElement('td'); const b = document.createElement('b'); b.textContent = s.name || s.to;
      c2.appendChild(b); c2.appendChild(document.createElement('br')); c2.appendChild(document.createTextNode(s.to));
      if (s.dry_run) { const d = document.createElement('span'); d.className = 'dry'; d.textContent = 'test'; c2.appendChild(d); }
      const c3 = document.createElement('td'); c3.textContent = s.subject;
      tr.append(c1, c2, c3); tb.appendChild(tr);
    });
    t.appendChild(tb); card.appendChild(t);
  }

  /* ---------- profile ---------- */
  const FIELDS = { name: 'prName', college: 'prCollege', degree: 'prDegree', semester: 'prSemester', duration: 'prDuration',
    start: 'prStart', skills: 'prSkills', github: 'prGithub', linkedin: 'prLinkedin', phone: 'prPhone' };

  function renderProfile() {
    const p = state.profile;
    Object.entries(FIELDS).forEach(([k, id]) => ($(id).value = p[k] || ''));
    renderProjects();
    renderExperience();
    renderResume();
  }
  function renderResume() {
    const has = hasResume();
    $('resumeName').textContent = has ? state.profile.resume_name : 'No resume uploaded';
    $('resumeDel').hidden = !has;
    $('resumePick').textContent = has ? 'Replace PDF' : 'Upload PDF';
    refreshAttachRow();
  }
  function renderItems(list, items, fields, titleOf, emptyText) {
    list.innerHTML = '';
    items.forEach((p, i) => {
      const box = document.createElement('div'); box.className = 'proj';
      const top = document.createElement('div'); top.className = 'proj-top';
      const h = document.createElement('span'); h.textContent = titleOf(p);
      const del = document.createElement('button'); del.className = 'btn small danger'; del.textContent = 'Remove';
      del.onclick = () => { items.splice(i, 1); renderItems(list, items, fields, titleOf, emptyText); };
      top.append(h, del); box.appendChild(top);
      fields.forEach(([key, label, tag]) => {
        const l = document.createElement('label'); l.textContent = label;
        const el = document.createElement(tag); if (tag === 'textarea') el.rows = 3;
        el.value = p[key] || '';
        el.oninput = () => { p[key] = el.value; h.textContent = titleOf(p); };
        l.appendChild(el); box.appendChild(l);
      });
      list.appendChild(box);
    });
    if (!items.length) list.innerHTML = '<div class="empty" style="padding:24px">' + emptyText + '</div>';
  }
  const PROJ_FIELDS = [['title', 'Title', 'input'], ['url', 'Link (optional)', 'input'], ['tags', 'Keywords (comma separated)', 'input'], ['blurb', 'One-line summary', 'textarea']];
  const EXP_FIELDS = [['role', 'Role', 'input'], ['org', 'Company / lab', 'input'], ['duration', 'When (optional, e.g. Jun-Aug 2026)', 'input'], ['tags', 'Keywords (comma separated)', 'input'], ['blurb', 'What you did (continues "I ...")', 'textarea']];
  function renderProjects() {
    renderItems($('projList'), state.profile.projects, PROJ_FIELDS, (p) => p.title || 'New project', 'No projects yet.');
  }
  function renderExperience() {
    if (!state.profile.experience) state.profile.experience = [];
    renderItems($('expList'), state.profile.experience, EXP_FIELDS,
      (x) => [x.role, x.org].filter(Boolean).join(' @ ') || 'New experience', 'No experience added. This section is optional.');
  }
  $('addExp').onclick = () => { state.profile.experience.push({ role: '', org: '', duration: '', tags: '', blurb: '' }); renderExperience(); };
  $('addProj').onclick = () => { state.profile.projects.push({ title: '', url: '', tags: '', blurb: '' }); renderProjects(); };

  $('saveProfile').onclick = async () => {
    const body = { projects: state.profile.projects, experience: state.profile.experience || [] };
    Object.entries(FIELDS).forEach(([k, id]) => (body[k] = $(id).value));
    try {
      const r = await post('/api/profile', body);
      state.profile = r.profile; renderProfile(); renderBanner();
      toast('Profile saved ✓');
    } catch (e) { toast(e.message, true); }
  };

  $('resumePick').onclick = () => $('resumeFile').click();
  $('resumeFile').onchange = async () => {
    const f = $('resumeFile').files[0]; if (!f) return;
    const fd = new FormData(); fd.append('resume', f);
    try {
      const r = await api('/api/resume', { method: 'POST', body: fd });
      state.profile.resume_name = r.resume_name; renderResume(); $('attach').checked = true; toast('Resume uploaded ✓');
    } catch (e) { toast(e.message, true); }
    $('resumeFile').value = '';
  };
  $('resumeDel').onclick = async () => {
    try { await api('/api/resume', { method: 'DELETE' }); state.profile.resume_name = ''; renderResume(); toast('Resume removed.'); }
    catch (e) { toast(e.message, true); }
  };

  /* ---------- init ---------- */
  (async function init() {
    try {
      [state.profile, state.status] = await Promise.all([api('/api/profile'), api('/api/status')]);
    } catch (e) { toast('Could not reach the app. Is it still running?', true); return; }
    renderProfile(); renderBanner(); loadSent(true);
    const start = (location.hash || '').slice(1);
    showTab(['compose', 'sent', 'profile'].includes(start) ? start : (profileIncomplete() ? 'profile' : 'compose'));
  })();
})();
