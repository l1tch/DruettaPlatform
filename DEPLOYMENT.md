# Guida al deploy — setup managed

Checklist operativa per portare la piattaforma in produzione con servizi
interamente gestiti (nessun server da amministrare). L'accesso è
esclusivamente tramite Google, quindi la configurazione lato Google Workspace
conta quanto quella lato hosting: chi controlla l'account Google dello
studio controlla l'accesso alla piattaforma.

Stack consigliato: **Vercel** (applicazione + cron) + **Neon o Supabase**
(Postgres UE) + **Google Workspace/Cloud** (identità, Drive, Gmail) +
**Sentry** (error tracking, opzionale).

## 1. Google Cloud Console

1. Su [console.cloud.google.com](https://console.cloud.google.com/) creare
   un nuovo progetto dedicato (es. "Studio Legale - Gestionale").
2. In **API e servizi → Libreria**, abilitare:
   - Google Drive API
   - Gmail API
3. In **API e servizi → Schermata consenso OAuth**:
   - Tipo utente: **Interno** (Internal). Fondamentale: essendo il progetto
     legato al dominio Google Workspace dello studio, questo limita l'accesso
     ai soli account del dominio ed evita completamente la revisione di
     verifica di Google richiesta per app pubbliche che chiedono scope
     sensibili come `drive` e `gmail.send`.
   - Nome app, email di supporto, logo (facoltativo).
4. In **API e servizi → Credenziali → Crea credenziali → ID client OAuth**:
   - Tipo applicazione: **Applicazione web**.
   - URI di reindirizzamento autorizzati:
     - `https://<dominio-produzione>/api/auth/callback/google`
     - `http://localhost:3000/api/auth/callback/google` (solo per sviluppo
       locale, rimuovere se non serve)
   - Copiare **Client ID** e **Client Secret**: andranno nelle variabili
     d'ambiente `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET`.
5. Se lo studio userà la scansione automatica della cartella Drive delle
   cause pendenti, individuare l'ID della cartella radice (dall'URL:
   `https://drive.google.com/drive/folders/<ID>`) per
   `GOOGLE_DRIVE_CARTELLA_PENDENTI_ID`.

## 2. Google Workspace — sicurezza dell'identità

Poiché non esiste un login con password separata, questa è la parte più
importante dell'intero setup di sicurezza.

1. **Autenticazione a due fattori obbligatoria** per tutti gli utenti del
   dominio: Admin Console → Sicurezza → Autenticazione → 2-Step Verification
   → applicala a tutta l'organizzazione (o almeno a chi ha ruolo ADMIN/AVVOCATO
   sulla piattaforma).
2. **Data Processing Amendment (DPA)**: Admin Console → Account → Profilo
   azienda → Legal and compliance → accettare il DPA di Google Workspace.
   Necessario prima di trattare dati reali di clienti.
3. (Consigliato) Rivedere in Admin Console → Sicurezza → App di terze parti e
   SSO l'elenco delle app OAuth con accesso, per tenere sotto controllo cosa
   può leggere/scrivere su Drive e Gmail per conto degli utenti.
4. Verificare che `ALLOWED_EMAIL_DOMAINS` nella piattaforma sia impostato sul
   dominio dello studio: è un controllo applicativo di backup, non sostituisce
   la sicurezza di Workspace ma evita accessi da account Google esterni nel
   caso la schermata di consenso venga mai riconfigurata come "Esterna".

## 3. Database (Postgres gestito, UE)

1. Creare un progetto su [Neon](https://neon.tech) o
   [Supabase](https://supabase.com) in una regione UE (es. Francoforte).
2. Creare il database e recuperare la connection string: va in
   `DATABASE_URL`. Verificare che richieda TLS (`sslmode=require`, di norma
   già forzato da questi provider).
3. Abilitare i backup automatici / point-in-time recovery se non attivi di
   default sul piano scelto.
4. Non usare l'utente amministrativo del provider come utente applicativo se
   il piano lo consente: creare un ruolo con permessi limitati al solo
   schema dell'app.
5. Applicare lo schema:
   ```bash
   DATABASE_URL="..." npx prisma db push
   ```
6. Popolare l'utente amministratore iniziale (facoltativo, altrimenti il
   primo login con l'email di `INITIAL_ADMIN_EMAIL` riceve il ruolo ADMIN in
   automatico):
   ```bash
   DATABASE_URL="..." npm run db:seed
   ```

## 4. Vercel

1. Importare la repository GitHub su [vercel.com](https://vercel.com),
   region **Frankfurt (fra1)** o altra regione UE.
2. **Environment Variables** (Project Settings → Environment Variables),
   valori di produzione per tutte le voci di `.env.example`:
   `DATABASE_URL`, `NEXTAUTH_URL` (URL di produzione), `NEXTAUTH_SECRET`
   (`openssl rand -base64 32`), `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`,
   `ALLOWED_EMAIL_DOMAINS`, `INITIAL_ADMIN_EMAIL`,
   `GOOGLE_DRIVE_CARTELLA_PENDENTI_ID` (se usata),
   `FIELD_ENCRYPTION_KEY` (`openssl rand -hex 32`), `CRON_SECRET`
   (`openssl rand -hex 16`).
3. **Cron Jobs**: già configurati in `vercel.json` (promemoria email e
   scansione Drive, ogni ora). Vercel autentica automaticamente le chiamate
   cron con l'header `Authorization: Bearer <CRON_SECRET>` quando la
   variabile `CRON_SECRET` è impostata: nessuna configurazione aggiuntiva
   richiesta. La frequenza minima disponibile dipende dal piano Vercel:
   verificare i limiti attuali se si vogliono intervalli più fitti dell'ora.
4. **Dominio personalizzato**: Project Settings → Domains → aggiungere
   `gestionale.<dominio-studio>.it` (o simile) e creare il CNAME indicato da
   Vercel presso il gestore DNS del dominio.
5. Deploy: ogni push sul branch di produzione (di norma `main`) triggera un
   deploy automatico; ogni pull request genera un deploy di anteprima.

## 5. Monitoring (opzionale ma consigliato)

1. [Sentry](https://sentry.io): creare un progetto Next.js, aggiungere il DSN
   come variabile d'ambiente e seguire la loro guida di integrazione — utile
   perché un errore silenzioso nel salvataggio di una causa/cliente altrimenti
   passerebbe inosservato.
2. Uptime check di base (incluso in Vercel Analytics o un servizio gratuito
   come UptimeRobot) sull'URL di produzione.

## 6. Conformità

Prima di trattare dati reali di clienti, verificare di avere un Data
Processing Agreement firmato/accettato con ogni fornitore che tocca dati
personali: Google Workspace (punto 2), Vercel, il provider Postgres, Sentry
se usato. Predisporre inoltre una procedura interna per la notifica di data
breach (il Garante Privacy richiede la notifica entro 72 ore).

## Checklist go-live

- [ ] OAuth consent screen su "Interno", API Drive/Gmail abilitate
- [ ] 2FA obbligatoria su Google Workspace
- [ ] DPA Google Workspace accettato
- [ ] Database Postgres UE con backup automatici attivi
- [ ] Tutte le variabili d'ambiente configurate su Vercel (nessuna con valori
      di sviluppo/demo)
- [ ] Dominio personalizzato configurato con TLS attivo
- [ ] Cron jobs verificati (controllare i log della prima esecuzione)
- [ ] DPA firmati con hosting/DB/monitoring
- [ ] Primo accesso ADMIN testato con un account reale del dominio
