# Piattaforma Gestionale — Studio Legale

Applicazione web per la gestione di clienti, fascicoli (cause) e documenti di
uno studio legale, con invio email e archiviazione documenti integrati con
Google (Gmail e Drive).

## Funzionalità principali

- **Login con ruolo**: accesso tramite account Google dello studio (OAuth),
  con ruoli `ADMIN`, `AVVOCATO`, `SEGRETERIA`, `SOLA_LETTURA` che determinano
  cosa si può leggere, modificare, eliminare o inviare.
- **Cause**: tre "fogli" (schede) — *Pendenti*, *Concluse*, *Esecuzioni* — con
  le colonne richieste (Fascicolo, Drive, Tribunale, RG, Nomi ricorrenti,
  Controparte, Ultima udienza, Data udienza, Adempimenti, Termine, Fatto o no,
  Proposta trasmessa, Data proposta, Note, Procure 185).
- **Clienti**: anagrafica completa (Città, Cognome, Nome, Piattaforma, Note,
  Nato a/il, Residente in, Codice fiscale, Richiesta dati, Orario, Periodo di
  lavoro, Mezzo, Data ricevimento, E-mail, Numero, Pagamento, Iscritto, Doc.
  mancanti).
- **Collegamenti clienti ↔ cause**: foglio di raccordo che lega ogni cliente
  al fascicolo/RG e all'ultimo documento Drive noto (verbali ecc.).
- **Interfaccia a foglio di calcolo**: tabelle con intestazione fissa,
  ordinamento per colonna e ricerca, in stile Excel. L'inserimento avviene con
  un **form guidato a passaggi**; la modifica di un record esistente richiede
  sempre una **conferma tramite modale** prima di salvare.
- **Google Drive**: la piattaforma **non crea mai** cartelle o file su Drive.
  Le cartelle dei fascicoli sono create a mano dallo studio seguendo una
  convenzione di nomenclatura (vedi sotto) e vengono collegate incollandone il
  link nel form del fascicolo; la piattaforma verifica solo che l'elemento
  collegato esista davvero, sia accessibile e non sia nel cestino. Una volta
  collegata la cartella, da un fascicolo è possibile elencare, caricare e
  aggiornare i documenti al suo interno.
- **Email automatiche**: promemoria per udienze e termini in scadenza nelle
  successive 48 ore, inviati tramite Gmail; ogni invio (manuale o automatico)
  è tracciato in un log.
- **Audit trail**: ogni creazione, modifica ed eliminazione su cause, clienti
  e collegamenti viene registrata con utente, data/ora e valori prima/dopo.

## Convenzione di nomenclatura delle cartelle Drive

Le cartelle dei fascicoli (create a mano su Drive, mai dalla piattaforma)
seguono la convenzione:

```
anno_rg_parte[+...]_controparte[+...]_tribunale
```

Esempio: `2025_8271_IBHAROGA_DELIVEROO_TRIB TORINO`

Le parti tra `[...]` sono opzionali (più ricorrenti/controparti si concatenano
con `+`). Quando si collega una cartella a un fascicolo (incollandone il link
nel form), la piattaforma confronta il nome reale della cartella con quello
atteso in base ai dati del fascicolo (R.G. nel formato `numero/anno`,
ricorrenti, controparte, tribunale) e mostra un **avviso non bloccante** se
non corrispondono, per aiutare a individuare link collegati alla cartella
sbagliata. Il salvataggio non viene comunque impedito: la piattaforma verifica
solo l'esistenza della cartella, non il rispetto della convenzione.

## Sicurezza dei dati

Requisiti minimi per il trattamento di dati personali e giudiziari (GDPR):

- **Cifratura applicativa** dei campi più sensibili (es. codice fiscale) con
  AES-256-GCM, indipendente dalla cifratura del database (`src/lib/crypto.ts`).
- **Controllo accessi basato sui ruoli (RBAC)** applicato sia lato API
  (`src/lib/rbac.ts`) sia lato UI/route (`middleware.ts`, i vari `layout.tsx`).
- **Accesso riservato**: il login accetta solo account Google dei domini
  indicati in `ALLOWED_EMAIL_DOMAINS`.
