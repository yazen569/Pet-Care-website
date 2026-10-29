import json
import os
import re
import sys
import tempfile
import threading
import unittest
from datetime import date, timedelta
from html.parser import HTMLParser
from urllib.error import HTTPError
from urllib.request import Request, urlopen

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
import server  # noqa: E402


def setUpModule():
    # Keep test output readable.
    server.Handler.log_message = lambda *args: None


def next_weekday(weekday):
    """The next date (after today) that falls on the given weekday (Mon=0)."""
    day = date.today() + timedelta(days=1)
    while day.weekday() != weekday:
        day += timedelta(days=1)
    return day.isoformat()


class ServerTest(unittest.TestCase):
    def setUp(self):
        self.data_dir = tempfile.mkdtemp()
        self.httpd = server.make_server(0, data_dir=self.data_dir)
        self.base = f"http://127.0.0.1:{self.httpd.server_address[1]}"
        threading.Thread(target=self.httpd.serve_forever, daemon=True).start()

    def tearDown(self):
        self.httpd.shutdown()
        self.httpd.server_close()

    def request(self, path, data=None):
        body = json.dumps(data).encode() if data is not None else None
        req = Request(self.base + path, data=body, headers={"Content-Type": "application/json"})
        try:
            with urlopen(req) as res:
                return res.status, res.read()
        except HTTPError as error:
            return error.code, error.read()

    def booking(self, **overrides):
        data = {
            "owner_name": "Sam Lee", "email": "sam@example.com", "phone": "",
            "pet_name": "Biscuit", "pet_type": "Dog",
            "services": ["Dog bath & brush (large, 60 lb+)", "Nail trim", "Dog rabies vaccine"],
            "date": next_weekday(1), "time": "10:00", "notes": "Nervous | shy\nwith strangers",
            "first_time_owner": True,
        }
        data.update(overrides)
        return data

    def read_data(self, name):
        with open(os.path.join(self.data_dir, name), encoding="utf-8") as f:
            return f.read()

    def test_booking_is_saved_and_slot_shows_as_booked(self):
        status, body = self.request("/api/appointments", self.booking())
        self.assertEqual(status, 201)
        self.assertTrue(json.loads(body)["reference"].startswith("PC-"))

        lines = self.read_data("appointments.txt").splitlines()
        self.assertTrue(lines[0].startswith("# created"))
        self.assertEqual(len(lines), 2)
        self.assertIn("Sam Lee", lines[1])
        self.assertIn("Nervous / shy with strangers", lines[1])
        self.assertIn("| Dog bath & brush (large, 60 lb+); Nail trim; Dog rabies vaccine | $115 |", lines[1])

        reply = json.loads(body)
        self.assertEqual(reply["total"], "$115")
        self.assertEqual([(s["name"], s["price"]) for s in reply["services"]],
                         [("Dog bath & brush (large, 60 lb+)", 75), ("Nail trim", 15), ("Dog rabies vaccine", 25)])

        status, body = self.request(f"/api/appointments?date={next_weekday(1)}")
        self.assertEqual(json.loads(body), {"booked": ["10:00"]})

    def test_total_uses_server_prices_and_from_prices(self):
        data = self.booking(services=["Dog full groom (bath, haircut, nails, ears)", "Teeth brushing",
                                      "Teeth brushing"], price=1)
        status, body = self.request("/api/appointments", data)
        self.assertEqual(status, 201)
        reply = json.loads(body)
        self.assertEqual(reply["total"], "from $82")
        self.assertEqual(len(reply["services"]), 2)  # duplicate removed

    def test_double_booking_is_rejected(self):
        self.assertEqual(self.request("/api/appointments", self.booking())[0], 201)
        status, body = self.request("/api/appointments", self.booking(owner_name="Other"))
        self.assertEqual(status, 400)
        self.assertIn("already booked", json.loads(body)["error"])

    def test_invalid_bookings_are_rejected(self):
        cases = {
            "past date": self.booking(date="2020-01-07"),
            "sunday": self.booking(date=next_weekday(6)),
            "bad time": self.booking(time="08:00"),
            "bad email": self.booking(email="nope"),
            "no services": self.booking(services=[]),
            "services not a list": self.booking(services="Nail trim"),
            "unknown service": self.booking(services=["Nail trim", "Haircut"]),
            "dog service for cat": self.booking(pet_type="Cat"),
            "missing name": self.booking(owner_name="  "),
        }
        for label, data in cases.items():
            with self.subTest(label):
                self.assertEqual(self.request("/api/appointments", data)[0], 400)
        self.assertFalse(os.path.exists(os.path.join(self.data_dir, "appointments.txt")))

    def test_bad_json_is_rejected(self):
        self.assertEqual(self.request("/api/appointments", ["not", "an", "object"])[0], 400)

    def test_review_is_saved_and_listed_newest_first(self):
        first = {"name": "Ana", "pet_name": "Mochi", "rating": 5, "review": "Lovely, patient staff."}
        second = {"name": "Ben", "pet_name": "", "rating": "4", "review": "Great first visit."}
        self.assertEqual(self.request("/api/reviews", first)[0], 201)
        self.assertEqual(self.request("/api/reviews", second)[0], 201)

        self.assertIn("Ana | Mochi | 5 | Lovely, patient staff.", self.read_data("reviews.txt"))
        reviews = json.loads(self.request("/api/reviews")[1])["reviews"]
        self.assertEqual([r["name"] for r in reviews], ["Ben", "Ana"])

    def test_invalid_reviews_are_rejected(self):
        for rating in (0, 6, "five", None):
            with self.subTest(rating=rating):
                data = {"name": "Ana", "rating": rating, "review": "Fine visit."}
                self.assertEqual(self.request("/api/reviews", data)[0], 400)

    def test_site_files_are_served_but_private_files_are_not(self):
        pages = ("/", "/index.html", "/services.html", "/assistant.html",
                 "/book.html", "/reviews.html", "/contact.html")
        for path in pages + ("/css/styles.css", "/js/main.js", "/js/assistant.js", "/images/logo.svg"):
            with self.subTest(path):
                self.assertEqual(self.request(path)[0], 200)
        for path in ("/data/appointments.txt", "/data/reviews.txt", "/server.py",
                     "/.git/config", "/css/../data/reviews.txt", "/css/", "/README.md"):
            with self.subTest(path):
                self.assertEqual(self.request(path)[0], 404)


