#!/usr/bin/env python3
"""Local server for the Pawsitive Care MVP website.

Serves the site and saves appointment bookings and reviews to plain text
files in data/. Uses only the Python standard library.

    python3 server.py          # http://localhost:8000
    python3 server.py 9000     # use a different port
"""

import json
import os
import posixpath
import re
import secrets
import sys
import threading
from datetime import date, datetime
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import parse_qs, unquote, urlparse

ROOT = os.path.dirname(os.path.abspath(__file__))
DEFAULT_DATA_DIR = os.path.join(ROOT, "data")

# Only these are served to the browser; data/, server.py and .git stay private.
PUBLIC_FILES = {
    "index.html", "services.html", "assistant.html",
    "book.html", "reviews.html", "contact.html",
}
PUBLIC_DIRS = ("css/", "js/", "images/")

# Must match the <option> values in the booking form in book.html.
SERVICES = (
    "Free meet-and-greet",
    "Dog: Bath & brush (small, under 25 lb)",
    "Dog: Bath & brush (medium, 25–60 lb)",
    "Dog: Bath & brush (large, 60 lb+)",
    "Dog: Full groom",
    "Dog: Puppy's first groom",
    "Cat: Bath & brush",
    "Cat: Lion cut",
    "Cat: De-shedding treatment",
    "Cat: Sanitary trim",
    "Dog: Vaccination",
    "Cat: Vaccination",
    "Add-on only (nail trim, ears, teeth, de-matting or flea bath)",
)
PET_TYPES = ("Dog", "Cat")
TIMES = tuple(f"{hour:02d}:00" for hour in range(9, 17))  # last slot 4:00 PM
SUNDAY = 6
MAX_BODY_BYTES = 10_000

APPOINTMENT_FIELDS = (
    "created", "reference", "date", "time", "service", "pet_name", "pet_type",
    "owner_name", "email", "phone", "first_time_owner", "notes",
)
REVIEW_FIELDS = ("created", "name", "pet_name", "rating", "review")

EMAIL_RE = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")
_write_lock = threading.Lock()


class ValidationError(ValueError):
    """Bad form input; the message is shown to the visitor."""


def clean(value, max_len):
    """Collapse to one line, drop the '|' field separator and trim to max_len."""
    text = " ".join(str(value or "").split()).replace("|", "/")
    return text[:max_len].strip()


def species_for(service):
    """'Dog' or 'Cat' if the service is only for that pet, else None."""
    prefix = service.split(":", 1)[0]
    return prefix if prefix in PET_TYPES else None


