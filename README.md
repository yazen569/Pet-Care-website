# Pawsitive Care: MVP Website

MVP homepage for **Pawsitive Care**, an inclusive grooming business for dogs and cats.

## View it locally

No build step or server is needed. Open `index.html` in any browser:

```bash
# macOS
open index.html
# Linux
xdg-open index.html
# Windows
start index.html
```

Or serve it locally with `python3 -m http.server 8000` and visit http://localhost:8000.

## What's included

- **Mission:** an inclusive, fear-free environment for every dog and cat, whatever its breed, size, age or needs
- **Services & pricing:** dog grooming, cat grooming and add-ons
- **Placeholder links:** nav, booking buttons, login and footer links are intentionally non-functional for the MVP. Clicking one shows a "coming soon" message.

## Structure

```
index.html      Homepage
css/styles.css  Styles (responsive, no frameworks)
js/main.js      "Coming soon" handler for placeholder links (data-mvp)
```

Prices are placeholders. Edit them in the `Services & pricing` section of `index.html`.
