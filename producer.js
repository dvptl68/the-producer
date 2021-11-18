const { Client, Intents } = require('discord.js');
const ytdl = require('ytdl-core');
const { prefix, token } = require('./config.json');

const client = new Client({ intents: [Intents.FLAGS.GUILDS, Intents.FLAGS.GUILD_MESSAGES, Intents.FLAGS.GUILD_VOICE_STATES] });
client.login(token);

client.on('ready', () => log(`Logged in as ${client.user.tag}`));
client.on('reconnecting', () => log('Reconnecting'));
client.on('resume', () => log(`Connected ${client.user.tag}`));
client.on('disconnect', () => log('Disconnecting'));

const log = out => console.log(`[${new Date().toLocaleString()}] ${out}`);

client.on('messageCreate', async message => {

  if (message.author.bot) return;

  const content = message.content.toLowerCase();

  if (!content.startsWith(prefix)) return;
  else if (content.startsWith(`${prefix}play`)) playSong(message);
  else if (content.startsWith(`${prefix}stop`)) message.channel.send('Stopping music.');
  else message.channel.send('Not a valid command.');
});

const playSong = async message => {

  const voiceChannel = message.member.voice.channel;
  log(message.member.voice);
  log(message.member.voice.channel);
  if (!voiceChannel) return message.channel.send("You need to be in a voice channel to play music!");

  const permissions = voiceChannel.permissionsFor(message.client.user);
  if (!permissions.has("CONNECT") || !permissions.has("SPEAK")) return message.channel.send("I need the permissions to join and speak in your voice channel!");

  const songInfo = await ytdl.getInfo('https://www.youtube.com/watch?v=iI34LYmJ1Fs');
  const title = songInfo.videoDetails.title;
  const url = songInfo.videoDetails.video_url;

  try {
    const conn = await voiceChannel.join();
  } catch (err) {
    log(err);
  }

  log('Playing song');
};

/*
function play(guild, song) {
  const serverQueue = queue.get(guild.id);
  if (!song) {
    serverQueue.voiceChannel.leave();
    queue.delete(guild.id);
    return;
  }

  const dispatcher = serverQueue.connection
    .play(ytdl(song.url))
    .on("finish", () => {
      serverQueue.songs.shift();
      play(guild, serverQueue.songs[0]);
    })
    .on("error", error => console.error(error));
  dispatcher.setVolumeLogarithmic(serverQueue.volume / 5);
  serverQueue.textChannel.send(`Start playing: **${song.title}**`);
}

const getInfo = async () => {
  const songLink = 'https://www.youtube.com/watch?v=iI34LYmJ1Fs';
  const songInfo = await ytdl.getInfo(songLink);
  console.log(`title: ${songInfo.videoDetails.title}\nurl: ${songInfo.videoDetails.video_url}`);
};

getInfo();
*/
