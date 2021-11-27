/* Last completely tested and working code */
/* For use while new changes are being made and tested */

const {
  Client,
  Intents
} = require('discord.js');
const {
  joinVoiceChannel,
  createAudioPlayer,
  createAudioResource,
  entersState,
  getVoiceConnection,
  AudioPlayerStatus,
  VoiceConnectionStatus,
  NoSubscriberBehavior
} = require('@discordjs/voice');
const playdl = require('play-dl');
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
  "queue": printQueue,
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

// Audio player and song queue
const player = createAudioPlayer({
	behaviors: {
		noSubscriber: NoSubscriberBehavior.Stop,
	},
});
let queue = [];

// Plays next song if queue is not empty
player.on(AudioPlayerStatus.Idle, () => {

  if (queue.length === 0 || player.state.status !== AudioPlayerStatus.Idle) return;

  const { title, resource, channel } = queue.shift();

  // Attempt to play song, re-emitting event upon failure
  try {
    player.play(resource);
  } catch (err) {
    log(`Failed to play "${title}"`);
    log(err);
    channel.send(`Failed to play ***${title}***!`);
    player.emit(AudioPlayerStatus.Idle);
  }

  log(`Playing "${title}"`);
  channel.send(`Playing ***${title}***`);
});

// Join voice channel and play given song
async function play(message, param) {

  // Check that user is in a voice channel
  const channel = message.member?.voice.channel;
  if (!channel) {
    log("ERROR: User not in a voice channel");
    message.channel.send("You need to be in a voice channel to play music!");
    return;
  }

  // Check that bot has permissions to join and speak in voice channel
  const permissions = channel.permissionsFor(message.client.user);
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
    if (player.state.status === AudioPlayerStatus.Paused) {
      player.unpause();
      log("Unpaused music");
      message.react("▶️");
    } else {
      log("ERROR: No song provided");
      message.channel.send("You need to provide a song to play!");
    }
    return;
  }

  // Join voice channel
  const conn = joinVoiceChannel({
		channelId: channel.id,
		guildId: channel.guild.id,
		adapterCreator: channel.guild.voiceAdapterCreator
	});

  // Wait 30 seconds for connection to be ready
	try {
		await entersState(conn, VoiceConnectionStatus.Ready, 30e3);
    log("Created voice connection");
	} catch (error) {
		conn.destroy();
    log("Failed to establish voice connection");
		log(err);
    message.channel.send("Failed to join voice channel!");
    return;
	}

  message.react("👍");

  // Search song
  const songInfo = await playdl.search(param, { limit: 1 });
  if (songInfo.length === 0) {
    log(`ERROR: "${param}" not found`);
    message.channel.send(`***${param}*** not found!`);
    return;
  }

  // Get song playable resource
  let resource;
  try {
    const stream = await playdl.stream(songInfo[0].url);
    resource = createAudioResource(stream.stream, { inputType: stream.type });
  } catch (err) {
    log(`Failed to queue "${songInfo[0].title}"`);
    log(err);
    message.channel.send(`Failed to queue ***${songInfo[0].title}***!`);
    return;
  }
  
  queue.push({
    title: songInfo[0].title,
    resource: resource,
    channel: message.channel
  });

  log(`Queued "${songInfo[0].title}" (${songInfo[0].url})`);
  message.channel.send(`Queued ***${songInfo[0].title}***\n${songInfo[0].url}`);

  // Emit player event and subscribe connection to player
  player.emit(AudioPlayerStatus.Idle);
  conn.subscribe(player);
};

// Pause current music if any
async function pause(message) {

  if (player.state.status === AudioPlayerStatus.Playing) {
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

  player.stop();
  player.emit(AudioPlayerStatus.Idle);
  log("Skipped current music");
  message.react("⏭️");
}

// List song queue
async function printQueue(message) {

  let output = "Songs in queue:";
  if (queue.length === 0) {
    output = "No songs are in the queue.";
  } else {
    for (let i = 0; i < queue.length; i++) {
      output += `\n**${i + 1}**: *${queue[i].title}*`;
    }
  }

  log("Printed song queue");
  message.channel.send(output);
}

// Remove specified music from queue
async function remove(message, param) {

  // Initial checks
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

  const removedInfo = queue[ind - 1];
  queue.splice(ind - 1, 1);
  log(`Removed queue item ${ind}: "${removedInfo.title}"`);
  message.channel.send(`Removed ***${removedInfo.title}*** from queue.`);
}

// Stop player and clear queue
async function stop(message = null) {

  if (message !== null) message.react("🛑");

  queue = [];
  player.stop();

  log("Cleared queue and stopped player");
}

// Leave voice channel
async function leave(message) {

  const conn = getVoiceConnection(message.guild.id);

  if (conn === undefined) {
    log("ERROR: No voice connection exists");
    message.channel.send("I am not in a voice channel!");
  } else {
    conn.destroy();
    log("Destroyed voice connection");
    message.react("👋");
  }

  stop();
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
