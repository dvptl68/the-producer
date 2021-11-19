const {
  Client,
  VoiceChannel,
  Intents
} = require('discord.js');
const {
  joinVoiceChannel,
  createAudioPlayer,
  createAudioResource,
  entersState,
  getVoiceConnection,
  NoSubscriberBehavior,
  StreamType,
  AudioPlayerStatus,
  VoiceConnectionStatus
} = require('@discordjs/voice');
const ytdl = require('ytdl-core');
const playdl = require('play-dl');
const { prefix, token } = require('./config.json');

// Discord client
const client = new Client({
  intents: [
    Intents.FLAGS.GUILDS,
    Intents.FLAGS.GUILD_MESSAGES,
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
  "leave": leave
};

// Audio player and song queue
const player = createAudioPlayer();
const queue = [];

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

  const songInfo = await playdl.search(song, { limit: 1 })[0];
	const stream = await playdl.stream(songInfo.url);
  const resource = createAudioResource(stream.stream, { inputType: stream.type });

  queue.push({
    title: songInfo.title,
    url: songInfo.url,
    resource: resource
  });

  log(`Queued song ${songInfo.title} (${songInfo.url})`);
  message.channel.send(`Queued song ${songInfo.title} (${songInfo.url})`);

  await playSong(resource);
  conn.subscribe(player);
};

// Plays song based on song queue
async function playSong(resource) {

  player.play(resource);
  player.on(AudioPlayerStatus.Idle, () => {
    log("Finished song");
  });
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
    message.channel.send("Goodbye!");
  }
}
