/* InternshipWala - email writing engine (pure functions, no network). */
(function (root) {
  const clean = (s) => (s || '').toString().trim();
  const cap = (s) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s);

  function splitList(s) {
    return clean(s).split(/[,;\n]/).map((x) => x.trim()).filter(Boolean);
  }

  function joinList(items) {
    if (items.length <= 1) return items[0] || '';
    if (items.length === 2) return items.join(' and ');
    return items.slice(0, -1).join(', ') + ' and ' + items[items.length - 1];
  }

  function tagMatches(tag, area) {
    const a = area.toLowerCase();
    const aw = a.split(/[^a-z0-9+#]+/).filter(Boolean);
    if (tag.length <= 3) return aw.includes(tag);           // "ml", "ai", "rag": whole word only
    if (a.includes(tag)) return true;                        // "computer vision" in "computer vision for health"
    if (a.length >= 4 && tag.includes(a)) return true;       // area "vision" inside tag "computer vision"
    const tw = tag.split(/[^a-z0-9+#]+/).filter(Boolean);
    return aw.some((w) => w.length >= 4 && tw.includes(w));  // shared meaningful word
  }

  function scoreProject(project, areas) {
    const tags = splitList(project.tags).map((t) => t.toLowerCase());
    return tags.reduce((n, tag) => n + (areas.some((a) => tagMatches(tag, a)) ? 1 : 0), 0);
  }

  function rankProjects(projects, areas) {
    return projects
      .map((p, i) => ({ p, i, score: scoreProject(p, areas) }))
      .sort((x, y) => y.score - x.score || x.i - y.i);
  }

  function greeting(name) {
    const n = clean(name).replace(/\s+/g, ' ');
    const m = n.match(/^(dr|prof|professor)\.?\s+(.*)$/i);
    const rest = m ? m[2] : n;
    const last = rest.split(' ').filter(Boolean).slice(-1)[0] || rest;
    const title = m && /^dr/i.test(m[1]) ? 'Dr.' : 'Professor';
    return `Dear ${title} ${last},`;
  }

  /**
   * prof: {name, email, honorific: 'Sir'|"Ma'am", areas: string[], paper: string}
   * me:   profile object from the server
   * hasResume: boolean (whether a resume will be attached)
   */
  function buildEmail(prof, me, hasResume) {
    const areas = (prof.areas || []).map(clean).filter(Boolean);
    const hon = prof.honorific === "Ma'am" ? "Ma'am" : 'Sir';
    const soft = (a) => (/^[A-Z][a-z]/.test(a) ? a.charAt(0).toLowerCase() + a.slice(1) : a); // keep acronyms like NLP
    const areaText = joinList(areas.map(soft));

    const ranked = rankProjects(me.projects || [], areas);
    const matches = ranked.filter((r) => r.score > 0).slice(0, 2);
    const exact = matches.length > 0;
    const picked = (exact ? matches : ranked.slice(0, 1)).map((r) => r.p).filter((p) => clean(p.blurb));

    // Paragraph 1: who I am + the ask
    const sem = clean(me.semester) ? `${clean(me.semester)}-semester ` : '';
    const degree = clean(me.degree) || 'undergraduate';
    const college = clean(me.college) ? ` at ${clean(me.college)}` : '';
    const dur = clean(me.duration) || '4-6 month';
    const start = clean(me.start) ? ` starting ${clean(me.start)}` : '';
    const p1 =
      `I hope you are doing well. My name is ${clean(me.name)}, and I am a ${sem}${degree} student${college}. ` +
      `For my 8th semester I am looking for a ${dur} internship${start}, and I am writing to ask whether your ` +
      `group has any project openings where I could contribute.`;

    // Paragraph 2: why this professor + matching projects
    let p2 = '';
    if (clean(prof.paper)) {
      p2 += `I recently went through your work on "${clean(prof.paper)}"` +
            (areaText ? ` and your research on ${areaText}` : '') +
            ', and found it very interesting. ';
    } else if (areaText) {
      p2 += `I went through your research on ${areaText} and found it very interesting. `;
    }
    if (picked.length) {
      const first = clean(picked[0].blurb);
      const second = picked[1] ? clean(picked[1].blurb) : '';
      if (exact) {
        p2 += `It relates closely to what I have been working on. For instance, I ${first}` +
              (second ? `, and I ${second}` : '') + '.';
      } else {
        p2 += `While my projects so far have been in adjacent areas, I am keen to work on ${areaText || 'this field'}. ` +
              `For instance, I ${first}.`;
      }
    }

    // Past experience (optional): best match, else the first one listed
    const exps = (me.experience || []).filter((x) => clean(x.blurb));
    let expUsed = null;
    if (exps.length) {
      const rankedExp = rankProjects(exps, areas);
      expUsed = rankedExp[0].p;
      const dur = clean(expUsed.duration);
      p2 += (p2 ? ' ' : '') + `Previously, ${dur ? 'in ' + dur + ', ' : ''}I ${clean(expUsed.blurb)}.`;
    }

    // Paragraph 3: skills
    const skills = clean(me.skills);
    const p3 = (skills ? `I am comfortable working with ${skills}. ` : '') +
      `I am happy to take up whatever would be most useful to your group and can commit full-time for the duration.`;

    // Paragraph 4: attachment + close
    const gh = clean(me.github);
    const p4 =
      (hasResume ? 'I have attached my resume for your reference' : 'I would be happy to share my resume') +
      (gh ? `, and my projects are available on GitHub: ${gh}` : '') + '. ' +
      `If you have a suitable opening, or know of someone who does, I would be very grateful for your guidance.`;

    const sigLines = [
      clean(me.name),
      [clean(me.degree), clean(me.college)].filter(Boolean).join(', '),
      [clean(me.phone), clean(me.linkedin)].filter(Boolean).join(' | '),
      gh,
    ].filter(Boolean);

    const body = [
      greeting(prof.name), '',
      p1, '', p2.trim(), '', p3, '', p4, '',
      `Thank you for your time and consideration, ${hon}.`, '',
      'Sincerely,', ...sigLines,
    ].join('\n').replace(/\n{3,}/g, '\n\n');

    const subject = `Internship inquiry${areas[0] ? ' – ' + cap(areas[0]) : ''} | ${clean(me.name)}`;
    const expTitle = expUsed ? [clean(expUsed.role), clean(expUsed.org)].filter(Boolean).join(' @ ') : '';
    return { subject, body, matched: picked.map((p) => p.title), exact, experience: expTitle };
  }

  const api = { buildEmail, scoreProject, rankProjects, greeting, splitList, joinList };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.Draft = api;
})(typeof window !== 'undefined' ? window : globalThis);
