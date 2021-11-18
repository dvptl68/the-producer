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
const client = new Client({ intents: [Intents.FLAGS.GUILDS, Intents.FLAGS.GUILD_MESSAGES, Intents.FLAGS.GUILD_VOICE_STATES] });
client.login(token);

// Bot status loggers
client.on('ready', () => log(`Logged in as ${client.user.tag}`));
client.on('reconnecting', () => log('Reconnecting'));
client.on('resume', () => log(`Connected ${client.user.tag}`));
client.on('disconnect', () => log('Disconnecting'));

const log = out => console.log(`[${new Date().toLocaleString()}] ${out}`);

// All commands that bot can execute
const actions = {
  "play": play,
  "leave": leave
};

// Performs checks and calls proper action
client.on('messageCreate', async message => {

  if (message.author.bot) return;

  const content = message.content.toLowerCase().split(" ").filter(Boolean);
  if (!content[0].startsWith(prefix)) return;

  const command = content[0].substring(prefix.length);

  if (command in actions) {
    log(`Executing command "${message.content}" from user ${message.author.username}`);
    actions[command](message);
  } else {
    log(`Invalid command "${message.content}" from user ${message.author.username}`);
    message.channel.send(`Invalid command "${command}"`);
  }
});

// Joins given voice channel
async function connectToChannel(channel) {

	const connection = joinVoiceChannel({
		channelId: channel.id,
		guildId: channel.guild.id,
		adapterCreator: channel.guild.voiceAdapterCreator
	});

  // Wait 30 seconds for connection to be ready
	try {
		await entersState(connection, VoiceConnectionStatus.Ready, 30e3);
	} catch (error) {
		connection.destroy();
		throw err;
	}
}

async function play(message) {

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

  try {
    await connectToChannel(channel);
  } catch (err) {
    log(err);
  }
};

async function leave(message) {

  getVoiceConnection(message.guild.id).destroy();
}
