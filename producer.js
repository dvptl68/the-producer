const { Client, Intents } = require('discord.js');
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

// All commands that bot can execute
const actions = {
  "play": play,
  "pause": pause,
  "skip": skip,
  "stop": stop,
  "queue": queue,
  "remove": remove,
  "leave": leave,
  "clean": clean,
  "help": help
};

// Performs checks and calls proper action
client.on('messageCreate', async message => {

  const content = message.content.toLowerCase();

  if (message.author.bot || !content.startsWith(prefix)) return;

  let splitInd = content.indexOf(" ");
  if (splitInd === -1) splitInd = message.content.length;

  const command = content.substring(prefix.length, splitInd);
  const param = content.substring(splitInd).trim();

  if (command in actions) {
    log(`Executing command "${message.content}" from @${message.member.displayName} (${message.author.tag})`);
    await actions[command](message, param);
    log("Completed command execution\n");
  } else {
    log(`Invalid command "${message.content}" from @${message.member.displayName} (${message.author.tag})\n`);
    message.channel.send(`Invalid command "${message.content}"`);
  }
});

const player = new Player();

// Join voice channel and play given song
async function play(message, param) {

  // Check that user is in a voice channel and bot has proper permissions
  const voiceChannel = message.member?.voice.channel;
  if (!voiceChannel) {
    log("ERROR: User not in a voice channel");
    message.channel.send("You need to be in a voice channel to play music!");
    return;
  }
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

  // If a parameter is not provided, it is either a pause command or an error
  if (!param) {
    if (player.isPaused()) {
      player.unpause();
      log("Unpaused music");
      message.react("▶️");
    } else {
      log("ERROR: No song provided");
      message.channel.send("You need to provide a song to play!");
    }
    return;
  }

  message.react("👍");

  // Play song, outputting message if needed
  const out = await player.playSong(message.channel, voiceChannel, param);
  if (out) message.channel.send(out);
};

// Pause current music if any
async function pause(message) {

  if (player.isPlaying()) {
    player.pause();
    log("Paused music");
    message.react("⏸️");
  } else {
    log("ERROR: Nothing currently playing");
    message.channel.send("Nothing is currently playing!");
  }
}

// Skip current music
async function skip(message) {

  player.skip();
  log("Skipped current music");
  message.react("⏭️");
}

// List song queue
async function queue(message) {

  message.channel.send(player.printQueue());
  log("Printed song queue");
}

// Remove specified music from queue
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

  const title = player.remove(ind);
  log(`Removed queue item ${ind}: "${title}"`);
  message.channel.send(`Removed ***${title}*** from queue.`);
}

// Stop player and clear queue
async function stop(message = null) {

  if (message !== null) message.react("🛑");
  player.stop();
  log("Cleared queue and stopped player");
}

// Leave voice channel
async function leave(message) {

  const out = player.leave(message.guild.id);
  if (out) message.channel.send(out);
  else message.react("👋");
}

// Delete messages from the voice channel
async function clean(message) {

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

// Print help for every command
async function help(message) {

  message.channel.send(
    "• **play [song]** - play music where [song] is the name or YouTube URL\n" +
    "• **pause** - pause current song\n" +
    "• **play** - resume paused song\n" +
    "• **skip** - skip current song\n" +
    "• **stop** - stop current song and clear queue\n" +
    "• **queue** - list song queue\n" +
    "• **remove [pos]** - remove song in position [pos] from queue\n" +
    "• **leave** - leave voice channel"
  );
}
