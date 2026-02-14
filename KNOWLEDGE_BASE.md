# Rent App - Knowledge Base

## Zakljucak (sto aplikacija radi)
Ovo je web aplikacija za iznajmljivanje predmeta (tools/gear). Korisnici mogu:
- pregledati listu predmeta,
- dodati novi predmet s opcionalnom slikom,
- poslati zahtjev za rezervaciju datuma,
- vlasnici odobravaju/odbijaju zahtjeve,
- nakon odobrenja renter placa preko Stripe,
- postoji chat po rezervaciji.

## Tehnologije i struktura
- Next.js (App Router) u `app/`
- React client komponente za sve stranice
- Supabase za auth, bazu i storage
- Stripe za naplatu i webhook potvrdu placanja

## UI rute (app router)
- `/` lista predmeta + search i filter po gradu
- `/auth` prijava/registracija/odjava (Supabase)
- `/new-item` unos novog predmeta + upload slike
- `/my-items` lista mojih predmeta + edit/delete
- `/edit-item/[id]` edit predmeta (samo vlasnik)
- `/item/[id]` detalj predmeta + rezervacija datuma
- `/booking-requests` zahtjevi za rezervacije (vlasnik)
- `/my-bookings` moje rezervacije (renter)
- `/chat/[bookingId]` chat po rezervaciji

## API rute
- `app/api/create-checkout/route.ts`
  - kreira Stripe checkout session (EUR)
  - vraca `url` na koji se redirecta korisnik
- `app/api/stripe/webhook/route.ts`
  - Stripe webhook: oznacava booking kao paid
  - zapisuje `paid_at`, `status = paid` i `stripe_payment_intent_id`
- `app/api/refund-booking/route.ts`
  - refund preko Stripe (payment_intent)
  - postavlja status na `refunded` i `refunded_at`
- `app/api/stripe-webhook/route.ts`
  - postoji paralelna ruta, izgleda nedovrseno

## Baza podataka (prema Supabase shemi)
Napomena: ispod su stvarni stupci, FK i RLS iz Supabase upita.

### items
- id
- owner_id
- title
- description (nullable)
- price_per_day
- city
- category (nullable)
- deposit (nullable)
- is_active (default true)
- created_at

### item_images
- id
- item_id
- url
- created_at

### bookings
- id
- item_id
- renter_id
- owner_id
- start_date
- end_date
- status (pending/approved/rejected/cancelled/paid/refunded)
- total_price
- created_at
- paid_at (nullable)

### profiles
- id
- username
- city (nullable)
- country (nullable)
- avatar_url (nullable)
- created_at

### messages
- id
- booking_id
- sender_id
- text
- created_at

## Foreign keys
- bookings.item_id -> items.id
- item_images.item_id -> items.id
- messages.booking_id -> bookings.id

## Indeksi
- primarni kljucevi: bookings_pkey, item_images_pkey, item_pkey, messages_pkey, profiles_pkey

## RLS politike (sa izvoda)
- bookings: renter/owner mogu SELECT; owner i renter mogu UPDATE (razlicite politike); renter moze INSERT i DELETE; postoji dodatni SELECT za approved/paid (availability)
- items: public SELECT aktivnih; owner INSERT/UPDATE/DELETE
- item_images: public SELECT; authenticated INSERT; owner DELETE (preko items.owner_id)
- messages: samo sudionici booking-a mogu SELECT/INSERT
- profiles: public SELECT; user moze INSERT/UPDATE svoj profil; auth admin moze INSERT/UPDATE

## Triggeri
- bookings: `trg_reject_pending_when_paid` (AFTER UPDATE) -> `reject_pending_when_paid()`

## Storage
- Supabase bucket: `item-images`
- putanja: `{userId}/{itemId}/{uuid}.{ext}`
- javni URL se sprema u `item_images`

## Glavni tokovi
1) Registracija/prijava
- `/auth` koristi Supabase auth (email + password)

2) Kreiranje predmeta
- insert u `items`
- upload slike u storage (opcionalno)
- insert u `item_images`

3) Rezervacija
- `/item/[id]` unosi datume
- kreira `bookings` sa status `pending`
- lokalno provjerava overlap sa odobrenim bookingom

4) Obrada zahtjeva (vlasnik)
- `/booking-requests` odobri/odbij
- update status na `approved` ili `rejected`

5) Placanje
- `/my-bookings` poziva `/api/create-checkout`
- Stripe redirect
- webhook potvrdi placanje i oznaci booking kao `paid`

6) Chat
- poruke su vezane uz `booking_id`

## Konfiguracija (env)
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `STRIPE_SECRET_KEY`
- `STRIPE_WEBHOOK_SECRET`
- `NEXT_PUBLIC_BASE_URL`
- `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`

## Poznate napomene / potencijalni dug
- Postoje dvije stripe webhook rute; jedna izgleda nedovrsena (`app/api/stripe-webhook/route.ts`).
- Placanje se oznacava samo preko webhooka (pravilno), ali UI prikazuje poruku `paid=1` iz query param.
- RLS pravila su postavljena; provjeri da logika u UI-u ne krsi politike (posebno bookings UPDATE/SELECT).