- **Audit trail** immutabile per ogni operazione di scrittura (`AuditLog`).
- **Sessioni** persistite su database con scadenza a 8 ore.
- **Header di sicurezza HTTP** (`X-Frame-Options`, `HSTS`, ecc.) impostati in
  `next.config.mjs`.
- Il database va eseguito con connessione cifrata (TLS) e backup cifrati;
  questo va configurato a livello di infrastruttura/hosting.

## Stack tecnico

- Next.js 14 (App Router) + TypeScript
- PostgreSQL + Prisma ORM
- NextAuth.js (provider Google, adapter Prisma)
- Tailwind CSS
- TanStack Table (griglia stile foglio di calcolo)
- React Hook Form + Zod (form guidati con validazione)
- googleapis (Drive + Gmail)

## Avvio in locale

1. Copiare `.env.example` in `.env` e compilare le variabili (vedi sotto).
2. Installare le dipendenze:
   ```bash
   npm install
   ```
3. Creare lo schema del database:
   ```bash
   npm run db:push
   ```
4. Popolare dati di esempio (crea l'utente admin iniziale):
   ```bash
   npm run db:seed
   ```
5. Avviare il server di sviluppo:
   ```bash
   npm run dev
   ```

## Configurazione Google

1. Su [Google Cloud Console](https://console.cloud.google.com/) creare un
   progetto, abilitare **Google Drive API** e **Gmail API**.
2. Creare credenziali **OAuth 2.0 Client ID** (tipo "Web application") con
   redirect URI `http://localhost:3000/api/auth/callback/google` (in
   produzione: `https://<dominio>/api/auth/callback/google`).
3. Copiare Client ID/Secret in `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET`.
4. Impostare `ALLOWED_EMAIL_DOMAINS` con il dominio email dello studio, così
   solo gli account autorizzati possono accedere.

Non serve configurare alcuna cartella radice: le cartelle dei fascicoli
esistono già su Drive (create a mano dallo studio) e vengono collegate di
volta in volta incollando il link nel form del fascicolo.

## Variabili d'ambiente

Vedere `.env.example` per l'elenco completo con descrizione. In sintesi:

| Variabile | Descrizione |
|---|---|
| `DATABASE_URL` | Connessione PostgreSQL |
| `NEXTAUTH_URL` / `NEXTAUTH_SECRET` | Configurazione NextAuth |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | OAuth Google (login, Drive, Gmail) |
| `ALLOWED_EMAIL_DOMAINS` | Domini email autorizzati ad accedere |
| `INITIAL_ADMIN_EMAIL` | Email che riceve il ruolo ADMIN al primo accesso |
| `FIELD_ENCRYPTION_KEY` | Chiave AES-256 per la cifratura dei campi sensibili |
| `CRON_SECRET` | Token per l'endpoint dei promemoria automatici |

## Promemoria automatici

L'endpoint `POST /api/email/automatiche` invia i promemoria per udienze e
termini in scadenza nelle 48 ore successive. Va invocato periodicamente (es.
ogni ora) da uno scheduler esterno (cron di sistema, GitHub Actions, servizio
di scheduling del proprio hosting), passando l'header:

```
x-cron-secret: <valore di CRON_SECRET>
```

## Struttura del progetto

```
prisma/schema.prisma       Modello dati (cause, clienti, collegamenti, audit, auth)
src/lib/                   Servizi: auth, RBAC, cifratura, audit, Google Drive/Gmail
src/app/api/                API REST (cause, clienti, collegamenti, drive, email, utenti)
src/app/dashboard/          Pagine applicative (cause, clienti, collegamenti, utenti)
src/components/             DataGrid stile foglio di calcolo, form guidati, modali di conferma
```

## Note

- I ruoli `AVVOCATO` e `SEGRETERIA` non gestiscono utenti; solo `ADMIN` può
  cambiare ruoli da `/dashboard/utenti`.
- Il primo utente che effettua il login con l'indirizzo indicato in
  `INITIAL_ADMIN_EMAIL` riceve automaticamente il ruolo `ADMIN`.
