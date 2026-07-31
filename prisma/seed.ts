import { PrismaClient, StatoCausa } from "@prisma/client";
import { encryptField } from "../src/lib/crypto";

const prisma = new PrismaClient();

async function main() {
  const adminEmail = process.env.INITIAL_ADMIN_EMAIL ?? "admin@studiolegale.it";

  const admin = await prisma.user.upsert({
    where: { email: adminEmail },
    update: {},
    create: {
      email: adminEmail,
      name: "Amministratore Studio",
      role: "ADMIN",
    },
  });

  const cliente = await prisma.cliente.upsert({
    where: { id: "seed-cliente-1" },
    update: {},
    create: {
      id: "seed-cliente-1",
      citta: "Torino",
      cognome: "Rossi",
      nome: "Mario",
      piattaforma: "INPS",
      note: "Cliente di esempio inserito in fase di avvio piattaforma.",
      natoA: "Torino",
      natoIl: new Date("1980-05-12"),
      residenteIn: "Via Roma 1, Torino",
      codiceFiscaleCifrato: encryptField("RSSMRA80E12L219K"),
      richiestaDati: true,
      orario: "9:00-13:00",
      periodoDiLavoro: "2015-2022",
      mezzo: "Email",
      dataRicevimento: new Date(),
      email: "mario.rossi@example.com",
      numero: "+39 011 1234567",
      pagamento: "Saldato",
      iscritto: true,
      docMancanti: "Nessuno",
    },
  });

  const causa = await prisma.causa.upsert({
    where: { id: "seed-causa-1" },
    update: {},
    create: {
      id: "seed-causa-1",
      stato: StatoCausa.PENDENTI,
      fascicolo: "2026/001",
      tribunale: "Tribunale di Torino",
      rg: "1234/2026",
      ricorrenti: "Mario Rossi",
      controparte: "INPS",
      ultimaUdienza: new Date("2026-06-10"),
      dataUdienza: new Date("2026-09-15"),
      adempimenti: "Deposito memoria integrativa",
      termine: new Date("2026-09-01"),
      fattoONo: false,
      propostaTrasmessa: false,
      note: "Fascicolo di esempio.",
      procure185: true,
    },
  });

  await prisma.clienteCausa.upsert({
    where: { clienteId_causaId: { clienteId: cliente.id, causaId: causa.id } },
    update: {},
    create: {
      clienteId: cliente.id,
      causaId: causa.id,
      ruoloCliente: "ricorrente",
      ultimoDocumentoNome: "Verbale udienza 15/09/2026",
    },
  });

  console.log("Seed completato. Utente admin:", admin.email);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
