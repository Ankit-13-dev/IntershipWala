import smtplib, ssl, socket

for port in (465, 587):
    try:
        socket.create_connection(("smtp.gmail.com", port), timeout=10).close()
        print(port, "-> network reachable")
    except Exception as e:
        print(port, "-> BLOCKED:", e)
        continue
    try:
        ctx = ssl.create_default_context()
        if port == 465:
            s = smtplib.SMTP_SSL("smtp.gmail.com", port, context=ctx, timeout=15)
        else:
            s = smtplib.SMTP("smtp.gmail.com", port, timeout=15)
            s.starttls(context=ctx)
        print(port, "-> handshake OK:", s.noop())
        s.quit()
    except Exception as e:
        print(port, "-> handshake FAILED:", e)