class CheckboxCollector(HTMLParser):
    """Collects (value, data-price, has data-from) for the service checkboxes."""

    def __init__(self):
        super().__init__()
        self.services = []

    def handle_starttag(self, tag, attrs):
        attrs = dict(attrs)
        if tag == "input" and attrs.get("name") == "services":
            self.services.append((attrs["value"], int(attrs["data-price"]), "data-from" in attrs))


class FormMatchesServerTest(unittest.TestCase):
    def test_every_page_is_served(self):
        pages = {f for f in os.listdir(server.ROOT) if f.endswith(".html")}
        self.assertEqual(pages, server.PUBLIC_FILES)

    def test_booking_checklist_matches_server_prices(self):
        with open(os.path.join(server.ROOT, "book.html"), encoding="utf-8") as f:
            parser = CheckboxCollector()
            parser.feed(f.read())
        expected = [(name, s.price, s.from_price) for name, s in server.SERVICES.items()]
        self.assertEqual(sorted(parser.services), sorted(expected))

    def test_assistant_prices_match_server(self):
        with open(os.path.join(server.ROOT, "js", "assistant.js"), encoding="utf-8") as f:
            source = f.read()
        entries = re.findall(r"price: (\d+)(, from: true)?, book: (['\"])(.*?)\3", source)
        self.assertGreater(len(entries), 20)
        for price, from_price, _, book in entries:
            with self.subTest(book):
                self.assertIn(book, server.SERVICES)
                self.assertEqual(int(price), server.SERVICES[book].price)
                self.assertEqual(bool(from_price), server.SERVICES[book].from_price)


if __name__ == "__main__":
    unittest.main()
