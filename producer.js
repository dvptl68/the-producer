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
client.on('ready', () => log(`Logged in as ${client.user.tag}\n`));
client.on('reconnecting', () => log('Reconnecting\n'));
client.on('resume', () => log(`Connected ${client.user.tag}\n`));
client.on('disconnect', () => log('Disconnecting\n'));

const log = out => console.log(`[${new Date().toLocaleString()}] ${out}`);

// All commands that bot can execute
const actions = {
  "play": play,
  "pause": pause,
  "unpause": unpause,
  "stop": stop,
  "leave": leave
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
    message.channel.send(`Invalid command "${command}"`);
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

  if (queue.length === 0) return;

  const {
    title,
    resource,
    channel
  } = queue.shift();

  log(`Playing "${title}"`);
  channel.send(`Playing ***${title}***`);

  player.play(resource);
});

// Join voice channel and play given song
async function play(message, param) {

  // Initial checks
  const channel = message.member?.voice.channel;
  if (!channel) {
    log("ERROR: User not in a voice channel");
    message.channel.send("You need to be in a voice channel to play music!");
    return;
  }

  const permissions = channel.permissionsFor(message.client.user);
  if (!permissions.has("CONNECT") || !permissions.has("SPEAK")) {
    log("ERROR: Bot does not have permissions for the voice channel");
    message.channel.send("I need the permissions to join and speak in your voice channel!");
    return;
  }

  if (!param) {
    log("ERROR: No song provided");
    message.channel.send("You need to provide a song to play!");
    return;
  }

  message.react("👍");

  const songInfo = await playdl.search(param, { limit: 1 });
  if (songInfo.length === 0) {
    log(`ERROR: "${param}" not found`);
    message.channel.send(`***${param}*** not found!`);
    return;
  }

  message.channel.send(`Queued ***${songInfo[0].title}***\n${songInfo[0].url}`); // sent before stream is created to avoid visible lag

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
		log(err);
	}

	const stream = await playdl.stream(songInfo[0].url);
  const resource = createAudioResource(stream.stream, { inputType: stream.type });

  queue.push({
    title: songInfo[0].title,
    resource: resource,
    channel: message.channel
  });
  log(`Queued "${songInfo[0].title}" (${songInfo[0].url})`);

  if (player.state.status === AudioPlayerStatus.Idle) player.emit(AudioPlayerStatus.Idle);
  conn.subscribe(player);
};

// Pauses current music if any
async function pause(message) {

  if (player.state.status === AudioPlayerStatus.Playing) {
    message.react("⏸️");
    player.pause();
    log("Paused music");
  } else {
    log("ERROR: Nothing currently playing");
    message.channel.send("Nothing is currently playing!");
  }
}

// Unpauses paused music if any
async function unpause(message) {

  if (player.state.status === AudioPlayerStatus.Paused) {
    message.react("▶️");
    player.unpause();
    log("Unpaused music");
  } else {
    log("ERROR: Nothing currently pause");
    message.channel.send("Nothing is currently paused!");
  }
}

async function stop(message = null) {

  if (message !== null) message.react("🛑");

  queue = [];
  player.stop();
  player.removeAllListeners();

  log("Cleared queue and stopped player");
}

// Leave voice channel
async function leave(message) {

  const conn = getVoiceConnection(message.guild.id);

  if (conn === undefined) {
    log("ERROR: No voice connection exists");
    message.channel.send("I am not in a voice channel!");
  } else {
    message.react("👋");
    conn.destroy();
    log("Destroyed voice connection");
  }

  stop();
}
