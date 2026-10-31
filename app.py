"""InternshipWala - write personalised internship emails to professors and send them
(only after you confirm). Runs locally on your own computer."""
import json
import os
import re
import smtplib
import ssl
from datetime import datetime
from email.message import EmailMessage
from email.utils import formataddr
from pathlib import Path

from dotenv import load_dotenv
from flask import Flask, jsonify, request, send_from_directory

BASE = Path(__file__).parent
load_dotenv(BASE / ".env")

DATA = BASE / "data"
DATA.mkdir(exist_ok=True)
PROFILE_F = DATA / "profile.json"
SENT_F = DATA / "sent.json"
RESUME_F = DATA / "resume.pdf"

EMAIL_RE = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")

DEFAULT_PROFILE = {
    "name": "Ankit Atri",
    "college": "",
    "degree": "",
    "semester": "7th",
    "duration": "4-6 month",
    "start": "",
    "skills": "Python, computer vision and machine learning pipelines",
    "github": "https://github.com/Ankit-13-dev",
    "linkedin": "",
    "phone": "",
    "resume_name": "",
    "experience": [],
    "projects": [
        {
            "title": "Spoof-Detection",
            "url": "https://github.com/Ankit-13-dev/Spoof-Detection",
            "tags": "spoof, anti-spoofing, liveness, face, biometrics, security, computer vision, vision, "
                    "depth estimation, depth, object detection, detection, clip, deep learning, machine learning, ai, ml",
            "blurb": "built Spoof-Detection, a real-time computer vision pipeline for face spoof detection that "
                     "combines object detection, monocular depth estimation, depth-variance analysis and CLIP",
        },
        {
            "title": "Dataset-Collector",
            "url": "https://github.com/Ankit-13-dev/Dataset-Collector",
            "tags": "dataset, data, face, tracking, reid, re-identification, labeling, annotation, video, pipeline, "
                    "computer vision, vision, detection, deep learning, machine learning, ai, ml",
            "blurb": "built Dataset-Collector, a multi-stage pipeline that performs face detection, tracking, "
                     "re-identification and labelling to generate datasets automatically from video",
        },
        {
            "title": "ScureLocalAI",
            "url": "https://github.com/Ankit-13-dev/ScureLocalAI",
            "tags": "rag, llm, nlp, language model, retrieval, vector, embeddings, search, knowledge, "
                    "generative, ollama, privacy, local, ai, machine learning, ml",
            "blurb": "built ScureLocalAI, an offline, local-first knowledge base with local vector search and an "
                     "Ollama-powered RAG chat interface over uploaded documents",
        },
        {
            "title": "KIM",
            "url": "",
            "tags": "education, edtech, learning, video, multimodal, speech, ocr, computer vision, vision, ai, ml",
            "blurb": "worked on KIM, a clue-based learning system that processes educational videos through a "
                     "computer vision pipeline",
        },
        {
            "title": "Restaurant-management-system",
            "url": "https://github.com/Ankit-13-dev/Restaurant-management-system",
            "tags": "database, databases, sql, mysql, dbms, data management, information systems",
            "blurb": "built a MySQL-based management system for multiple restaurant chains",
        },
    ],
}

app = Flask(__name__, static_folder="static", static_url_path="/static")
app.config["MAX_CONTENT_LENGTH"] = 5 * 1024 * 1024  # 5 MB (resume upload)


# ---------- helpers ----------
def read_json(path, default):
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except (FileNotFoundError, json.JSONDecodeError):
        return default


def write_json(path, obj):
    path.write_text(json.dumps(obj, indent=2, ensure_ascii=False), encoding="utf-8")


def load_profile():
    p = {**DEFAULT_PROFILE, **read_json(PROFILE_F, {})}
    if not RESUME_F.exists():
        p["resume_name"] = ""
    return p


def creds():
    sender = (os.getenv("GMAIL_ADDRESS") or "").strip()
    pw = (os.getenv("GMAIL_APP_PASSWORD") or "").replace(" ", "")
    return sender, pw


def err(msg, code=400):
    return jsonify({"ok": False, "error": msg}), code


# ---------- routes ----------
@app.get("/")
def index():
    return send_from_directory("static", "index.html")


@app.get("/api/status")
def status():
    sender, pw = creds()
    dry = os.getenv("DRY_RUN") == "1"
    return jsonify({"configured": bool(sender and pw) or dry, "from": sender, "dry_run": dry})


