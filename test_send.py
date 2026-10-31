import os, smtplib, ssl, traceback
from email.message import EmailMessage
from dotenv import load_dotenv

load_dotenv()
addr = (os.getenv("GMAIL_ADDRESS") or "").strip()
pw = (os.getenv("GMAIL_APP_PASSWORD") or "").replace(" ", "")
print("address:", repr(addr), "| password length:", len(pw), "(should be 16)")

msg = EmailMessage()
msg["From"], msg["To"], msg["Subject"] = addr, addr, "InternshipWala test"
msg.set_content("If you can read this, sending works.")

try:
    with smtplib.SMTP_SSL("smtp.gmail.com", 465, context=ssl.create_default_context(), timeout=30) as s:
        s.login(addr, pw)
        print("LOGIN OK")
        s.send_message(msg)
        print("SENT OK - check your inbox")
except Exception:
    traceback.print_exc()