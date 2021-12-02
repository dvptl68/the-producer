const { Client, Intents } = require("discord.js");
const { Player } = require("./player");
const { prefix, token } = require("./config.json");

// Discord client
const client = new Client({
  intents: [
    Intents.FLAGS.GUILDS,
    Intents.FLAGS.GUILD_MESSAGES,
    Intents.FLAGS.GUILD_MESSAGE_REACTIONS,
    Intents.FLAGS.GUILD_VOICE_STATES
  ]
});
client.login(token);

// Bot status loggers
const log = createTodayLogger("producer");
client.on("ready", () => {
  client.user.setActivity("the stu'", { type: "LISTENING" });
  log.info(`Logged in as ${client.user.tag}`)
});
client.on("reconnecting", () => log.info("Reconnecting"));
client.on("resume", () => log.info("Reconnected"));
client.on("disconnect", () => log.info("Disconnecting"));
client.on("guildCreate", (guild) => log.info(`Joined guild "${guild.name}" (#${guild.id})`));
client.on("guildDelete", (guild) => log.info(`Left guild "${guild.name}" (#${guild.id})`));
client.on("guildUnavailable", (guild) => log.info(`Guild "${guild.name}" (#${guild.id}) unavailable`));
client.on("guildUpdate", (oldGuild, newGuild) => log.info(`Guild "${oldGuild.name}" (#${oldGuild.id}) updated to "${newGuild.name}" (#${newGuild.id})`));
client.on("debug", (info) => log.debug(`${info}`));
client.on("warn", (info) => log.warn(`${info}`));
client.on("error", (info) => log.error(`${info}`));

// Create logger with file for today's date
function createTodayLogger(fileName) {

  const today = new Date();
  const dir = `logs/${today.getFullYear()}/${today.getMonth()}/${today.getDate()}`;
  require("fs-extra").ensureDirSync(dir);

  return require("simple-node-logger").createSimpleLogger({
    logFilePath: `${dir}/${fileName}.log`,
    timestampFormat: "YYYY-MM-DD HH:mm:ss",
    level: "info"
  });
}

// All commands that bot can execute and map of audio players and loggers for each guild
const actions = {
  "play": play,
  "pause": pause,
  "unpause": unpause,
  "skip": skip,
  "stop": stop,
  "queue": queue,
  "remove": remove,
  "clean": clean,
  "help": help
};
const players = new Map();
const loggers = new Map();

// Performs checks and calls proper action
client.on("messageCreate", async message => {

  const content = message.content.toLowerCase();

  if (message.author.bot || !content.startsWith(prefix)) return;

  // Initiate new guild
  const log = initiateGuild(message.guild.id, message.guild.name);
  log.info(`Executing command "${message.content}" from @${message.member.displayName} (${message.author.tag})`);

  let splitInd = content.indexOf(" ");
  if (splitInd === -1) splitInd = message.content.length;

  const command = content.substring(prefix.length, splitInd);
  const param = content.substring(splitInd).trim();

  // Check that bot has proper permissions
  const permissions = message.channel.permissionsFor(message.client.user);
  if (!permissions.has("ADD_REACTIONS") || !permissions.has("VIEW_CHANNEL") || !permissions.has("SEND_MESSAGES") || !permissions.has("EMBED_LINKS")) {
    log.warn("Bot does not have proper permissions in this channel");
    return;
  }

  // Check that user is in a voice channel
  const voiceChannel = message.member?.voice.channel;
  if (!voiceChannel) {
    log.warn("User not in a voice channel");
    message.channel.send("You need to be in a voice channel to use commands!");
    return;
  }

  // Execute proper command
  if (command in actions && ((actions[command].length > 1) === Boolean(param))) {
    await actions[command](message, param);
    log.info("Completed command execution");
  } else {
    message.channel.send(`Invalid command "${message.content}"`);
    log.warn(`Invalid command "${message.content}" from @${message.member.displayName} (${message.author.tag})`);
  }
});

// Create new player and logger if guild is new
function initiateGuild(guildId, guildName) {

  let log = loggers.get(guildId);
  if (loggers.get(guildId) === undefined) {
    log = createTodayLogger(guildId);
    log.info(`Logger for guild "${guildName}" (#${guildId})`);
    loggers.set(guildId, log);
  }
  if (players.get(guildId) === undefined) {
    players.set(guildId, new Player(guildId, log));
  }
  return log;
}

async function play(message, param) {

  const log = loggers.get(message.guild.id);

  // Check that bot has proper permissions
  const voiceChannel = message.member?.voice.channel;
  const permissions = voiceChannel.permissionsFor(message.client.user);
  if (!permissions.has("CONNECT")) {
    log.warn("Bot does not have permission to connect to the voice channel");
    message.channel.send("I do not have the proper permissions to connect to your voice channel!");
    return;
  }
  if (!permissions.has("SPEAK")) {
    log.warn("Bot does not have permission to speak in the voice channel");
    message.channel.send("I do not have the proper permissions to speak in your voice channel!");
    return;
  }

  message.react("👍");
  await players.get(message.guild.id).playSong(message.channel, voiceChannel, param);
};

async function pause(message) {
  if (players.get(message.guild.id).pause(message.channel)) message.react("⏸️");;
}

async function unpause(message) {
  if (players.get(message.guild.id).unpause(message.channel)) message.react("▶️");
}

async function skip(message) {
  const reactions = players.get(message.guild.id).skip(message.channel);
  if (reactions["skip"]) message.react("⏭️");
  if (reactions["leave"]) message.react("👋");
}

async function queue(message) {
  players.get(message.guild.id).printQueue(message.channel);
}

async function remove(message, param) {
  players.get(message.guild.id).remove(message.channel, param);
}

async function stop(message) {

  if (players.get(message.guild.id).stop(message.channel)) {
    message.react("🛑");
    message.react("👋");
  }
}

async function clean(message) {

  const log = loggers.get(message.guild.id);

  // Check that bot has proper permissions
  if (!message.channel.permissionsFor(message.client.user).has("MANAGE_MESSAGES")) {
    log.warn("Bot does not have permission to manage messages in the channel");
    message.channel.send("I do not have the proper permissions to delete messages in this channel!");
    return;
  }

  let deleted;
  do {
    try { deleted = await message.channel.bulkDelete(100); }
    catch { break; }
  } while (deleted.size != 0);

  log.info("Deleted as many messages as possible");
}

async function help(message) {

  message.channel.send(
    "• **play [song]** - play music where [song] is the name or YouTube URL\n" +
    "• **pause** - pause current song\n" +
    "• **unpause** - resume paused song\n" +
    "• **skip** - skip current song\n" +
    "• **stop** - stop current song and clear queue\n" +
    "• **queue** - list song queue\n" +
    "• **remove [pos]** - remove song in position [pos] from queue"
  );

  loggers.get(message.guild.id).info("Printed help");
}
