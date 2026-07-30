import { z } from "zod";

const dataOpzionale = z
  .union([z.string(), z.date(), z.null()])
  .optional()
  .transform((v) => (v ? new Date(v) : null));

export const causaSchema = z.object({
  stato: z.enum(["PENDENTI", "CONCLUSE", "ESECUZIONI"]),
  fascicolo: z.string().min(1, "Il numero di fascicolo è obbligatorio"),
  driveFolderId: z.string().nullish(),
  driveFolderUrl: z.string().nullish(),
  tribunale: z.string().nullish(),
  rg: z.string().nullish(),
  ricorrenti: z.string().nullish(),
  controparte: z.string().nullish(),
  ultimaUdienza: z.string().nullish(),
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
