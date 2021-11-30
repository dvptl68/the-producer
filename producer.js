const { Client, Intents } = require('discord.js');
const SimpleLogger = require('simple-node-logger');
const { Player } = require('./player');
const { prefix, token } = require('./config.json');

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

// Status loggers
client.on('ready', () => {
  client.user.setActivity("the stu'", { type: "LISTENING" });
  log(`Logged in as ${client.user.tag}\n`)
});
client.on('reconnecting', () => log('Reconnecting\n'));
client.on('resume', () => log(`Connected ${client.user.tag}\n`));
client.on('disconnect', () => log('Disconnecting\n'));

const log = out => console.log(`[${new Date().toLocaleString()}] ${out}`);

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
client.on('messageCreate', async message => {

  const content = message.content.toLowerCase();

  if (message.author.bot || !content.startsWith(prefix)) return;

  // Initiate new guild
  initiateGuild(message.guild.id, message.guild.name);
  log(`Executing command "${message.content}" from @${message.member.displayName} (${message.author.tag})`);

  let splitInd = content.indexOf(" ");
  if (splitInd === -1) splitInd = message.content.length;

  const command = content.substring(prefix.length, splitInd);
  const param = content.substring(splitInd).trim();

  // Check that bot has proper permissions
  const permissions = message.channel.permissionsFor(message.client.user);
  if (!permissions.has("ADD_REACTIONS") || !permissions.has("VIEW_CHANNEL") || !permissions.has("SEND_MESSAGES") || !permissions.has("EMBED_LINKS")) {
    log("ERROR: Bot does not have proper permissions in this channel");
    return;
  }

  // Check that user is in a voice channel
  const voiceChannel = message.member?.voice.channel;
  if (!voiceChannel) {
    log("ERROR: User not in a voice channel");
    message.channel.send("You need to be in a voice channel to use commands!");
    return;
  }

  // Execute proper command
  if (command in actions && ((actions[command].length > 1) === Boolean(param))) {
    await actions[command](message, param);
    log("Completed command execution");
  } else {
    log(`Invalid command "${message.content}" from @${message.member.displayName} (${message.author.tag})`);
    message.channel.send(`Invalid command "${message.content}"`);
  }
});

// Create new player and logger if guild is new
function initiateGuild(guildId, guildName) {

  if (players.get(guildId) === undefined) {
    players.set(guildId, new Player(guildId, guildName));
  }
  if (loggers.get(guildId) === undefined) {
    loggers.set(guildId, SimpleLogger.createSimpleLogger({
      logFilePath: `${guildId}--${new Date().toLocaleDateString().replaceAll("/", "-")}.log`,
      timestampFormat: "YYYY-MM-DD HH:mm:ss",
      level: "all"
    }));
  }
}

async function play(message, param) {

  // Check that bot has proper permissions
  const voiceChannel = message.member?.voice.channel;
  const permissions = voiceChannel.permissionsFor(message.client.user);
  if (!permissions.has("CONNECT")) {
    log("ERROR: Bot does not have permission to connect to the voice channel");
    message.channel.send("I do not have the proper permissions to connect to your voice channel!");
    return;
  }
  if (!permissions.has("SPEAK")) {
    log("ERROR: Bot does not have permission to speak in the voice channel");
    message.channel.send("I do not have the proper permissions to speak in your voice channel!");
    return;
  }

  message.react("👍");
  await players.get(message.guildId).playSong(message.channel, voiceChannel, param);
};

async function pause(message) {
  if (players.get(message.guildId).pause(message.channel)) message.react("⏸️");;
}

async function unpause(message) {
  if (players.get(message.guildId).unpause(message.channel)) message.react("▶️");
}

async function skip(message) {
  const reactions = players.get(message.guildId).skip(message.channel);
  if (reactions["skip"]) message.react("⏭️");
  if (reactions["leave"]) message.react("👋");
}

async function queue(message) {
  players.get(message.guildId).printQueue(message.channel);
}

async function remove(message, param) {

  // Check that an index is given, is an integer, and in the queue
  if (!param) {
    log("ERROR: No queue index provided");
    message.channel.send("You need to provide a song queue position to remove!");
    return;
  }
  const ind = parseInt(param);
  if (isNaN(ind)) {
    log("ERROR: Provided parameter is not a number");
    message.channel.send(`"${param}" is not a number!`);
    return;
  }
  if (ind < 1 || ind > queue.length) {
    log("ERROR: Provided parameter is not in queue range!");
    message.channel.send(`Position ${ind} is not in the queue!`);
    return;
  }

  players.get(message.guildId).remove(message.channel, ind);
}

async function stop(message) {

  if (players.get(message.guildId).stop(message.channel)) {
    message.react("🛑");
    message.react("👋");
  }
}

async function clean(message) {

  // Check that bot has proper permissions
  if (!message.channel.permissionsFor(message.client.user).has("MANAGE_MESSAGES")) {
    log("ERROR: Bot does not have permission to manage messages in the channel");
    message.channel.send("I do not have the proper permissions to delete messages in this channel!");
    return;
  }

  let deleted;
  do {
    try {
      deleted = await message.channel.bulkDelete(100);
    } catch (err) {
      log("Failed to delete messages");
      log(err);
      break;
    }
  } while (deleted.size != 0);

  log("Deleted as many messages as possible");
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
}
