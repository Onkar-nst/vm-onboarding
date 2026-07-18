#!/bin/sh
# Serves the whole suite at http://localhost:4173
# (Serving over http://localhost also enables the camera for Gear Wall's QR scanner.)
cd "$(dirname "$0")"
echo "Katta tools running at:  http://localhost:4173"
echo "  VM Onboarding   ->  http://localhost:4173/vm-onboarding/"
echo "  Gear Wall       ->  http://localhost:4173/gear-wall/"
echo "  Katta Knowledge ->  http://localhost:4173/katta-knowledge/"
echo "  Admissions CRM  ->  http://localhost:4173/CRM/   (public form: /CRM/enquiry.html)"
python3 -m http.server 4173
