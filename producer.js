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
  "play": { 
    "func": play,
    "hasParam": null
  },
  "pause": { 
    "func": pause,
    "hasParam": false
  },
  "skip": { 
    "func": skip,
    "hasParam": false
  },
  "stop": { 
    "func": stop,
    "hasParam": false
  },
  "queue": { 
    "func": queue,
    "hasParam": false
  },
  "remove": { 
    "func": remove,
    "hasParam": true
  },
  "leave": { 
    "func": leave,
    "hasParam": false
  },
  "clean": { 
    "func": clean,
    "hasParam": false
  },
  "help": { 
    "func": help,
    "hasParam": false
  }
};

// Performs checks and calls proper action
client.on('messageCreate', async message => {

  const content = message.content.toLowerCase();

  if (message.author.bot || !content.startsWith(prefix)) return;

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
  if (command in actions && (actions[command]["hasParam"] === null || param == actions[command]["hasParam"])) {
    log(`Executing command "${message.content}" from @${message.member.displayName} (${message.author.tag})`);
    await actions[command]["func"](message, param);
    log("Completed command execution\n");
  } else {
    log(`Invalid command "${message.content}" from @${message.member.displayName} (${message.author.tag})\n`);
    message.channel.send(`Invalid command "${message.content}"`);
  }
});

const player = new Player();

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

  // If a parameter is not provided, it is either a pause command or an error
  if (!param) {
    if (player.isPaused()) {
      if (player.unpause()) message.react("▶️");
    } else {
      log("ERROR: No song provided");
      message.channel.send("You need to provide a song to play!");
    }
    return;
  }

  message.react("👍");

  // Play song
  await player.playSong(message.channel, voiceChannel, param);
};

async function pause(message) {

  if (player.pause(message.channel)) message.react("⏸️");;
}

async function skip(message) {

  if (player.skip(message.channel)) message.react("⏭️");
}

async function queue(message) {

  player.printQueue(message.channel);
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

  player.remove(message.channel, ind);
}

async function stop(message = null) {

  if (player.stop(message.channel) && message !== null) message.react("🛑");
}

async function leave(message) {

  if (player.leave(message.channel, message.guild.id)) message.react("👋");
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
    "• **play** - resume paused song\n" +
    "• **skip** - skip current song\n" +
    "• **stop** - stop current song and clear queue\n" +
    "• **queue** - list song queue\n" +
    "• **remove [pos]** - remove song in position [pos] from queue\n" +
    "• **leave** - leave voice channel"
  );
}