def read_records(path, fields):
    if not os.path.exists(path):
        return []
    records = []
    with open(path, encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if not line or line.startswith("#"):
                continue
            parts = [part.strip() for part in line.split("|")]
            if len(parts) == len(fields):
                records.append(dict(zip(fields, parts)))
    return records


def append_record(path, fields, record):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    is_new = not os.path.exists(path) or os.path.getsize(path) == 0
    with open(path, "a", encoding="utf-8") as f:
        if is_new:
            f.write("# " + " | ".join(fields) + "\n")
        f.write(" | ".join(record[field] for field in fields) + "\n")


def build_appointment(data, existing, now):
    owner_name = clean(data.get("owner_name"), 80)
    email = clean(data.get("email"), 120)
    phone = clean(data.get("phone"), 30)
    pet_name = clean(data.get("pet_name"), 60)
    pet_type = clean(data.get("pet_type"), 10)
    service = clean(data.get("service"), 100)
    time = clean(data.get("time"), 5)
    notes = clean(data.get("notes"), 500)

    if not owner_name:
        raise ValidationError("Please enter your name.")
    if not EMAIL_RE.match(email):
        raise ValidationError("Please enter a valid email address.")
    if not pet_name:
        raise ValidationError("Please enter your pet's name.")
    if pet_type not in PET_TYPES:
        raise ValidationError("Please choose dog or cat.")
    if service not in SERVICES:
        raise ValidationError("Please choose a service.")
    species = species_for(service)
    if species and species != pet_type:
        raise ValidationError(f"That service is for {species.lower()}s. Please pick a {pet_type.lower()} service.")
    try:
        day = date.fromisoformat(clean(data.get("date"), 10))
    except ValueError:
        raise ValidationError("Please pick a date.") from None
    if day < now.date():
        raise ValidationError("Please pick a date from today onwards.")
    if day.weekday() == SUNDAY:
        raise ValidationError("We're closed on Sundays. Please pick another day.")
    if time not in TIMES:
        raise ValidationError("Please pick an appointment time.")
    if day == now.date() and time <= now.strftime("%H:%M"):
        raise ValidationError("That time has already passed. Please pick a later time.")
    if any(r["date"] == day.isoformat() and r["time"] == time for r in existing):
        raise ValidationError("Sorry, that time is already booked. Please pick another.")

    return {
        "created": now.isoformat(timespec="seconds"),
        "reference": "PC-" + secrets.token_hex(3).upper(),
        "date": day.isoformat(),
        "time": time,
        "service": service,
        "pet_name": pet_name,
        "pet_type": pet_type,
        "owner_name": owner_name,
        "email": email,
        "phone": phone,
        "first_time_owner": "yes" if data.get("first_time_owner") is True else "no",
        "notes": notes,
    }


def build_review(data, now):
    name = clean(data.get("name"), 60)
    pet_name = clean(data.get("pet_name"), 60)
    review = clean(data.get("review"), 1000)
    rating = data.get("rating")
    try:
        rating = int(rating)
    except (TypeError, ValueError):
        rating = 0

    if not name:
        raise ValidationError("Please enter your name.")
    if not 1 <= rating <= 5:
        raise ValidationError("Please choose a rating from 1 to 5.")
    if len(review) < 5:
        raise ValidationError("Please write a few words about your visit.")

    return {
        "created": now.isoformat(timespec="seconds"),
        "name": name,
        "pet_name": pet_name,
        "rating": str(rating),
        "review": review,
    }


class Handler(SimpleHTTPRequestHandler):
    data_dir = DEFAULT_DATA_DIR

    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=ROOT, **kwargs)

    @property
    def appointments_path(self):
        return os.path.join(self.data_dir, "appointments.txt")

    @property
    def reviews_path(self):
        return os.path.join(self.data_dir, "reviews.txt")

    def end_headers(self):
        self.send_header("X-Content-Type-Options", "nosniff")
        super().end_headers()

    def send_json(self, status, payload):
        body = json.dumps(payload).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Cache-Control", "no-store")
        self.end_headers()
        self.wfile.write(body)

    def is_public(self, url_path):
        rel = posixpath.normpath(unquote(url_path)).lstrip("/")
        if rel not in PUBLIC_FILES and not rel.startswith(PUBLIC_DIRS):
            return False
        return os.path.isfile(os.path.join(ROOT, rel))

    def do_GET(self):
        url = urlparse(self.path)
        if url.path == "/api/appointments":
            day = parse_qs(url.query).get("date", [""])[0]
            booked = sorted({r["time"] for r in read_records(self.appointments_path, APPOINTMENT_FIELDS)
                             if r["date"] == day})
            return self.send_json(200, {"booked": booked})
        if url.path == "/api/reviews":
            reviews = read_records(self.reviews_path, REVIEW_FIELDS)[::-1][:20]
            return self.send_json(200, {"reviews": reviews})
        self.serve_static(super().do_GET)

    def do_HEAD(self):
        self.serve_static(super().do_HEAD)

    def serve_static(self, serve):
        url = urlparse(self.path)
        if url.path == "/":
            self.path = "/index.html"
            url = urlparse(self.path)
        if not self.is_public(url.path):
            return self.send_error(404)
        serve()

    def do_POST(self):
        path = urlparse(self.path).path
        if path not in ("/api/appointments", "/api/reviews"):
            return self.send_error(404)
        try:
            length = int(self.headers.get("Content-Length", 0))
        except ValueError:
            length = 0
        if not 0 < length <= MAX_BODY_BYTES:
            return self.send_json(400, {"error": "Invalid request."})
        try:
            data = json.loads(self.rfile.read(length))
        except ValueError:
            data = None
        if not isinstance(data, dict):
            return self.send_json(400, {"error": "Invalid request."})

        try:
            with _write_lock:
                now = datetime.now()
                if path == "/api/appointments":
                    existing = read_records(self.appointments_path, APPOINTMENT_FIELDS)
                    record = build_appointment(data, existing, now)
                    append_record(self.appointments_path, APPOINTMENT_FIELDS, record)
                    reply = {k: record[k] for k in ("reference", "date", "time", "service", "pet_name", "email")}
                else:
                    record = build_review(data, now)
                    append_record(self.reviews_path, REVIEW_FIELDS, record)
                    reply = {"ok": True}
        except ValidationError as error:
            return self.send_json(400, {"error": str(error)})
        self.send_json(201, reply)


def make_server(port, data_dir=DEFAULT_DATA_DIR, host="127.0.0.1"):
    handler = type("BoundHandler", (Handler,), {"data_dir": data_dir})
    return ThreadingHTTPServer((host, port), handler)


def main():
    port = int(sys.argv[1]) if len(sys.argv) > 1 else int(os.environ.get("PORT", 8000))
    server = make_server(port)
    print(f"Pawsitive Care is running at http://localhost:{port}  (Ctrl+C to stop)")
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass
    finally:
        server.server_close()


if __name__ == "__main__":
    main()
