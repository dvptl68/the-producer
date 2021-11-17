const { Client, Intents } = require('discord.js');
const ytdl = require('ytdl-core');
const { prefix, token } = require('./config.json');

const getInfo = async () => {
  const songLink = 'https://www.youtube.com/watch?v=iI34LYmJ1Fs';
  const songInfo = await ytdl.getInfo(songLink);
  console.log(`title: ${songInfo.videoDetails.title}\nurl: ${songInfo.videoDetails.video_url}`);
};

getInfo();

/*
const client = new Client({ intents: [Intents.FLAGS.GUILDS, Intents.FLAGS.GUILD_MESSAGES] });
client.login(token);

client.once('ready', () => {
  console.log('Ready!');
});

client.on('messageCreate', async message => {

  if (message.author.bot) return;

  const content = message.content.toLowerCase();

  if (!content.startsWith(prefix)) return;
  else if (content.startsWith(`${prefix}play`)) message.channel.send('Playing music.');
  else if (content.startsWith(`${prefix}stop`)) message.channel.send('Stopping music.');
  else message.channel.send('Not a valid command.');
});
*/
