import {
  Client,
  GatewayIntentBits,
  SlashCommandBuilder,
  REST,
  Routes,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
} from "discord.js";
import fs from "fs";
import moment from "moment";
import express from "express";
import "dotenv/config";

/* ================= KEEP ALIVE ================= */
const app = express();
app.get("/", (_, res) => {
  res.send("💗 Destiny Archive activo 24/7");
});
app.listen(3000, () => console.log("🌐 Keep-alive activo"));

/* ================= CONFIG ================= */
const TOKEN = process.env.TOKEN;
const CLIENT_ID = process.env.CLIENT_ID;
const GUILD_ID = process.env.GUILD_ID;

const DATA_FOLDER = "./data";
const DB_FILE = `${DATA_FOLDER}/rachas.json`;

const LOG_NICK = "1465065450999386207";
const LOG_RACHAS = "1465800351839158590";

const PINK = 0xf7a1c4;

/* ================= ROLES ================= */
const STAFF_ROLES = [
  "1442360657386147961",
  "1442361351740850327",
  "1461419335435292703",
  "1442360350229004469",
  "1442360123098927134",
  "1442359882748530738",
];

/* ================= CLIENT ================= */
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
  ],
});

/* ================= DATABASE ================= */
let db = {};

function loadDB() {
  if (!fs.existsSync(DATA_FOLDER)) fs.mkdirSync(DATA_FOLDER);
  if (!fs.existsSync(DB_FILE)) fs.writeFileSync(DB_FILE, "{}");

  try {
    db = JSON.parse(fs.readFileSync(DB_FILE, "utf8"));
  } catch {
    db = {};
    saveDB();
  }
}

function saveDB() {
  fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2));
}

function getUser(id) {
  if (!db[id]) db[id] = { streak: 0, lastMessage: null };
  return db[id];
}

/* ================= UTIL ================= */
function isStaff(member) {
  return member.roles.cache.some((r) => STAFF_ROLES.includes(r.id));
}

function cleanNick(name) {
  return name.replace(/\s*✦\s*🔥\s*\d+/g, "").trim();
}

async function updateNick(member, streak) {
  const base = cleanNick(member.displayName);
  const nick = streak > 0 ? `${base} ✦ 🔥 ${streak}` : base;

  if (member.displayName === nick) return null;

  const before = member.displayName;
  await member.setNickname(nick).catch(() => {});
  return { before, after: nick };
}

function progressBar(value, max = 20) {
  const filled = Math.min(value, max);
  return "█".repeat(filled) + "░".repeat(max - filled);
}

/* ================= SLASH ================= */
const commands = [
  new SlashCommandBuilder()
    .setName("racha")
    .setDescription("Ver tu racha o la de otro usuario")
    .addUserOption((o) =>
      o.setName("usuario").setDescription("Usuario").setRequired(false),
    ),

  new SlashCommandBuilder()
    .setName("sumar_racha")
    .setDescription("Sumar racha (staff)")
    .addUserOption((o) =>
      o.setName("usuario").setDescription("Usuario").setRequired(true),
    )
    .addIntegerOption((o) =>
      o.setName("dias").setDescription("Días a sumar").setRequired(true),
    ),

  new SlashCommandBuilder()
    .setName("reset_racha")
    .setDescription("Resetear racha (staff)")
    .addUserOption((o) =>
      o.setName("usuario").setDescription("Usuario").setRequired(true),
    ),

  new SlashCommandBuilder()
    .setName("top_rachas")
    .setDescription("Top de rachas"),
].map((c) => c.toJSON());

/* ================= REGISTER ================= */
const rest = new REST({ version: "10" }).setToken(TOKEN);

client.once("ready", async () => {
  console.log("💗 Destiny Archive conectado");
  loadDB();
  await rest.put(Routes.applicationGuildCommands(CLIENT_ID, GUILD_ID), {
    body: commands,
  });
});

