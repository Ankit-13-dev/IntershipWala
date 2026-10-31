# InternshipWala ✈️

Write a personalised internship email to a professor in seconds, review it, and send it.
Runs **locally on your computer** — your resume, details and email password never leave your machine.

## One-time setup (5 minutes)

1. Install Python 3.9+ and open a terminal in this folder.
2. Install the two dependencies:
   ```
   pip install -r requirements.txt
   ```
3. Create a Gmail **App Password** (a special 16-character password just for this app):
   - Turn on 2-Step Verification: https://myaccount.google.com/security
   - Create the password: https://myaccount.google.com/apppasswords
   - (A college Google Workspace account works too, if your admin allows App Passwords.)
4. Copy `.env.example` to `.env` and fill in your Gmail address and the App Password.
5. Start the app:
   ```
   python app.py
   ```
   then open **http://127.0.0.1:5000**

## How to use

1. **My profile** (first time only): your college, degree, skills, GitHub, projects. Upload your resume PDF.
   For each project, add a few *keywords* — they decide which projects are mentioned for which professor.
2. **Compose**: enter the professor's name, email, Sir / Ma'am and research areas.
   Adding one specific paper or project of theirs makes the email much more convincing.
3. Press **Write email**, edit anything you like, press **Review & send**.
4. A confirmation window shows exactly what will be sent. Only **Yes, send it** sends the email.
5. **Sent** tab keeps a log, and warns you if you're about to email the same address twice.

## Tips for better replies
- Always add a specific paper/project of the professor — generic emails get ignored.
- Skim and tweak every draft. The tool picks projects by keyword match; you know the professor better.
- Send to 5–10 professors at a time, not 100. Quality beats volume.
- Test safely: add `DRY_RUN=1` to `.env` and nothing is actually sent.

## Files
```
app.py            Flask backend (profile, resume, SMTP sending, sent log)
static/           index.html, style.css, app.js, draft.js (email writer), logo.svg, logo-full.svg
data/             created on first run: profile.json, resume.pdf, sent.json (stays local)
.env              your Gmail credentials (never share or upload this)
```