@app.get("/api/profile")
def get_profile():
    return jsonify(load_profile())


@app.post("/api/profile")
def save_profile():
    d = request.get_json(silent=True) or {}
    cur = load_profile()
    for k in DEFAULT_PROFILE:
        if k in d and k not in ("projects", "experience", "resume_name"):
            cur[k] = str(d[k]).strip()
    if isinstance(d.get("projects"), list):
        cur["projects"] = [
            {k: str(p.get(k, "")).strip() for k in ("title", "url", "tags", "blurb")}
            for p in d["projects"]
            if str(p.get("title", "")).strip() or str(p.get("blurb", "")).strip()
        ]
    if isinstance(d.get("experience"), list):
        cur["experience"] = [
            {k: str(x.get(k, "")).strip() for k in ("role", "org", "duration", "tags", "blurb")}
            for x in d["experience"]
            if str(x.get("role", "")).strip() or str(x.get("org", "")).strip() or str(x.get("blurb", "")).strip()
        ]
    write_json(PROFILE_F, cur)
    return jsonify({"ok": True, "profile": load_profile()})


@app.post("/api/resume")
def upload_resume():
    f = request.files.get("resume")
    if not f or not f.filename:
        return err("No file received.")
    if not f.filename.lower().endswith(".pdf"):
        return err("Please upload your resume as a PDF.")
    f.save(RESUME_F)
    cur = load_profile()
    cur["resume_name"] = os.path.basename(f.filename)
    write_json(PROFILE_F, cur)
    return jsonify({"ok": True, "resume_name": cur["resume_name"]})


@app.delete("/api/resume")
def delete_resume():
    RESUME_F.unlink(missing_ok=True)
    cur = load_profile()
    cur["resume_name"] = ""
    write_json(PROFILE_F, cur)
    return jsonify({"ok": True})


@app.get("/api/sent")
def sent():
    return jsonify(list(reversed(read_json(SENT_F, []))))


@app.post("/api/send")
def send():
    d = request.get_json(silent=True) or {}
    to = str(d.get("to", "")).strip()
    subject = " ".join(str(d.get("subject", "")).split())  # single line, no header injection
    body = str(d.get("body", "")).strip()
    prof_name = str(d.get("name", "")).strip()

    if not EMAIL_RE.match(to):
        return err("That email address doesn't look right.")
    if not subject or not body:
        return err("Subject and message can't be empty.")

    sender, pw = creds()
    dry = os.getenv("DRY_RUN") == "1"
    if not dry and not (sender and pw):
        return err("Sending isn't set up yet. Add GMAIL_ADDRESS and GMAIL_APP_PASSWORD to the .env file "
                   "and restart the app (see README).")

    profile = load_profile()
    msg = EmailMessage()
    msg["From"] = formataddr((profile["name"], sender or "dry-run@example.com"))
    msg["To"] = to
    msg["Subject"] = subject
    msg.set_content(body)

    attached = ""
    if d.get("attach_resume") and RESUME_F.exists():
        fname = profile.get("resume_name") or "Resume.pdf"
        msg.add_attachment(RESUME_F.read_bytes(), maintype="application", subtype="pdf", filename=fname)
        attached = fname

    if not dry:
        try:
            ctx = ssl.create_default_context()
            host = os.getenv("SMTP_HOST", "smtp.gmail.com")
            port = int(os.getenv("SMTP_PORT", "465"))
            with smtplib.SMTP_SSL(host, port, context=ctx, timeout=30) as s:
                s.login(sender, pw)
                s.send_message(msg)
        except smtplib.SMTPAuthenticationError:
            return err("Gmail rejected the login. Use a 16-character App Password (not your normal password) "
                       "and make sure 2-Step Verification is on.", 401)
        except (smtplib.SMTPException, OSError) as e:
            return err(f"Couldn't send the email: {e}", 502)

    log = read_json(SENT_F, [])
    log.append({
        "when": datetime.now().isoformat(timespec="seconds"),
        "to": to, "name": prof_name, "subject": subject,
        "attachment": attached, "dry_run": dry,
    })
    write_json(SENT_F, log)
    return jsonify({"ok": True, "dry_run": dry})


if __name__ == "__main__":
    print("\n  InternshipWala is running ->  http://127.0.0.1:5000\n")
    app.run(host="127.0.0.1", port=5000, debug=False)
