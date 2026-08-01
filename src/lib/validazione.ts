import { z } from "zod";

export const dataOpzionale = z
  .union([z.string(), z.date(), z.null()])
  .optional()
  .transform((v) => (v ? new Date(v) : null));

export const causaSchema = z.object({
  stato: z.enum(["PENDENTI", "CONCLUSE", "ESECUZIONI"]),
  fascicolo: z.string().min(1, "Il numero di fascicolo è obbligatorio"),
  // Link alla cartella Drive già esistente (creata a mano dallo studio
  // seguendo la convenzione di nomenclatura). L'ID viene risolto e
  // verificato lato server: la piattaforma non crea mai cartelle su Drive.
  driveFolderUrl: z.string().nullish(),
  tribunale: z.string().nullish(),
  rg: z.string().nullish(),
  ricorrenti: z.string().nullish(),
  controparte: z.string().nullish(),
  ultimaUdienza: dataOpzionale,
  dataUdienza: dataOpzionale,
  adempimenti: z.string().nullish(),
  termine: dataOpzionale,
  fattoONo: z.boolean().default(false),
  propostaTrasmessa: z.boolean().default(false),
  dataProposta: dataOpzionale,
  note: z.string().nullish(),
  procure185: z.boolean().default(false),
});

export type CausaInput = z.infer<typeof causaSchema>;

export const praticaSchema = z.object({
  stato: z.enum(["PENDENTI", "CONCLUSE", "IN_ESECUZIONE", "DA_PAGARE", "DIMESSI_ESCLUSI"]),
  categoria: z.enum(["RAIDER", "CAUSA_SINGOLA", "DA_CLASSIFICARE"]),
  tipologia: z.string().nullish(),
  // Link alla cartella Drive già esistente: stessa politica di Causa,
  // verificato lato server ma mai creato dalla piattaforma. È anche la
  // chiave usata dall'import Excel per abbinare le righe alle pratiche.
  driveFolderUrl: z.string().min(1, "Il link alla cartella Drive è obbligatorio"),
  rg: z.string().nullish(),
  citta: z.string().nullish(),
  nome: z.string().nullish(),
  cognome: z.string().nullish(),
  // Testo in chiaro (indirizzo + CF): cifrato lato server prima del
  // salvataggio, mai persistito così com'è.
  datiAnagrafici: z.string().nullish(),
  controparte: z.string().nullish(),
  appuntamenti: z.string().nullish(),
  note: z.string().nullish(),
  email: z.string().email("Email non valida").nullish().or(z.literal("")),
  telefono: z.string().nullish(),
  scadenza: dataOpzionale,
  impugnativa: dataOpzionale,
  dataLicenziamento: dataOpzionale,
  cartaceo: z.boolean().default(false),
  procura: z.boolean().default(false),
  emissioneFatturaSpeseLegali: z.string().nullish(),
  pagatoCapitale: z.boolean().default(false),
  pagatoSpeseLegali: z.boolean().default(false),
  precetto: z.string().nullish(),
  esecuzione: z.string().nullish(),
});

export type PraticaInput = z.infer<typeof praticaSchema>;

export const clienteSchema = z.object({
  citta: z.string().nullish(),
  cognome: z.string().min(1, "Il cognome è obbligatorio"),
  nome: z.string().min(1, "Il nome è obbligatorio"),
  piattaforma: z.string().nullish(),
  note: z.string().nullish(),
  natoA: z.string().nullish(),
  natoIl: dataOpzionale,
  residenteIn: z.string().nullish(),
  codiceFiscale: z
    .string()
    .regex(/^[A-Za-z0-9]{16}$/, "Il codice fiscale deve avere 16 caratteri alfanumerici")
    .nullish()
    .or(z.literal("")),
  richiestaDati: z.boolean().default(false),
  orario: z.string().nullish(),
  periodoDiLavoro: z.string().nullish(),
  mezzo: z.string().nullish(),
  dataRicevimento: dataOpzionale,
  email: z.string().email("Email non valida").nullish().or(z.literal("")),
  numero: z.string().nullish(),
  pagamento: z.string().nullish(),
  iscritto: z.boolean().default(false),
  docMancanti: z.string().nullish(),
});

export type ClienteInput = z.infer<typeof clienteSchema>;

export const collegamentoSchema = z.object({
  clienteId: z.string().min(1),
  causaId: z.string().min(1),
  ruoloCliente: z.string().nullish(),
  ultimoDocumentoNome: z.string().nullish(),
  ultimoDocumentoDriveId: z.string().nullish(),
  ultimoDocumentoUrl: z.string().nullish(),
  ultimoDocumentoData: dataOpzionale,
});

export type CollegamentoInput = z.infer<typeof collegamentoSchema>;

export const emailSchema = z.object({
  causaId: z.string().nullish(),
  destinatario: z.string().email(),
  oggetto: z.string().min(1),
  corpoHtml: z.string().min(1),
});
