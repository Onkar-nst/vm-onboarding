#!/bin/sh
# Static-only server: files, no database. Gear Wall and the CRM fall back to
# browser localStorage, which is what you want for a click-around demo.
#
# For the real thing (shared database + REST API) use:  npm run dev
#
# (Serving over http://localhost also enables the camera for Gear Wall's QR scanner.)
cd "$(dirname "$0")"
echo "Katta home page ->  http://localhost:4173     <- open this one"
echo ""
echo "  VM Onboarding   ->  http://localhost:4173/vm-onboarding/"
echo "  Gear Wall       ->  http://localhost:4173/gear-wall/"
echo "  Katta Knowledge ->  http://localhost:4173/katta-knowledge/"
echo "  Admissions CRM  ->  http://localhost:4173/CRM/   (public form: /CRM/enquiry.html)"
echo "  Portfolio       ->  http://localhost:4173/portfolio/"
echo ""
echo "  PIN everywhere: 1234        Stop the server with Ctrl+C"
python3 -m http.server 4173