/* ================= RACHA INTERNACIONAL 24H ================= */
client.on("messageCreate", async (msg) => {
  if (msg.author.bot || !msg.guild) return;

  const member = await msg.guild.members.fetch(msg.author.id);
  const user = getUser(member.id);

  const now = Date.now();

  if (!user.lastMessage) {
    user.streak = 1;
  } else {
    const diffHours = (now - user.lastMessage) / (1000 * 60 * 60);

    if (diffHours <= 24) {
      return; // ya contó dentro de las 24h
    }

    if (diffHours <= 48) {
      user.streak += 1; // sigue racha
    } else {
      user.streak = 1; // se rompió
    }
  }

  user.lastMessage = now;
  saveDB();

  const nick = await updateNick(member, user.streak);

  if (nick) {
    const e = new EmbedBuilder()
      .setColor(PINK)
      .setTitle("💗 Destiny Archive • Nickname")
      .addFields(
        { name: "Usuario", value: member.user.tag },
        { name: "Cambio", value: `${nick.before} → ${nick.after}` },
      )
      .setThumbnail(member.user.displayAvatarURL())
      .setTimestamp();

    msg.guild.channels.cache.get(LOG_NICK)?.send({ embeds: [e] });
  }

  const log = new EmbedBuilder()
    .setColor(PINK)
    .setTitle("💗 Destiny Archive • Racha")
    .addFields(
      { name: "Usuario", value: member.displayName },
      { name: "🔥 Días", value: `${user.streak}`, inline: true },
      { name: "Progreso", value: `[${progressBar(user.streak)}]` },
    )
    .setTimestamp();

  msg.guild.channels.cache.get(LOG_RACHAS)?.send({ embeds: [log] });
});

/* ================= INTERACTIONS ================= */
client.on("interactionCreate", async (i) => {
  if (!i.isChatInputCommand() && !i.isButton()) return;

  if (i.isChatInputCommand() && i.commandName === "racha") {
    const m = i.options.getMember("usuario") || i.member;
    const u = getUser(m.id);

    return i.reply({
      embeds: [
        new EmbedBuilder()
          .setColor(PINK)
          .setTitle("📊 Destiny Archive • Racha")
          .addFields(
            { name: "Usuario", value: m.displayName },
            { name: "🔥 Días", value: `${u.streak}`, inline: true },
            { name: "Progreso", value: `[${progressBar(u.streak)}]` },
          )
          .setTimestamp(),
      ],
    });
  }

  if (
    i.isChatInputCommand() &&
    ["sumar_racha", "reset_racha"].includes(i.commandName) &&
    !isStaff(i.member)
  ) {
    return i.reply({ content: "💔 Sin permisos", ephemeral: true });
  }

  if (i.isChatInputCommand() && i.commandName === "sumar_racha") {
    const m = i.options.getMember("usuario");
    const dias = i.options.getInteger("dias");
    const u = getUser(m.id);

    u.streak += dias;
    saveDB();
    await updateNick(m, u.streak);

    return i.reply({
      embeds: [
        new EmbedBuilder()
          .setColor(PINK)
          .setDescription(`💞 Se sumaron **${dias} días** a ${m.displayName}`),
      ],
    });
  }

  if (i.isChatInputCommand() && i.commandName === "reset_racha") {
    const m = i.options.getMember("usuario");
    db[m.id] = { streak: 0, lastMessage: null };
    saveDB();
    await updateNick(m, 0);

    return i.reply({
      embeds: [
        new EmbedBuilder()
          .setColor(PINK)
          .setDescription(`💔 Racha reseteada para ${m.displayName}`),
      ],
    });
  }

  if (i.isChatInputCommand() && i.commandName === "top_rachas") {
    return sendTop(i, 0);
  }

  if (i.isButton()) {
    const page = Number(i.customId.split("_")[1]);
    return sendTop(i, page, true);
  }
});

/* ================= TOP ================= */
async function sendTop(i, page, edit = false) {
  const entries = Object.entries(db).sort((a, b) => b[1].streak - a[1].streak);
  const perPage = 10;
  const max = Math.max(1, Math.ceil(entries.length / perPage));
  const slice = entries.slice(page * perPage, (page + 1) * perPage);

  let desc = "";
  for (let idx = 0; idx < slice.length; idx++) {
    const [id, d] = slice[idx];
    const m = await i.guild.members.fetch(id).catch(() => null);
    if (!m) continue;
    desc += `**${page * perPage + idx + 1}.** ${m.displayName} — 🔥 ${d.streak}\n`;
  }

  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(`top_${page - 1}`)
      .setLabel("◀")
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(page <= 0),
    new ButtonBuilder()
      .setCustomId(`top_${page + 1}`)
      .setLabel("▶")
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(page + 1 >= max),
  );

  const embed = new EmbedBuilder()
    .setColor(PINK)
    .setTitle("🏆 Destiny Archive • Top Rachas")
    .setDescription(desc || "Sin datos")
    .setFooter({ text: `Página ${page + 1}/${max}` });

  return edit
    ? i.update({ embeds: [embed], components: [row] })
    : i.reply({ embeds: [embed], components: [row] });
}

client.login(TOKEN);
