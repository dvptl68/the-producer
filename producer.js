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
  StreamType,
  AudioPlayerStatus,
  VoiceConnectionStatus
} = require('@discordjs/voice');
const ytdl = require('ytdl-core');
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

// Performs checks and calls proper action
client.on('messageCreate', async message => {

  if (message.author.bot || !message.content.startsWith(prefix)) return;

  const content = message.content.toLowerCase();

  let splitInd = content.indexOf(" ");
  if (splitInd === -1) splitInd = message.content.length;

  const command = content.substring(prefix.length, splitInd);
  const param = content.substring(splitInd).trim();

  if (command in actions) {
    log(`Executing command "${message.content}" from @${message.member.displayName} (${message.author.tag})`);
    actions[command](message, param);
  } else {
    log(`Invalid command "${message.content}" from @${message.member.displayName} (${message.author.tag})`);
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

  // const songInfo = await ytdl.getInfo('https://www.youtube.com/watch?v=iI34LYmJ1Fs');
  // const title = songInfo.videoDetails.title;
  // const url = songInfo.videoDetails.video_url;

  // Join voice channel
  const conn = joinVoiceChannel({
		channelId: channel.id,
		guildId: channel.guild.id,
		adapterCreator: channel.guild.voiceAdapterCreator
	});

  // Wait 30 seconds for connection to be ready
	try {
		await entersState(conn, VoiceConnectionStatus.Ready, 30e3);
	} catch (error) {
		conn.destroy();
		log(err);
	}

  log("Created voice connection");
};

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
